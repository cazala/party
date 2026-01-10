/**
 * WebGL2 Engine
 *
 * High-level orchestrator that wires together GL resources, simulation, and rendering.
 * Similar architecture to WebGPUEngine but using WebGL2 texture-based particle storage
 * and fragment shader-based simulation.
 *
 * Responsibilities:
 * - Initialize WebGL2 context and allocate textures/framebuffers
 * - Maintain particle state on GPU using ping-pong texture rendering
 * - Drive per-frame simulation passes (integration, forces) using fragment shaders
 * - Render particles to scene texture, then present to canvas
 * - Track FPS and handle play/pause lifecycle
 */
import type { Module } from "../../module";
import { GL2Resources } from "./gl2-resources";
import { ParticleStore } from "./particle-store";
import { AbstractEngine, IParticle } from "../../interfaces";
import { SpacialGrid } from "./spacial-grid";
import {
  fullscreenVertexShader,
  integrateFragmentShader,
  particleVertexShader,
  particleFragmentShader,
  copyVertexShader,
  copyFragmentShader,
  generateForceFragmentShader,
  generateConstrainFragmentShader,
  gridAssignCellsFragmentShader,
  gridBuildRangesFragmentShader,
  generateBitonicSortFragmentShader,
  linesVertexShader,
  linesFragmentShader,
  trailsDecayFragmentShader,
  trailsDiffuseFragmentShader,
} from "./shaders";

export class WebGL2Engine extends AbstractEngine {
  private resources: GL2Resources;
  private particles: ParticleStore;
  private grid: SpacialGrid;
  private bufferMaxParticles: number;
  private animationId: number | null = null;
  private shouldSyncNextTick: boolean = false;
  private forceProgramSignature: string = "";
  private constrainProgramSignature: string = "";
  private quadBuffer: WebGLBuffer | null = null;
  // Lines module state
  private lineQuadBuffer: WebGLBuffer | null = null;
  private lineIndicesTextureA: WebGLTexture | null = null;
  private lineIndicesTextureB: WebGLTexture | null = null;
  private lineIndicesTexSize: number = 0;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
    maxParticles?: number;
    workgroupSize?: number;
    maxNeighbors?: number;
  }) {
    super({
      ...options,
      constrainIterations: options.constrainIterations ?? 5,
    });

    this.bufferMaxParticles = options.maxParticles ?? 100000;
    this.setMaxParticles(options.maxParticles ?? null);
    this.resources = new GL2Resources({ canvas: options.canvas });
    this.particles = new ParticleStore(this.bufferMaxParticles);
    this.grid = new SpacialGrid(this.cellSize);
  }

  async initialize(): Promise<void> {
    await this.resources.initialize();

    // Create particle textures for GPU storage
    this.resources.createParticleTextures(this.bufferMaxParticles);

    // Create scene textures for rendering
    const size = this.view.getSize();
    this.resources.canvas.width = size.width;
    this.resources.canvas.height = size.height;
    this.resources.createSceneTextures(size.width, size.height);

    // Create fullscreen quad buffer for simulation passes
    const quadVertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    this.quadBuffer = this.resources.createBuffer("quad", quadVertices);

    // Create shader programs
    this.createPrograms();

    // Configure grid (allocate grid textures)
    const viewSnapshot = this.view.getSnapshot();
    this.grid.configure(viewSnapshot, this.resources);

    // Clear scene
    this.resources.clearScene(this.clearColor);
  }

  private createPrograms(): void {
    // Integration shader (baseline simulation)
    this.resources.createProgram(
      "integrate",
      fullscreenVertexShader,
      integrateFragmentShader
    );

    // Particle rendering shader
    this.resources.createProgram(
      "particles",
      particleVertexShader,
      particleFragmentShader
    );

    // Copy shader (present to canvas)
    this.resources.createProgram(
      "copy",
      copyVertexShader,
      copyFragmentShader
    );

    // Grid shaders
    this.resources.createProgram(
      "grid_assign_cells",
      fullscreenVertexShader,
      gridAssignCellsFragmentShader
    );

    this.resources.createProgram(
      "grid_build_ranges",
      fullscreenVertexShader,
      gridBuildRangesFragmentShader
    );

    // Lines rendering shader
    this.resources.createProgram("lines", linesVertexShader, linesFragmentShader);

    // Trails shaders (decay and diffuse passes)
    this.resources.createProgram(
      "trails_decay",
      fullscreenVertexShader,
      trailsDecayFragmentShader
    );
    this.resources.createProgram(
      "trails_diffuse",
      fullscreenVertexShader,
      trailsDiffuseFragmentShader
    );

    // Create quad buffer for Lines instanced rendering (4 corners per line)
    const gl = this.resources.getGL();
    const lineQuadVertices = new Float32Array([0, 1, 2, 3]); // Corner indices
    this.lineQuadBuffer = gl.createBuffer();
    if (this.lineQuadBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineQuadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, lineQuadVertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // Build force application shader from enabled modules
    this.buildForceShader();
    // Build constraint shader from enabled modules (e.g. collisions)
    this.buildConstrainShader();
  }

  private buildForceShader(): void {
    // Collect force code from enabled force modules
    const forceModules = this.modules.filter(
      (m) => m.role === "force" && m.isEnabled()
    );

    if (forceModules.length === 0) {
      // No forces to apply
      return;
    }

    let uniformDecl = "";
    let fnDecls = "";
    let fnCalls = "";
    const signatureParts: string[] = [];
    for (const module of forceModules) {
      try {
        const descriptor = module.webgl2();
        if ("apply" in descriptor && descriptor.apply) {
          // Declare uniforms for all numeric inputs used by this module.
          // These match the names produced by getUniform() below and are set every frame.
          const inputs = module.read() as Record<string, unknown>;
          for (const [key, value] of Object.entries(inputs)) {
            if (typeof value !== "number") continue;
            uniformDecl += `uniform float u_${module.name}_${key};\n`;
          }

          const raw = descriptor.apply({
            particleVar: "p",
            dtVar: "dt",
            maxSizeVar: "0.0", // Not used in these modules yet
            getUniform: (id: string) => `u_${module.name}_${String(id)}`,
            getLength: (_id: string) => `0`, // Arrays not supported yet
            getState: () => "0.0", // State not supported yet
          });

          let body = this.convertWGSLtoGLSL(raw);
          body = body.trim();
          if (!body.startsWith("{")) {
            body = `{\n${body}\n}`;
          }

          const fnName = `apply_${module.name}`;
          fnDecls += `void ${fnName}(inout Particle p, int particleId, float dt) ${body}\n\n`;
          fnCalls += `  ${fnName}(p, particleId, u_dt);\n`;
          signatureParts.push(module.name);
        }
      } catch (e) {
        // Module doesn't support WebGL2, skip it
        console.warn(`Module ${module.name} does not support WebGL2:`, e);
      }
    }

    if (fnDecls) {
      const fragmentShader = generateForceFragmentShader(
        fnDecls,
        fnCalls,
        uniformDecl
      );
      // Force shader is dynamic (depends on enabled modules). Replace if it exists.
      this.resources.deleteProgram("forces");
      this.resources.createProgram(
        "forces",
        fullscreenVertexShader,
        fragmentShader
      );
      this.forceProgramSignature = signatureParts.sort().join("|");
    }
  }

  private buildConstrainShader(): void {
    const enabledForceModules = this.modules.filter(
      (m) => m.role === "force" && m.isEnabled()
    );
    if (enabledForceModules.length === 0) return;

    // Only include modules that provide a webgl2().constrain snippet.
    const constrainModules = enabledForceModules.filter((m) => {
      try {
        const d = m.webgl2() as any;
        return !!d?.constrain;
      } catch {
        return false;
      }
    });
    if (constrainModules.length === 0) return;

    let uniformDecl = "";
    let fnDecls = "";
    let fnCalls = "";
    const signatureParts: string[] = [];

    for (const module of constrainModules) {
      try {
        const descriptor = module.webgl2() as any;
        if (!descriptor?.constrain) continue;

        // Declare uniforms for numeric inputs
        const inputs = module.read() as Record<string, unknown>;
        for (const [key, value] of Object.entries(inputs)) {
          if (typeof value !== "number") continue;
          uniformDecl += `uniform float u_${module.name}_${key};\n`;
        }

        const raw = descriptor.constrain({
          particleVar: "p",
          dtVar: "dt",
          maxSizeVar: "u_maxSize",
          prevPosVar: "vec2(0.0)", // Not supported yet (correct pass not implemented)
          postPosVar: "vec2(0.0)", // Not supported yet
          getUniform: (id: string) => `u_${module.name}_${String(id)}`,
          getLength: (_id: string) => `0`,
          getState: () => "0.0",
        });

        let body = this.convertWGSLtoGLSL(raw);
        body = body.trim();
        if (!body.startsWith("{")) {
          body = `{\n${body}\n}`;
        }

        const fnName = `constrain_${module.name}`;
        fnDecls += `void ${fnName}(inout Particle p, int particleId, float dt) ${body}\n\n`;
        fnCalls += `  ${fnName}(p, particleId, u_dt);\n`;
        signatureParts.push(module.name);
      } catch (e) {
        console.warn(
          `Module ${module.name} does not support WebGL2 constrain:`,
          e
        );
      }
    }

    if (!fnDecls) return;

    const fragmentShader = generateConstrainFragmentShader(
      fnDecls,
      fnCalls,
      uniformDecl
    );
    this.resources.deleteProgram("constrain");
    this.resources.createProgram(
      "constrain",
      fullscreenVertexShader,
      fragmentShader
    );
    this.constrainProgramSignature = signatureParts.sort().join("|");
  }

  private convertWGSLtoGLSL(wgslCode: string): string {
    // Convert WGSL-ish snippets emitted by modules into GLSL.
    // Modules currently output code that is "WGSL flavored" (let/var, vec2<f32>, select()).
    // We translate it line-by-line and keep a small symbol table so we can infer
    // whether a declaration should be float/vec2/vec4/etc.
    const lines = wgslCode.split("\n");
    const out: string[] = [];
    const symbols = new Map<string, "float" | "vec2" | "vec3" | "vec4" | "mat2" | "mat3" | "mat4">();

    const inferType = (rhs: string): typeof symbols extends Map<string, infer T> ? T : never => {
      // Strip outer parens/spaces
      const r = rhs.trim();

      // Explicit constructors
      if (/^(vec2)\s*\(/.test(r)) return "vec2" as any;
      if (/^(vec3)\s*\(/.test(r)) return "vec3" as any;
      if (/^(vec4)\s*\(/.test(r)) return "vec4" as any;
      if (/^(mat2)\s*\(/.test(r)) return "mat2" as any;
      if (/^(mat3)\s*\(/.test(r)) return "mat3" as any;
      if (/^(mat4)\s*\(/.test(r)) return "mat4" as any;

      // Known particle fields
      // IMPORTANT:
      // - `p.position` is vec2, but `p.position.x` is scalar.
      // - same for `p.color` vs `p.color.r`.
      if (/\b\w+\.color\b(?!\s*\.)/.test(r)) return "vec4" as any;
      if (/\b\w+\.(position|velocity|acceleration)\b(?!\s*\.)/.test(r))
        return "vec2" as any;

      // Functions that definitely return float
      if (/^(length|dot|sqrt|abs|floor|ceil|fract)\s*\(/.test(r)) return "float" as any;

      // Use symbol table: if rhs mentions a known non-float symbol, treat as that type.
      for (const [name, t] of symbols.entries()) {
        if (t === "float") continue;
        // If it's used as `name.x` etc, that's scalar, so ignore for type inference.
        const re = new RegExp(`\\b${name}\\b(?!\\s*\\.)`);
        if (re.test(r)) return t as any;
      }

      return "float" as any;
    };

    for (const line of lines) {
      let l = line;

      // Replace vecN<f32> with vecN
      l = l.replace(/vec([234])<f32>/g, "vec$1");

      // Replace select(a,b,cond) with ternary (cond ? b : a) - note reversed order
      l = l.replace(
        /select\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
        "($3 ? $2 : $1)"
      );

      // Convert `let name = expr;` / `var name = expr;` into typed GLSL declarations.
      const m = l.match(/^(\s*)(let|var)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/);
      if (m) {
        const indent = m[1] ?? "";
        const name = m[3];
        const rhs = m[4].trim();
        const type = inferType(rhs) as any;
        symbols.set(name, type);

        // Ensure integer literals in pure-float contexts don't trip GLSL ES.
        // (e.g. `let eps = 1;` -> `float eps = 1.0;`)
        const rhsFixed =
          type === "float" && /^\d+$/.test(rhs) ? `${rhs}.0` : rhs;

        l = `${indent}${type} ${name} = ${rhsFixed};`;
      }

      out.push(l);
    }

    return out.join("\n");
  }

  protected startAnimationLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  protected stopAnimationLoop(): void {
    // Animation loop is handled in animate() method
  }

  async destroy(): Promise<void> {
    this.pause();
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    // Clean up line indices textures
    const gl = this.resources.getGL();
    if (this.lineIndicesTextureA) {
      gl.deleteTexture(this.lineIndicesTextureA);
      this.lineIndicesTextureA = null;
    }
    if (this.lineIndicesTextureB) {
      gl.deleteTexture(this.lineIndicesTextureB);
      this.lineIndicesTextureB = null;
    }
    if (this.lineQuadBuffer) {
      gl.deleteBuffer(this.lineQuadBuffer);
      this.lineQuadBuffer = null;
    }
    await this.resources.dispose();
  }

  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.resources.canvas.width = width;
    this.resources.canvas.height = height;
    this.resources.createSceneTextures(width, height);
    this.grid.resizeIfNeeded(this.view.getSnapshot(), this.resources);
  }

  protected onViewChanged(): void {
    // Update grid when view changes
    this.grid.resizeIfNeeded(this.view.getSnapshot(), this.resources);
  }

  setParticles(p: IParticle[]): void {
    this.particles.setParticles(p);
    this.particles.syncToGPU(this.resources);
    // Update maxSize tracking
    this.resetMaxSize();
    for (const particle of p) {
      this.updateMaxSize(particle.size);
    }
  }

  async addParticle(p: IParticle): Promise<void> {
    await this.particles.syncFromGPU(this.resources);
    this.particles.addParticle(p);
    this.particles.syncToGPU(this.resources);
    this.updateMaxSize(p.size);
  }

  async getParticles(): Promise<IParticle[]> {
    await this.particles.syncFromGPU(this.resources);
    return this.particles.getParticles();
  }

  async getParticle(index: number): Promise<IParticle> {
    await this.particles.syncFromGPU(this.resources);
    return this.particles.getParticle(index);
  }

  getCount(): number {
    const actualCount = this.particles.getCount();
    if (this.maxParticles === null) {
      return actualCount;
    }
    return Math.min(actualCount, this.maxParticles);
  }

  clear(): void {
    this.particles.clear();
    this.resources.clearScene(this.clearColor);
    this.resetMaxSize();
  }

  /**
   * Update spatial grid for neighbor queries
   * Runs grid shader passes: assign cells, sort, build ranges
   */
  private updateGrid(): void {
    const gridTextures = this.resources.getGridTextures();
    const gridTexSize = this.resources.getGridTextureSize();
    if (!gridTextures || !gridTexSize) return;

    const particleCount = this.getCount();

    // Keep grid extents in sync with current view
    this.grid.resizeIfNeeded(this.view.getSnapshot(), this.resources);
    const bounds = this.grid.getGridBounds();

    // Pass 1: Assign cell IDs to particles
    this.runGridAssignCellsPass(bounds, gridTexSize.width, gridTexSize.height);

    // Pass 2: Sort particles by cell ID (bitonic sort)
    this.runBitonicSortPasses(particleCount, gridTexSize.width);

    // Pass 3: Build cell range table
    this.runGridBuildRangesPass();
  }

  private runGridAssignCellsPass(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    texWidth: number,
    texHeight: number
  ): void {
    const gl = this.resources.getGL();
    const gridTextures = this.resources.getGridTextures();
    if (!gridTextures) return;

    const program = this.resources.getProgram("grid_assign_cells");
    if (!program) return;

    gl.useProgram(program);

    // Bind to cellIds FBO (write initial cellId assignments)
    gl.bindFramebuffer(gl.FRAMEBUFFER, gridTextures.cellIdsFbo);
    gl.viewport(0, 0, texWidth, texHeight);

    // Bind particle texture
    const particleTex = this.resources.getCurrentParticleTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, particleTex);

    // Set uniforms
    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");
    const gridMinLoc = gl.getUniformLocation(program, "u_gridMin");
    const gridMaxLoc = gl.getUniformLocation(program, "u_gridMax");
    const gridDimsLoc = gl.getUniformLocation(program, "u_gridDims");
    const gridCellSizeLoc = gl.getUniformLocation(program, "u_gridCellSize");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texWidth, 1.0 / texHeight);
    gl.uniform1i(countLoc, this.getCount());
    gl.uniform2f(gridMinLoc, bounds.minX, bounds.minY);
    gl.uniform2f(gridMaxLoc, bounds.maxX, bounds.maxY);
    gl.uniform2f(gridDimsLoc, this.grid.getCols(), this.grid.getRows());
    gl.uniform1f(gridCellSizeLoc, this.grid.getCellSize());

    // Draw fullscreen quad
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(positionLoc);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Copy cellIds to sortedIndices for sorting
    // Reset sortedIndices ping-pong to a known state and seed A with cellIds.
    this.resources.resetSortedIndicesPingPong();
    this.copyTexture(
      gridTextures.cellIds,
      this.resources.getCurrentSortedIndicesFramebuffer(),
      texWidth,
      texHeight
    );
  }

  private copyTexture(
    sourceTex: WebGLTexture,
    targetFbo: WebGLFramebuffer,
    width: number,
    height: number
  ): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("copy");
    if (!program) return;

    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);

    const sceneTexLoc = gl.getUniformLocation(program, "u_sceneTexture");
    gl.uniform1i(sceneTexLoc, 0);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(positionLoc);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private runBitonicSortPasses(_particleCount: number, texWidth: number): void {
    const gl = this.resources.getGL();

    // We sort the entire sortedIndices texture (texWidth^2 entries). This is safe because:
    // - gridAssignCells writes INVALID_CELL for out-of-range / inactive particles
    // - those sentinels will sort to the end (large key)
    // Grid texture size is allocated as a power-of-two square.
    const sortCount = texWidth * texWidth;
    const logN = Math.round(Math.log2(sortCount));
    if (logN <= 0 || (1 << logN) !== sortCount) {
      // Should not happen: GL2Resources allocates power-of-two grid textures.
      return;
    }

    const texelSize = 1.0 / texWidth;

    const ensureProgram = (stage: number, step: number) => {
      const name = `bitonic_${stage}_${step}`;
      if (this.resources.getProgram(name)) return name;
      const frag = generateBitonicSortFragmentShader(stage, step);
      this.resources.createProgram(name, fullscreenVertexShader, frag);
      return name;
    };

    // Bitonic sort: for k=2..N (doubling), for j=k/2..1 (halving)
    for (let stage = 0; stage < logN; stage++) {
      for (let step = stage; step >= 0; step--) {
        const programName = ensureProgram(stage, step);
        const program = this.resources.getProgram(programName);
        if (!program) continue;

        gl.useProgram(program);

        // ping-pong between sortedIndices textures
        const targetFbo = this.resources.getOtherSortedIndicesFramebuffer();
        const sourceTex = this.resources.getCurrentSortedIndicesTexture();

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, texWidth, texWidth);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);

        const sortedLoc = gl.getUniformLocation(program, "u_sortedIndices");
        const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
        const countLoc = gl.getUniformLocation(program, "u_particleCount");

        gl.uniform1i(sortedLoc, 0);
        gl.uniform2f(texelSizeLoc, texelSize, texelSize);
        gl.uniform1i(countLoc, sortCount);

        const positionLoc = gl.getAttribLocation(program, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(positionLoc);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.resources.swapSortedIndicesTextures();
      }
    }
  }

  private runGridBuildRangesPass(): void {
    const gl = this.resources.getGL();
    const gridTextures = this.resources.getGridTextures();
    const gridTexSize = this.resources.getGridTextureSize();
    if (!gridTextures || !gridTexSize) return;

    const program = this.resources.getProgram("grid_build_ranges");
    if (!program) return;

    gl.useProgram(program);

    // Bind to cellRanges FBO
    const cellTexSize = Math.ceil(Math.sqrt(this.grid.getCellCount()));
    gl.bindFramebuffer(gl.FRAMEBUFFER, gridTextures.cellRangesFbo);
    gl.viewport(0, 0, cellTexSize, cellTexSize);

    // Bind sorted indices texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.resources.getCurrentSortedIndicesTexture());

    // Set uniforms
    const sortedIndicesLoc = gl.getUniformLocation(program, "u_sortedIndices");
    const sortedTexelSizeLoc = gl.getUniformLocation(
      program,
      "u_sortedTexelSize"
    );
    const countLoc = gl.getUniformLocation(program, "u_particleCount");
    const cellCountLoc = gl.getUniformLocation(program, "u_cellCount");

    gl.uniform1i(sortedIndicesLoc, 0);
    gl.uniform2f(
      sortedTexelSizeLoc,
      1.0 / gridTexSize.width,
      1.0 / gridTexSize.height
    );
    gl.uniform1i(countLoc, this.getCount());
    gl.uniform1i(cellCountLoc, this.grid.getCellCount());

    // Draw fullscreen quad
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(positionLoc);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private animate = (): void => {
    const dt = this.getTimeDelta();
    this.updateFPS(dt);

    // Only run simulation when playing
    if (this.playing) {
      this.updateOscillators(dt);

      // Build spatial grid for neighbor queries
      this.updateGrid();

      // Run force application pass (applies forces to acceleration)
      this.runForcePass(dt);

      // Run simulation pass: integrate velocity/position, reset acceleration
      this.runIntegrationPass(dt);

      // Run post-integration constraints (e.g. collisions).
      // Mirrors CPU/WebGPU pipelines where constraints run after integration.
      const iterations = Math.max(1, this.constrainIterations);
      for (let i = 0; i < iterations; i++) {
        this.runConstrainPass(dt);
      }

      if (this.shouldSyncNextTick) {
        // Sync to GPU on next tick
        this.waitForNextTick().then(() =>
          this.particles.syncToGPU(this.resources)
        );
        this.shouldSyncNextTick = false;
      }
    } else {
      // When paused, handle particle sync but skip simulation
      if (!this.shouldSyncNextTick) {
        this.shouldSyncNextTick = true;
        this.particles.syncFromGPU(this.resources).catch(console.error);
      }
    }

    // Render all modules in order according to render[] array
    this.renderScene();

    // Present scene to canvas
    this.presentToCanvas();

    // Continue animation loop
    this.animationId = requestAnimationFrame(this.animate);
  };

  private runForcePass(dt: number): void {
    const gl = this.resources.getGL();
    // Force program depends on which force modules are enabled.
    // Modules start disabled at engine init, so build lazily and rebuild on toggles.
    const enabledForceNames = this.modules
      .filter((m) => m.role === "force" && m.isEnabled())
      .map((m) => m.name)
      .sort()
      .join("|");
    if (enabledForceNames && enabledForceNames !== this.forceProgramSignature) {
      this.buildForceShader();
    }
    const program = this.resources.getProgram("forces");
    if (!program) return; // Still no forces to apply (none enabled / none supported)

    gl.useProgram(program);

    // Set up to render to the "other" particle texture
    const targetFbo = this.resources.getOtherParticleFramebuffer();
    const sourceTex = this.resources.getCurrentParticleTexture();

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);

    // Calculate texture size
    const texelsNeeded = this.bufferMaxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));

    gl.viewport(0, 0, texSize, texSize);

    // Bind source particle texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);

    // Set base uniforms
    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const dtLoc = gl.getUniformLocation(program, "u_dt");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texSize, 1.0 / texSize);
    gl.uniform1f(dtLoc, dt);
    gl.uniform1i(countLoc, this.getCount());

    // Set view uniforms for grid calculations
    const snapshot = this.view.getSnapshot();
    const size = this.view.getSize();
    const offsetLoc = gl.getUniformLocation(program, "u_viewOffset");
    const zoomLoc = gl.getUniformLocation(program, "u_viewZoom");
    const sizeLoc = gl.getUniformLocation(program, "u_viewSize");

    gl.uniform2f(offsetLoc, snapshot.cx, snapshot.cy);
    gl.uniform1f(zoomLoc, snapshot.zoom);
    gl.uniform2f(sizeLoc, size.width, size.height);

    // Set module-specific uniforms
    const forceModules = this.modules.filter(
      (m) => m.role === "force" && m.isEnabled()
    );
    for (const module of forceModules) {
      const inputs = module.read();
      for (const [key, value] of Object.entries(inputs)) {
        const uniformName = `u_${module.name}_${key}`;
        const loc = gl.getUniformLocation(program, uniformName);
        if (loc !== null) {
          gl.uniform1f(loc, value as number);
        }
      }
    }

    // Set up vertex attributes
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Cleanup
    gl.disableVertexAttribArray(positionLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Swap particle textures (ping-pong)
    this.resources.swapParticleTextures();
  }

  private runConstrainPass(dt: number): void {
    const gl = this.resources.getGL();

    const enabledConstrainNames = this.modules
      .filter((m) => m.role === "force" && m.isEnabled())
      .filter((m) => {
        try {
          const d = m.webgl2() as any;
          return !!d?.constrain;
        } catch {
          return false;
        }
      })
      .map((m) => m.name)
      .sort()
      .join("|");

    if (
      enabledConstrainNames &&
      enabledConstrainNames !== this.constrainProgramSignature
    ) {
      this.buildConstrainShader();
    }

    const program = this.resources.getProgram("constrain");
    if (!program) return; // No constraints to run

    gl.useProgram(program);

    const targetFbo = this.resources.getOtherParticleFramebuffer();
    const sourceTex = this.resources.getCurrentParticleTexture();
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);

    const texelsNeeded = this.bufferMaxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));
    gl.viewport(0, 0, texSize, texSize);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);

    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const dtLoc = gl.getUniformLocation(program, "u_dt");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texSize, 1.0 / texSize);
    gl.uniform1f(dtLoc, dt);
    gl.uniform1i(countLoc, this.getCount());

    // View uniforms for GRID_* helpers
    const snapshot = this.view.getSnapshot();
    const size = this.view.getSize();
    const offsetLoc = gl.getUniformLocation(program, "u_viewOffset");
    const zoomLoc = gl.getUniformLocation(program, "u_viewZoom");
    const sizeLoc = gl.getUniformLocation(program, "u_viewSize");
    gl.uniform2f(offsetLoc, snapshot.cx, snapshot.cy);
    gl.uniform1f(zoomLoc, snapshot.zoom);
    gl.uniform2f(sizeLoc, size.width, size.height);

    // Global maxSize uniform
    const maxSizeLoc = gl.getUniformLocation(program, "u_maxSize");
    gl.uniform1f(maxSizeLoc, this.getMaxSize());

    // Module-specific uniforms
    const modules = this.modules.filter((m) => m.role === "force" && m.isEnabled());
    for (const module of modules) {
      const inputs = module.read();
      for (const [key, value] of Object.entries(inputs)) {
        const uniformName = `u_${module.name}_${key}`;
        const loc = gl.getUniformLocation(program, uniformName);
        if (loc !== null) {
          gl.uniform1f(loc, value as number);
        }
      }
    }

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(positionLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.resources.swapParticleTextures();
  }

  private runIntegrationPass(dt: number): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("integrate");
    if (!program) return;

    gl.useProgram(program);

    // Set up to render to the "other" particle texture
    const targetFbo = this.resources.getOtherParticleFramebuffer();
    const sourceTex = this.resources.getCurrentParticleTexture();

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);

    // Calculate texture size
    const texelsNeeded = this.bufferMaxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));

    gl.viewport(0, 0, texSize, texSize);

    // Bind source particle texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);

    // Set uniforms
    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const dtLoc = gl.getUniformLocation(program, "u_dt");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texSize, 1.0 / texSize);
    gl.uniform1f(dtLoc, dt);
    gl.uniform1i(countLoc, this.getCount());

    // Set up vertex attributes
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Cleanup
    gl.disableVertexAttribArray(positionLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Swap particle textures (ping-pong)
    this.resources.swapParticleTextures();
  }

  /**
   * Main scene rendering method that processes all render modules in order.
   * Render modules are processed in the order defined by the render[] array.
   * Special handling for Trails (handles background), Particles, and Lines modules.
   */
  private renderScene(): void {
    const gl = this.resources.getGL();
    const size = this.view.getSize();

    // Get render modules in order
    const renderModules = this.modules.filter((m) => m.role === "render");

    // Check if trails module exists and is enabled (handles background)
    const trailsModule = renderModules.find((m) => m.name === "trails");
    const hasActiveTrails = trailsModule && trailsModule.isEnabled();

    // If trails is active, run it first (it handles the background)
    if (hasActiveTrails) {
      this.renderTrails(trailsModule!);
    } else {
      // Clear scene to clearColor if no trails
      const sceneFbo = this.resources.getCurrentSceneFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      gl.viewport(0, 0, size.width, size.height);
      const c = this.clearColor;
      gl.clearColor(c.r, c.g, c.b, c.a);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Process remaining render modules in order
    for (const module of renderModules) {
      if (!module.isEnabled()) continue;
      if (module.name === "trails") continue; // Already handled

      if (module.name === "particles") {
        this.renderParticlesModule(module);
      } else if (module.name === "lines") {
        this.renderLinesModule(module);
      }
      // Other render modules can be added here
    }
  }

  /**
   * Render particles module
   */
  private renderParticlesModule(particlesModule: Module): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("particles");
    if (!program) return;

    // Render to current scene framebuffer
    const sceneFbo = this.resources.getCurrentSceneFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);

    const size = this.view.getSize();
    gl.viewport(0, 0, size.width, size.height);

    gl.useProgram(program);

    // Bind particle texture
    const particleTex = this.resources.getCurrentParticleTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, particleTex);

    // Set uniforms
    const texelsNeeded = this.bufferMaxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));

    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texSize, 1.0 / texSize);
    gl.uniform1i(countLoc, this.getCount());

    // View uniforms
    const snapshot = this.view.getSnapshot();
    const offsetLoc = gl.getUniformLocation(program, "u_viewOffset");
    const zoomLoc = gl.getUniformLocation(program, "u_viewZoom");
    const sizeLoc = gl.getUniformLocation(program, "u_viewSize");

    gl.uniform2f(offsetLoc, snapshot.cx, snapshot.cy);
    gl.uniform1f(zoomLoc, snapshot.zoom);
    gl.uniform2f(sizeLoc, size.width, size.height);

    // Particles module uniforms
    const colorType = particlesModule.readValue("colorType");
    const customColorR = particlesModule.readValue("customColorR");
    const customColorG = particlesModule.readValue("customColorG");
    const customColorB = particlesModule.readValue("customColorB");
    const hue = particlesModule.readValue("hue");

    const colorTypeLoc = gl.getUniformLocation(program, "u_colorType");
    const customColorLoc = gl.getUniformLocation(program, "u_customColor");
    const hueLoc = gl.getUniformLocation(program, "u_hue");

    gl.uniform1f(colorTypeLoc, colorType);
    gl.uniform3f(customColorLoc, customColorR, customColorG, customColorB);
    gl.uniform1f(hueLoc, hue);

    // Enable alpha blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw particles as points (using vertex ID to fetch data)
    gl.drawArrays(gl.POINTS, 0, this.getCount());

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Render trails module (decay + diffuse passes)
   * Trails handles its own background by decaying toward clear color.
   */
  private renderTrails(trailsModule: Module): void {
    const gl = this.resources.getGL();
    const size = this.view.getSize();

    // Read trails settings
    const trailDecay = trailsModule.readValue("trailDecay");
    const trailDiffuse = trailsModule.readValue("trailDiffuse");

    // Pass 1: Decay - fade scene toward background color
    const decayProgram = this.resources.getProgram("trails_decay");
    if (decayProgram) {
      gl.useProgram(decayProgram);

      // Render to "other" scene texture
      const targetFbo = this.resources.getOtherSceneFramebuffer();
      const sourceTex = this.resources.getCurrentSceneTexture();

      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
      gl.viewport(0, 0, size.width, size.height);

      // Bind source scene texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);

      // Set uniforms
      const sceneTexLoc = gl.getUniformLocation(decayProgram, "u_sceneTexture");
      const decayLoc = gl.getUniformLocation(decayProgram, "u_trailDecay");
      const clearColorLoc = gl.getUniformLocation(decayProgram, "u_clearColor");

      gl.uniform1i(sceneTexLoc, 0);
      gl.uniform1f(decayLoc, trailDecay);
      gl.uniform3f(
        clearColorLoc,
        this.clearColor.r,
        this.clearColor.g,
        this.clearColor.b
      );

      // Draw fullscreen quad
      const positionLoc = gl.getAttribLocation(decayProgram, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(positionLoc);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Swap scene textures
      this.resources.swapSceneTextures();
    }

    // Pass 2: Diffuse (blur) - only if trailDiffuse > 0
    if (trailDiffuse > 0) {
      const diffuseProgram = this.resources.getProgram("trails_diffuse");
      if (diffuseProgram) {
        gl.useProgram(diffuseProgram);

        // Render to "other" scene texture
        const targetFbo = this.resources.getOtherSceneFramebuffer();
        const sourceTex = this.resources.getCurrentSceneTexture();

        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
        gl.viewport(0, 0, size.width, size.height);

        // Bind source scene texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTex);

        // Set uniforms
        const sceneTexLoc = gl.getUniformLocation(
          diffuseProgram,
          "u_sceneTexture"
        );
        const diffuseLoc = gl.getUniformLocation(
          diffuseProgram,
          "u_trailDiffuse"
        );
        const sceneSizeLoc = gl.getUniformLocation(
          diffuseProgram,
          "u_sceneSize"
        );

        gl.uniform1i(sceneTexLoc, 0);
        gl.uniform1f(diffuseLoc, trailDiffuse);
        gl.uniform2f(sceneSizeLoc, size.width, size.height);

        // Draw fullscreen quad
        const positionLoc = gl.getAttribLocation(diffuseProgram, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(positionLoc);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Swap scene textures
        this.resources.swapSceneTextures();
      }
    }
  }

  /**
   * Render lines module using instanced rendering.
   * Each line is a quad between two particle positions.
   */
  private renderLinesModule(linesModule: Module): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("lines");
    if (!program || !this.lineQuadBuffer) return;

    // Get line indices arrays
    const aIndexes = linesModule.readArray("aIndexes") as number[];
    const bIndexes = linesModule.readArray("bIndexes") as number[];

    const lineCount = Math.min(aIndexes.length, bIndexes.length);
    if (lineCount === 0) return;

    // Update line indices textures
    this.updateLineIndicesTextures(aIndexes, bIndexes, lineCount);
    if (!this.lineIndicesTextureA || !this.lineIndicesTextureB) return;

    const size = this.view.getSize();
    const snapshot = this.view.getSnapshot();

    // Render to current scene framebuffer
    const sceneFbo = this.resources.getCurrentSceneFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.viewport(0, 0, size.width, size.height);

    gl.useProgram(program);

    // Calculate particle texture size
    const texelsNeeded = this.bufferMaxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));

    // Bind particle texture (texture unit 0)
    const particleTex = this.resources.getCurrentParticleTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, particleTex);

    // Bind line indices textures (texture units 1 and 2)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureA);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureB);

    // Set uniforms
    const particleTexLoc = gl.getUniformLocation(program, "u_particleTexture");
    const texelSizeLoc = gl.getUniformLocation(program, "u_texelSize");
    const countLoc = gl.getUniformLocation(program, "u_particleCount");
    const viewOffsetLoc = gl.getUniformLocation(program, "u_viewOffset");
    const viewZoomLoc = gl.getUniformLocation(program, "u_viewZoom");
    const viewSizeLoc = gl.getUniformLocation(program, "u_viewSize");

    gl.uniform1i(particleTexLoc, 0);
    gl.uniform2f(texelSizeLoc, 1.0 / texSize, 1.0 / texSize);
    gl.uniform1i(countLoc, this.getCount());
    gl.uniform2f(viewOffsetLoc, snapshot.cx, snapshot.cy);
    gl.uniform1f(viewZoomLoc, snapshot.zoom);
    gl.uniform2f(viewSizeLoc, size.width, size.height);

    // Line indices textures
    const lineIndicesALoc = gl.getUniformLocation(program, "u_lineIndicesA");
    const lineIndicesBLoc = gl.getUniformLocation(program, "u_lineIndicesB");
    const lineCountLoc = gl.getUniformLocation(program, "u_lineCount");
    const lineIndicesTexelSizeLoc = gl.getUniformLocation(
      program,
      "u_lineIndicesTexelSize"
    );

    gl.uniform1i(lineIndicesALoc, 1);
    gl.uniform1i(lineIndicesBLoc, 2);
    gl.uniform1i(lineCountLoc, lineCount);
    gl.uniform2f(
      lineIndicesTexelSizeLoc,
      1.0 / this.lineIndicesTexSize,
      1.0 / this.lineIndicesTexSize
    );

    // Lines module uniforms
    const lineWidth = linesModule.readValue("lineWidth");
    const lineColorR = linesModule.readValue("lineColorR");
    const lineColorG = linesModule.readValue("lineColorG");
    const lineColorB = linesModule.readValue("lineColorB");

    const lineWidthLoc = gl.getUniformLocation(program, "u_lineWidth");
    const lineColorRLoc = gl.getUniformLocation(program, "u_lineColorR");
    const lineColorGLoc = gl.getUniformLocation(program, "u_lineColorG");
    const lineColorBLoc = gl.getUniformLocation(program, "u_lineColorB");

    gl.uniform1f(lineWidthLoc, lineWidth);
    gl.uniform1f(lineColorRLoc, lineColorR);
    gl.uniform1f(lineColorGLoc, lineColorG);
    gl.uniform1f(lineColorBLoc, lineColorB);

    // Set up vertex attributes for quad corners
    const quadCornerLoc = gl.getAttribLocation(program, "a_quadCorner");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineQuadBuffer);
    gl.enableVertexAttribArray(quadCornerLoc);
    gl.vertexAttribPointer(quadCornerLoc, 1, gl.FLOAT, false, 0, 0);

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw instanced line quads (4 vertices per quad, using triangle strip)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lineCount);

    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(quadCornerLoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Update line indices textures for instanced rendering.
   * Stores aIndexes and bIndexes in separate R32F textures.
   */
  private updateLineIndicesTextures(
    aIndexes: number[],
    bIndexes: number[],
    lineCount: number
  ): void {
    const gl = this.resources.getGL();

    // Calculate texture size (square texture)
    const neededSize = Math.ceil(Math.sqrt(lineCount));
    const texSize = Math.max(1, neededSize);

    // Recreate textures if size changed
    if (texSize !== this.lineIndicesTexSize) {
      // Delete old textures
      if (this.lineIndicesTextureA) gl.deleteTexture(this.lineIndicesTextureA);
      if (this.lineIndicesTextureB) gl.deleteTexture(this.lineIndicesTextureB);

      // Create new textures (R32F for single float per texel)
      this.lineIndicesTextureA = gl.createTexture();
      this.lineIndicesTextureB = gl.createTexture();
      this.lineIndicesTexSize = texSize;

      if (this.lineIndicesTextureA) {
        gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureA);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R32F,
          texSize,
          texSize,
          0,
          gl.RED,
          gl.FLOAT,
          null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }

      if (this.lineIndicesTextureB) {
        gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureB);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R32F,
          texSize,
          texSize,
          0,
          gl.RED,
          gl.FLOAT,
          null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    }

    // Upload line indices data
    const totalPixels = texSize * texSize;
    const dataA = new Float32Array(totalPixels);
    const dataB = new Float32Array(totalPixels);

    for (let i = 0; i < lineCount; i++) {
      dataA[i] = aIndexes[i];
      dataB[i] = bIndexes[i];
    }

    if (this.lineIndicesTextureA) {
      gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureA);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        texSize,
        texSize,
        gl.RED,
        gl.FLOAT,
        dataA
      );
    }

    if (this.lineIndicesTextureB) {
      gl.bindTexture(gl.TEXTURE_2D, this.lineIndicesTextureB);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        texSize,
        texSize,
        gl.RED,
        gl.FLOAT,
        dataB
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private presentToCanvas(): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("copy");
    if (!program) return;

    gl.useProgram(program);

    // Render to canvas (default framebuffer)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const size = this.view.getSize();
    gl.viewport(0, 0, size.width, size.height);

    // Bind current scene texture
    const sceneTex = this.resources.getCurrentSceneTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);

    const sceneTexLoc = gl.getUniformLocation(program, "u_sceneTexture");
    gl.uniform1i(sceneTexLoc, 0);

    // Set up vertex attributes
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Cleanup
    gl.disableVertexAttribArray(positionLoc);
  }

  private waitForNextTick(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  // Override export to use modules
  export(): Record<string, Record<string, number>> {
    const settings: Record<string, Record<string, number>> = {};
    for (const module of this.modules) {
      const moduleData = module.read();
      settings[module.name] = moduleData as Record<string, number>;
    }
    return settings;
  }

  protected onModuleSettingsChanged(): void {
    // No GPU uniform sync needed yet in US-003
  }

  protected onClearColorChanged(): void {
    // Clear color changes don't require immediate updates
  }

  protected onCellSizeChanged(): void {
    this.grid.setCellSize(this.cellSize);
    this.grid.resizeIfNeeded(this.view.getSnapshot(), this.resources);
  }

  protected onConstrainIterationsChanged(): void {
    // No constraint iterations in baseline simulation
  }

  protected onMaxNeighborsChanged(): void {
    // Neighbor count affects neighbor iteration but doesn't require rebuild
  }

  protected onMaxParticlesChanged(): void {
    // Max particles affects effective count; no immediate rebuild needed
  }
}
