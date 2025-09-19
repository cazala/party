import type { WebGPURenderer } from "./WebGPURenderer";
import { Module, type ModuleDescriptor } from "./shaders/compute";
import { type ComputeProgramBuild } from "./shaders/builder/compute-builder";
import { DEFAULTS } from "./config";
import { GPUResources, ModuleUniformBuffer } from "./runtime/gpu-resources";
import { runRenderPasses } from "./runtime/render-runner";
import { runSimulationPasses } from "./runtime/simulation-runner";
import { WebGPUEngine } from "./engine/WebGPUEngine";
import { ModuleRole, RenderModuleDescriptor } from "./shaders/descriptors";

export interface WebGPUParticle {
  position: [number, number];
  velocity: [number, number];
  size: number;
  mass: number;
  color: [number, number, number, number];
}

// Module-specific uniform interfaces are kept internal; uniforms are written dynamically.

export interface RenderUniforms {
  canvasSize: [number, number];
  cameraPosition: [number, number];
  zoom: number;
}

export class WebGPUParticleSystem {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private resources: GPUResources;
  private engine: WebGPUEngine;

  private particleBuffer: GPUBuffer | null = null; // TODO: migrate to GPUResources
  private moduleUniformBuffers: ModuleUniformBuffer[] = []; // TODO: migrate to GPUResources
  private moduleUniformState: Record<string, number>[] = [];
  private renderUniformBuffer: GPUBuffer | null = null; // TODO: migrate to GPUResources

  private computeBindGroup: GPUBindGroup | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;

  private computePipeline: GPUComputePipeline | null = null;
  private gridClearPipeline: GPUComputePipeline | null = null;
  private gridBuildPipeline: GPUComputePipeline | null = null;
  private statePipeline: GPUComputePipeline | null = null;
  private applyPipeline: GPUComputePipeline | null = null;
  private integratePipeline: GPUComputePipeline | null = null;
  private correctPipeline: GPUComputePipeline | null = null;
  private constrainPipeline: GPUComputePipeline | null = null;

  private particleCount: number = 0;
  private maxParticles: number = DEFAULTS.maxParticles;

  private computeBuild: ComputeProgramBuild | null = null;

  // Grid buffers
  // Grid and sim state buffers are managed by GPUResources
  private gridCells: number = 0;
  private gridMaxPerCell: number = 0;
  // Track last view to detect changes and avoid unnecessary uniform/buffer updates
  private lastView: {
    width: number;
    height: number;
    cx: number;
    cy: number;
    zoom: number;
  } | null = null;

  // Constraint solver iterations per frame
  private constrainIterations: number = 50;

  // Scene helpers now delegated to GPUResources
  private getCurrentSceneTextureView(): GPUTextureView {
    return this.resources.getCurrentSceneTextureView();
  }
  private getOtherSceneTextureView(): GPUTextureView {
    return this.resources.getOtherSceneTextureView();
  }
  private getSceneSampler(): GPUSampler {
    return this.resources.getSceneSampler();
  }
  // swapSceneTextures no longer needed; render-graph runner swaps views

  // Cache for render graph
  // Reserve for future caching (unused until render modules are implemented)
  // private renderComputePipelines: Map<string, GPUComputePipeline> = new Map();
  // private renderGraphicsPipelines: Map<string, GPURenderPipeline> = new Map();
  // Deprecated: sizing tracked by GPUResources.ensureSceneTextures
  // private sceneTexSize: { width: number; height: number } | null = null;

  private ensureSceneTexturesSized(): void {
    const size = this.renderer.getSize();
    this.resources.ensureSceneTextures(size.width, size.height);
  }

  private runRenderGraph(commandEncoder: GPUCommandEncoder): void {
    // Ensure textures sized, then execute via resources-backed render graph
    this.ensureSceneTexturesSized();

    const modules = this.modules
      .map((m) => m.descriptor())
      .filter(
        (
          descriptor: ModuleDescriptor<string, string, any>,
          idx: number
        ): descriptor is RenderModuleDescriptor<string, string> =>
          descriptor.role === ModuleRole.Render && this.modules[idx].isEnabled()
      );

    const lastView = runRenderPasses(
      commandEncoder,
      modules,
      this.getCurrentSceneTextureView(),
      this.getOtherSceneTextureView(),
      this.computeBuild!,
      this.resources,
      this.renderer,
      this.particleCount
    );

    // Copy to canvas and return
    const canvasViewNew = this.context.getCurrentTexture().createView();
    this.copyTrailToCanvas(commandEncoder, canvasViewNew, lastView);
    return;
  }

  constructor(
    private renderer: WebGPURenderer,
    private modules: readonly Module<string, string, any>[]
  ) {
    const webgpuDevice = renderer.getWebGPUDevice();
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error("WebGPU device not initialized");
    }
    this.device = webgpuDevice.device;
    this.context = webgpuDevice.context;
    this.resources = new GPUResources(this.device);
    this.engine = new WebGPUEngine(this.device, this.modules, {
      maxParticles: DEFAULTS.maxParticles,
    });
  }

  private static toDescriptor(
    m: Module<string, string, any>
  ): ModuleDescriptor<string, string, any> {
    return m.descriptor();
  }

  getModule<Name extends string>(
    name: Name
  ): Module<string, string, any> | undefined {
    const found = (this.modules as readonly Module<string, string, any>[]).find(
      (m) => {
        const d = WebGPUParticleSystem.toDescriptor(m);
        return d.name === name;
      }
    );
    return found;
  }

  setConstrainIterations(iters: number): void {
    this.constrainIterations = Math.max(1, Math.floor(iters));
  }

  async initialize(): Promise<void> {
    // Engine initializes core resources and compute build
    const size = this.renderer.getSize();
    this.engine.initialize(size.width, size.height);

    // Hydrate local references from engine/resources
    const engineResources = this.engine.getResources();
    this.resources = engineResources;
    const computeBuild = this.engine.getComputeBuild();
    if (computeBuild) {
      this.computeBuild = computeBuild;
    }
    this.particleBuffer = engineResources.getParticleBuffer();
    this.moduleUniformBuffers = engineResources.getModuleUniformBuffers();
    this.renderUniformBuffer = engineResources.getRenderUniformBuffer();

    // Initialize CPU-side uniform state maps from compute layouts
    if (this.computeBuild) {
      this.moduleUniformState = this.computeBuild.layouts.map((layout) => {
        const state: Record<string, number> = {};
        for (const key of Object.keys(layout.mapping)) state[key] = 0;
        if (layout.moduleName !== "simulation" && "enabled" in layout.mapping) {
          state["enabled"] = 1;
        }
        return state;
      });
      // Seed simStride if present
      const simIdx = this.computeBuild.layouts.findIndex(
        (l) => l.moduleName === "simulation"
      );
      if (
        simIdx !== -1 &&
        this.computeBuild.layouts[simIdx].mapping["simStride"]
      ) {
        this.moduleUniformState[simIdx]["simStride"] =
          this.computeBuild.simStateStride;
      }
    }

    // Configure grid storage and uniforms using current renderer view
    this.updateGridFromRenderer();

    // Pipelines and bind groups remain created here for now
    await this.createPipelines();
    this.createBindGroups();
    // Attach to renderer automatically
    this.renderer.attachSystem(this);

    // Attach per-module uniform writers to modules
    (this.modules as readonly Module<string, string>[]).forEach((mod) => {
      const name = WebGPUParticleSystem.toDescriptor(mod).name;
      const writer = (values: Partial<Record<string, number>>) => {
        this.writeUniform(name, values);
      };
      mod.attachUniformWriter(writer);

      // Attach a reader so modules can implement getters
      const reader = () => {
        const idx = this.getModuleIndex(name);
        return { ...this.moduleUniformState[idx] } as Partial<
          Record<string, number>
        >;
      };
      // attach typed reader without using any
      mod.attachUniformReader(reader);
    });
  }

  // createBuffers removed after engine/resources migration

  // createTrailTextures removed - handled by GPUResources.ensureSceneTextures

  private configureGrid(width: number, height: number): void {
    const cam = this.renderer.getCamera
      ? this.renderer.getCamera()
      : { x: 0, y: 0 };
    const zoom = this.renderer.getZoom ? this.renderer.getZoom() : 1;
    const halfW = width / (2 * Math.max(zoom, 0.0001));
    const halfH = height / (2 * Math.max(zoom, 0.0001));
    const minX = cam.x - halfW;
    const maxX = cam.x + halfW;
    const minY = cam.y - halfH;
    const maxY = cam.y + halfH;
    this.lastView = { width, height, cx: cam.x, cy: cam.y, zoom };
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
    const gridIdx = this.computeBuild!.layouts.findIndex(
      (l) => l.moduleName === "grid"
    );
    if (gridIdx !== -1) {
      const layout = this.computeBuild!.layouts[gridIdx];
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

    // Recreate compute bind group to include new storage buffers
    if (this.bindGroupLayout) {
      this.createBindGroups();
    }
  }

  updateGridForSize(width: number, height: number): void {
    const cam = this.renderer.getCamera
      ? this.renderer.getCamera()
      : { x: 0, y: 0 };
    const zoom = this.renderer.getZoom ? this.renderer.getZoom() : 1;
    if (
      this.lastView &&
      this.lastView.width === width &&
      this.lastView.height === height &&
      this.lastView.cx === cam.x &&
      this.lastView.cy === cam.y &&
      this.lastView.zoom === zoom
    ) {
      return;
    }
    this.configureGrid(width, height);
  }

  updateGridFromRenderer(): void {
    const size = this.renderer.getSize
      ? this.renderer.getSize()
      : { width: 800, height: 600 };
    this.updateGridForSize(size.width, size.height);
  }

  resize(width: number, height: number): void {
    // Resize scene textures early via engine/resources, and update grid
    try {
      this.engine.resize(width, height);
    } catch (_) {}
    this.resources.ensureSceneTextures(width, height);
    this.updateGridForSize(width, height);
  }

  private async createPipelines(): Promise<void> {
    // Compute pipelines and layouts are built in resources via engine

    // Render bind group layout provided by resources now

    // (No static particle canvas pipeline; render modules handle scene writes)

    // Create copy bind group layout (simpler - just texture and sampler)
    // Copy pipeline construction is handled in GPUResources

    // Copy pipeline/bind group managed per-frame using resources.getCopyPipeline

    // Create an explicit bind group layout and pipeline layout shared by all compute entry points
    if (!this.computeBuild) throw new Error("Compute program not built");
    this.bindGroupLayout = this.resources.getComputeBindGroupLayout();
    // Pipeline layout for compute pipelines is managed in resources

    // Compute pipelines are now built in resources/engine; fetch references
    const sim = this.resources.getSimulationPipelines();
    this.computePipeline = sim.monolithic || null;
    this.gridClearPipeline = sim.gridClear || null;
    this.gridBuildPipeline = sim.gridBuild || null;
    this.statePipeline = sim.state || null;
    this.applyPipeline = sim.apply || null;
    this.integratePipeline = sim.integrate || null;
    this.constrainPipeline = sim.constrain || null;
    this.correctPipeline = sim.correct || null;
  }

  private createBindGroups(): void {
    if (
      !this.particleBuffer ||
      this.moduleUniformBuffers.some((b) => !b) ||
      !this.renderUniformBuffer
    ) {
      throw new Error("Pipeline or buffers not created");
    }

    // Create compute bind group: particles storage + module uniforms
    if (!this.bindGroupLayout) {
      throw new Error("Bind group layout not created");
    }
    if (!this.computeBuild) throw new Error("Compute program not built");
    this.computeBindGroup = this.resources.createComputeBindGroup(
      this.computeBuild
    );
  }

  setParticles(particles: WebGPUParticle[]): void {
    const clampedParticles = particles.slice(0, this.maxParticles);
    this.particleCount = clampedParticles.length;
    this.updateParticleBuffer(clampedParticles);
  }

  addParticle(particle: WebGPUParticle): void {
    if (!this.particleBuffer) return;
    if (this.particleCount >= this.maxParticles) return;

    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const offsetFloats = this.particleCount * STRIDE;
    const data = new Float32Array(STRIDE);
    data[0] = particle.position[0];
    data[1] = particle.position[1];
    data[2] = particle.velocity?.[0] ?? 0;
    data[3] = particle.velocity?.[1] ?? 0;
    data[4] = 0; // ax
    data[5] = 0; // ay
    data[6] = particle.size ?? 5;
    data[7] = particle.mass ?? 1;
    const c = particle.color ?? [1, 1, 1, 1];
    data[8] = c[0];
    data[9] = c[1];
    data[10] = c[2];
    data[11] = c[3];

    // Write only the slice for the new particle
    this.resources.writeParticleSlice(offsetFloats, data);
    this.particleCount = this.particleCount + 1;
  }

  private updateParticleBuffer(particles: WebGPUParticle[]): void {
    if (!this.particleBuffer) return;

    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const data = new Float32Array(particles.length * STRIDE);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const offset = i * STRIDE;
      data[offset] = particle.position[0];
      data[offset + 1] = particle.position[1];
      data[offset + 2] = particle.velocity[0];
      data[offset + 3] = particle.velocity[1];
      // acceleration starts at zero
      data[offset + 4] = 0;
      data[offset + 5] = 0;
      data[offset + 6] = particle.size;
      data[offset + 7] = particle.mass;
      const c = particle.color ?? [1, 1, 1, 1];
      data[offset + 8] = c[0];
      data[offset + 9] = c[1];
      data[offset + 10] = c[2];
      data[offset + 11] = c[3];
    }

    // Write to storage buffer
    this.resources.writeParticleBuffer(data);
  }

  private getModuleIndex(name: string): number {
    return (this.modules as readonly Module<string, string, any>[]).findIndex(
      (m) => {
        const d = WebGPUParticleSystem.toDescriptor(m);
        return d.name === name;
      }
    );
  }

  // removed old trail helpers

  private copyTrailToCanvas(
    commandEncoder: GPUCommandEncoder,
    canvasView: GPUTextureView,
    sourceView?: GPUTextureView
  ): void {
    const pipeline = this.resources.getCopyPipeline(
      this.renderer.getWebGPUDevice().format
    );
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: sourceView ?? this.getCurrentSceneTextureView(),
        },
        { binding: 1, resource: this.getSceneSampler() },
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

  // removed scene clear helper; render modules own scene lifecycle

  private writeSimulationUniforms(
    deltaTime: number,
    particleCount: number
  ): void {
    const idx = this.getModuleIndex("simulation");
    if (idx === -1) return;
    const buf = this.moduleUniformBuffers[idx];
    if (!buf) return;
    const layout = this.computeBuild!.layouts[idx];
    // Merge into state
    this.moduleUniformState[idx]["dt"] = deltaTime;
    this.moduleUniformState[idx]["count"] = particleCount;
    // Build full vec array from state
    const values = new Float32Array(layout.vec4Count * 4);
    for (const [key, map] of Object.entries(layout.mapping)) {
      values[(map as unknown as { flatIndex: number }).flatIndex] =
        this.moduleUniformState[idx][key] ?? 0;
    }
    this.resources.writeModuleUniform(idx, values);
  }

  writeUniform(
    moduleName: string,
    values: Partial<Record<string, number>>
  ): void {
    const idx = this.getModuleIndex(moduleName);
    if (idx === -1) return;
    const buf = this.moduleUniformBuffers[idx];
    if (!buf) return;
    const layout = this.computeBuild!.layouts[idx];
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

  updateRender(uniforms: RenderUniforms): void {
    if (!this.renderUniformBuffer) return;

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

  update(deltaTime: number): void {
    this.writeSimulationUniforms(deltaTime, this.particleCount);
  }

  render(
    canvasSize: [number, number],
    cameraPosition: [number, number],
    zoom: number
  ): void {
    // Proceed even with 0 particles to ensure canvas clears and scene stays in sync

    this.updateRender({ canvasSize, cameraPosition, zoom });

    // Create command encoder for rendering
    const commandEncoder = this.device.createCommandEncoder();

    // Recreate compute bind group to update trail texture binding for sensors
    if (this.bindGroupLayout) {
      this.createBindGroups();
    }

    // Run compute passes to build grid and integrate physics (via runner)
    if (this.computeBindGroup) {
      const workgroupSize = DEFAULTS.workgroupSize;
      runSimulationPasses(
        commandEncoder,
        this.computeBindGroup,
        {
          gridClear: this.gridClearPipeline || undefined,
          gridBuild: this.gridBuildPipeline || undefined,
          state: this.statePipeline || undefined,
          apply: this.applyPipeline || undefined,
          integrate: this.integratePipeline || undefined,
          constrain: this.constrainPipeline || undefined,
          correct: this.correctPipeline || undefined,
          monolithic: this.computePipeline || undefined,
        },
        {
          particleCount: this.particleCount,
          gridCellCount: this.gridCells,
          workgroupSize,
          constrainIterations: this.constrainIterations,
        }
      );
    }

    // Always run the render graph; render modules draw into scene textures and we copy to canvas
    this.runRenderGraph(commandEncoder);

    // Submit render commands
    this.device.queue.submit([commandEncoder.finish()]);
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  clear(): void {
    // Remove all particles
    this.particleCount = 0;

    // Clear scene textures so sensors and the next frame don't see stale data
    try {
      const encoder = this.device.createCommandEncoder();
      const passA = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.getCurrentSceneTextureView(),
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
            view: this.getOtherSceneTextureView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passB.end();
      this.device.queue.submit([encoder.finish()]);
    } catch (_) {
      // no-op if textures not ready
    }

    // Proactively clear the canvas once so last frame isn't left onscreen
    try {
      const commandEncoder = this.device.createCommandEncoder();
      const canvasView = this.context.getCurrentTexture().createView();
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
      this.device.queue.submit([commandEncoder.finish()]);
    } catch (_) {
      // ignore if context not available yet
    }
  }

  destroy(): void {
    this.engine.dispose();
  }
}
