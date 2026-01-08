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
import {
  fullscreenVertexShader,
  integrateFragmentShader,
  particleVertexShader,
  particleFragmentShader,
  copyVertexShader,
  copyFragmentShader,
} from "./shaders";

export class WebGL2Engine extends AbstractEngine {
  private resources: GL2Resources;
  private particles: ParticleStore;
  private bufferMaxParticles: number;
  private animationId: number | null = null;
  private shouldSyncNextTick: boolean = false;
  private quadBuffer: WebGLBuffer | null = null;

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
    await this.resources.dispose();
  }

  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.resources.canvas.width = width;
    this.resources.canvas.height = height;
    this.resources.createSceneTextures(width, height);
  }

  protected onViewChanged(): void {
    // WebGL2 doesn't need to update grid here (no grid yet in US-003)
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

  private animate = (): void => {
    const dt = this.getTimeDelta();
    this.updateFPS(dt);

    // Only run simulation when playing
    if (this.playing) {
      this.updateOscillators(dt);

      // Run simulation pass: integrate velocity/position, reset acceleration
      this.runIntegrationPass(dt);

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

    // Always render particles to keep displaying current state
    this.renderParticles();

    // Present scene to canvas
    this.presentToCanvas();

    // Continue animation loop
    this.animationId = requestAnimationFrame(this.animate);
  };

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

  private renderParticles(): void {
    const gl = this.resources.getGL();
    const program = this.resources.getProgram("particles");
    if (!program) return;

    gl.useProgram(program);

    // Render to current scene framebuffer
    const sceneFbo = this.resources.getCurrentSceneFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);

    const size = this.view.getSize();
    gl.viewport(0, 0, size.width, size.height);

    // Clear scene
    const c = this.clearColor;
    gl.clearColor(c.r, c.g, c.b, c.a);
    gl.clear(gl.COLOR_BUFFER_BIT);

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

    // Draw particles as points (using vertex ID to fetch data)
    gl.drawArrays(gl.POINTS, 0, this.getCount());

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    // No spatial grid yet in US-003
  }

  protected onConstrainIterationsChanged(): void {
    // No constraint iterations in baseline simulation
  }

  protected onMaxNeighborsChanged(): void {
    // No neighbor queries yet in US-003
  }

  protected onMaxParticlesChanged(): void {
    // Max particles affects effective count; no immediate rebuild needed
  }
}
