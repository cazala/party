import { Module, type ModuleDescriptor } from "./module";
import { DEFAULTS } from "./config";
import { GPUResources } from "./runtime/gpu-resources";
import { runRenderPasses } from "./runtime/render-runner";
import { runSimulationPasses } from "./runtime/simulation-runner";
import { ModuleRole, RenderModuleDescriptor } from "./module";
import { buildProgram, type Program } from "./builder/module-builder";
import { Vector } from "./vector";

export type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type WebGPUParticle = {
  position: Vector;
  velocity: Vector;
  size: number;
  mass: number;
  color: Color;
};

export interface RenderUniforms {
  canvasSize: [number, number];
  cameraPosition: [number, number];
  zoom: number;
}

export class WebGPUParticleSystem {
  // Render
  public canvas: HTMLCanvasElement;

  // Simulation
  private size: { width: number; height: number };
  private modules: readonly Module<string, string, any>[];
  private camera = { x: 0, y: 0 };
  private zoom = 1;
  private animationId: number | null = null;
  private isPlaying = false;
  private lastTime = 0;
  private particleCount: number = 0;
  private maxParticles: number = DEFAULTS.maxParticles;
  private constrainIterations: number = 50;

  // Simulation + Render
  private program: Program | null = null;
  private moduleUniformState: Record<string, number>[] = [];
  private resources: GPUResources;

  // Grid
  private gridCells: number = 0;
  private gridMaxPerCell: number = 0;
  private lastView: {
    width: number;
    height: number;
    cx: number;
    cy: number;
    zoom: number;
  } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    size: { width: number; height: number },
    modules: readonly Module<string, string, any>[]
  ) {
    this.resources = new GPUResources({ canvas });
    this.canvas = canvas;
    this.size = size;
    this.modules = modules;
  }

  // Simulation + Render
  async initialize(): Promise<void> {
    // initialize resources
    await this.resources.initialize();

    // Build compute program and allocate core resources
    this.program = buildProgram(this.modules);
    this.resources.createParticleBuffer(this.maxParticles, 12);
    this.resources.createModuleUniformBuffers(this.program.layouts);
    this.resources.createRenderUniformBuffer(24);
    if (this.program.extraBindings.simState) {
      this.resources.createSimStateBuffer(this.maxParticles, 4);
    }

    // Build compute bind group layout once
    this.resources.buildComputeLayouts(this.program);

    // Build simulation pipelines once
    this.resources.buildComputePipelines(this.program.code);
    this.resources.ensureSceneTextures(this.size.width, this.size.height);

    // Initialize CPU-side uniform state maps from compute layouts
    this.moduleUniformState = this.program.layouts.map((layout) => {
      const state: Record<string, number> = {};
      for (const key of Object.keys(layout.mapping)) state[key] = 0;
      if (layout.moduleName !== "simulation" && "enabled" in layout.mapping) {
        state["enabled"] = 1;
      }
      return state;
    });
    // Seed simStride if present
    const simIdx = this.program.layouts.findIndex(
      (l) => l.moduleName === "simulation"
    );
    if (simIdx !== -1 && this.program.layouts[simIdx].mapping["simStride"]) {
      this.moduleUniformState[simIdx]["simStride"] =
        this.program.simStateStride;
    }

    // Configure grid storage and uniforms using current renderer view
    this.configureGrid(this.size.width, this.size.height);

    // Attach per-module uniform writers to modules
    this.modules.forEach((mod) => {
      const name = mod.descriptor().name;
      const writer = (values: Partial<Record<string, number>>) => {
        this.writeModuleUniform(name, values);
      };
      mod.attachUniformWriter(writer);

      // Attach a reader so modules can implement getters
      const reader = () => {
        const idx = this.getModuleIndex(name);
        return { ...this.moduleUniformState[idx] };
      };
      // attach typed reader without using any
      mod.attachUniformReader(reader);
    });
  }

  // Grid
  private configureGrid(width: number, height: number): void {
    const zoom = this.zoom;
    const halfW = width / (2 * Math.max(zoom, 0.0001));
    const halfH = height / (2 * Math.max(zoom, 0.0001));
    const minX = this.camera.x - halfW;
    const maxX = this.camera.x + halfW;
    const minY = this.camera.y - halfH;
    const maxY = this.camera.y + halfH;
    this.lastView = {
      width,
      height,
      cx: this.camera.x,
      cy: this.camera.y,
      zoom,
    };
    const cellSize = 16;
    const cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    const rows = Math.max(1, Math.ceil((maxY - minY) / cellSize));
    const maxPerCell = 256;
    this.gridCells = cols * rows;
    this.gridMaxPerCell = maxPerCell;

    // Recreate grid storage buffers sized to the new grid
    this.resources.createGridStorage(this.gridCells, this.gridMaxPerCell);
    // grid storage buffers remain managed in GPUResources

    // Seed grid uniforms directly (grid is not a module)
    const gridIdx = this.program!.layouts.findIndex(
      (l) => l.moduleName === "grid"
    );
    if (gridIdx !== -1) {
      const layout = this.program!.layouts[gridIdx];
      const values = new Float32Array(layout.vec4Count * 4);
      const mapping = layout.mapping as Record<string, { flatIndex: number }>;
      values[mapping.minX.flatIndex] = minX;
      values[mapping.minY.flatIndex] = minY;
      values[mapping.maxX.flatIndex] = maxX;
      values[mapping.maxY.flatIndex] = maxY;
      values[mapping.cols.flatIndex] = cols;
      values[mapping.rows.flatIndex] = rows;
      values[mapping.cellSize.flatIndex] = cellSize;
      values[mapping.maxPerCell.flatIndex] = maxPerCell;
      this.resources.writeModuleUniform(gridIdx, values);
    }
  }

  // Grid
  private resizeGrid(width: number, height: number): void {
    if (
      this.lastView &&
      this.lastView.width === width &&
      this.lastView.height === height &&
      this.lastView.cx === this.camera.x &&
      this.lastView.cy === this.camera.y &&
      this.lastView.zoom === this.zoom
    ) {
      return;
    }
    this.configureGrid(width, height);
  }

  // Simulation
  setConstrainIterations(iters: number): void {
    this.constrainIterations = Math.max(1, Math.floor(iters));
  }

  // Simulation + Render
  setSize(width: number, height: number): void {
    this.size = { width, height };
    this.resources.canvas.width = width;
    this.resources.canvas.height = height;
    this.resources.ensureSceneTextures(width, height);
    this.resizeGrid(width, height);
  }

  // Simulation
  setParticles(particles: WebGPUParticle[]): void {
    const clampedParticles = particles.slice(0, this.maxParticles);
    this.particleCount = clampedParticles.length;
    this.updateParticleBuffer(clampedParticles);
  }

  // Simulation
  addParticle(particle: WebGPUParticle): void {
    if (this.particleCount >= this.maxParticles) return;

    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const offsetFloats = this.particleCount * STRIDE;
    const data = new Float32Array(STRIDE);
    data[0] = particle.position.x;
    data[1] = particle.position.y;
    data[2] = particle.velocity.x;
    data[3] = particle.velocity.y;
    data[4] = 0; // ax
    data[5] = 0; // ay
    data[6] = particle.size ?? 5;
    data[7] = particle.mass ?? 1;
    const c = particle.color ?? { r: 1, g: 1, b: 1, a: 1 };
    data[8] = c.r;
    data[9] = c.g;
    data[10] = c.b;
    data[11] = c.a;

    // Write only the slice for the new particle
    this.resources.writeParticleSlice(offsetFloats, data);
    this.particleCount = this.particleCount + 1;
  }

  // Simulation
  private updateParticleBuffer(particles: WebGPUParticle[]): void {
    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const data = new Float32Array(particles.length * STRIDE);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const offset = i * STRIDE;
      data[offset] = particle.position.x;
      data[offset + 1] = particle.position.y;
      data[offset + 2] = particle.velocity.x;
      data[offset + 3] = particle.velocity.y;
      // acceleration starts at zero
      data[offset + 4] = 0;
      data[offset + 5] = 0;
      data[offset + 6] = particle.size;
      data[offset + 7] = particle.mass;
      const c = particle.color ?? { r: 1, g: 1, b: 1, a: 1 };
      data[offset + 8] = c.r;
      data[offset + 9] = c.g;
      data[offset + 10] = c.b;
      data[offset + 11] = c.a;
    }

    // Write to storage buffer
    this.resources.writeParticleBuffer(data);
  }

  // Simulation + Render
  private getModuleIndex(name: string): number {
    return (this.modules as readonly Module<string, string, any>[]).findIndex(
      (module) => module.descriptor().name === name
    );
  }

  // Render
  private copySceneTextureToCanvas(
    commandEncoder: GPUCommandEncoder,
    canvasView: GPUTextureView,
    sourceView?: GPUTextureView
  ): void {
    const pipeline = this.resources.getCopyPipeline(this.resources.format);
    const bindGroup = this.resources.getDevice().createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: sourceView ?? this.resources.getCurrentSceneTextureView(),
        },
        { binding: 1, resource: this.resources.getSceneSampler() },
      ],
    });
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          clearValue: DEFAULTS.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4, 1);
    pass.end();
  }

  // Simulation + Render
  private writeModuleUniform(
    moduleName: string,
    values: Partial<Record<string, number>>
  ): void {
    const idx = this.getModuleIndex(moduleName);
    if (idx === -1) return;
    const layout = this.program!.layouts[idx];
    // Merge into state to avoid zeroing unspecified fields
    const state = this.moduleUniformState[idx];
    for (const [key, value] of Object.entries(values)) {
      state[key] = value as number;
    }
    const data = new Float32Array(layout.vec4Count * 4);
    for (const [key, map] of Object.entries(layout.mapping)) {
      data[(map as { flatIndex: number }).flatIndex] = state[key] ?? 0;
    }

    this.resources.writeModuleUniform(idx, data);
  }

  // Render
  private writeRenderUniform(uniforms: RenderUniforms): void {
    const data = new Float32Array([
      uniforms.canvasSize[0],
      uniforms.canvasSize[1],
      uniforms.cameraPosition[0],
      uniforms.cameraPosition[1],
      uniforms.zoom,
      0, // padding
    ]);

    this.resources.writeRenderUniforms(data);
  }

  // Simulation
  private update(deltaTime: number): void {
    this.writeModuleUniform("simulation", {
      dt: deltaTime,
      count: this.particleCount,
    });
  }

  // Simulation + Render
  private render(
    canvasSize: [number, number],
    cameraPosition: [number, number],
    zoom: number
  ): void {
    if (!this.program) {
      throw new Error("Compute program not built");
    }

    this.writeRenderUniform({ canvasSize, cameraPosition, zoom });

    // Create command encoder for rendering
    const commandEncoder = this.resources.getDevice().createCommandEncoder();

    // Run compute passes to build grid and integrate physics
    const workgroupSize = DEFAULTS.workgroupSize;
    runSimulationPasses(
      commandEncoder,
      this.resources.createComputeBindGroup(this.program),
      {
        gridClear: this.resources.getSimulationPipelines().gridClear,
        gridBuild: this.resources.getSimulationPipelines().gridBuild,
        state: this.resources.getSimulationPipelines().state,
        apply: this.resources.getSimulationPipelines().apply,
        integrate: this.resources.getSimulationPipelines().integrate,
        constrain: this.resources.getSimulationPipelines().constrain,
        correct: this.resources.getSimulationPipelines().correct,
        main: this.resources.getSimulationPipelines().main,
      },
      {
        particleCount: this.particleCount,
        gridCellCount: this.gridCells,
        workgroupSize,
        constrainIterations: this.constrainIterations,
      }
    );

    // Run render passes
    // Ensure textures sized, then execute via resources-backed render graph
    this.resources.ensureSceneTextures(this.size.width, this.size.height);

    // Filter render modules
    const modules = this.modules
      .map((m) => m.descriptor())
      .filter(
        (
          descriptor: ModuleDescriptor<string, string, any>,
          idx: number
        ): descriptor is RenderModuleDescriptor<string, string> =>
          descriptor.role === ModuleRole.Render && this.modules[idx].isEnabled()
      );

    // Execute render passes
    const lastView = runRenderPasses(
      commandEncoder,
      modules,
      this.resources.getCurrentSceneTextureView(),
      this.resources.getOtherSceneTextureView(),
      this.program!,
      this.resources,
      this.size,
      this.particleCount
    );

    // Copy to canvas and return
    const canvasViewNew = this.resources
      .getContext()
      .getCurrentTexture()
      .createView();

    this.copySceneTextureToCanvas(commandEncoder, canvasViewNew, lastView);

    // Submit render commands
    this.resources.getDevice().queue.submit([commandEncoder.finish()]);
  }

  // Simulation
  getParticleCount(): number {
    return this.particleCount;
  }

  // Simulation
  clear(): void {
    // Remove all particles
    this.particleCount = 0;

    // Clear scene textures so sensors and the next frame don't see stale data
    try {
      const encoder = this.resources.getDevice().createCommandEncoder();
      const passA = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.resources.getCurrentSceneTextureView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passA.end();
      const passB = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.resources.getOtherSceneTextureView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passB.end();
      this.resources.getDevice().queue.submit([encoder.finish()]);
    } catch (_) {
      // no-op if textures not ready
    }

    // Proactively clear the canvas once so last frame isn't left onscreen
    try {
      const commandEncoder = this.resources.getDevice().createCommandEncoder();
      const canvasView = this.resources
        .getContext()
        .getCurrentTexture()
        .createView();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasView,
            clearValue: DEFAULTS.clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.end();
      this.resources.getDevice().queue.submit([commandEncoder.finish()]);
    } catch (_) {
      // ignore if context not available yet
    }
  }

  // Simulation
  getSize(): { width: number; height: number } {
    return this.size;
  }

  // Simulation
  setCamera(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
    this.resizeGrid(this.size.width, this.size.height);
  }

  // Simulation
  getCamera(): { x: number; y: number } {
    return { ...this.camera };
  }

  // Simulation
  setZoom(zoom: number): void {
    // Clamp zoom to avoid excessive grid sizes that overflow storage buffer limits
    const size = this.getSize();
    const maxBytes = 120 * 1024 * 1024; // safety threshold below typical 128MB default
    const minZoomByGrid = Math.sqrt((4 * size.width * size.height) / maxBytes);
    const minZoom = Math.max(0.01, minZoomByGrid);
    const clamped = Math.max(minZoom, Math.min(zoom, 5));
    this.zoom = clamped;
    this.resizeGrid(this.size.width, this.size.height);
  }

  // Simulation
  getZoom(): number {
    return this.zoom;
  }

  // Simulation
  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTime = performance.now();
    this.animate();
  }

  // Simulation
  pause(): void {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Simulation
  private animate = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 1 / 30); // Cap at 30 FPS minimum
    this.lastTime = currentTime;

    // Keep grid/world extents in sync with current view
    this.resizeGrid(this.size.width, this.size.height);

    // Update physics via system
    this.update(deltaTime);

    // Render
    this.render(
      [this.size.width, this.size.height],
      [this.camera.x, this.camera.y],
      this.zoom
    );

    this.animationId = requestAnimationFrame(this.animate);
  };

  // Simulation
  getFPS(): number {
    return 60; // WebGPU runs at display refresh rate
  }

  // Simulation
  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Simulation
  reset(): void {
    this.pause();
    this.clear();
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
  }

  // Simulation + Render
  destroy(): void {
    this.pause();
    this.resources.dispose();
  }
}
