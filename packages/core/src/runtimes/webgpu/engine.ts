/**
 * WebGPU Engine
 *
 * High-level orchestrator that wires together GPU resources, the simulation pipeline,
 * the render pipeline, the spatial grid, and the view controller. It owns the main
 * animation loop and exposes a minimal API for sizing, camera/zoom control, particle
 * data management, and play/pause lifecycle.
 *
 * Responsibilities:
 * - Initialize GPU device/context and allocate core buffers via GPUResources
 * - Build the WGSL program and per-module uniform buffers via ModuleRegistry
 * - Initialize compute (simulation) and render pipelines
 * - Maintain and sync the spatial grid to match the current view/camera
 * - Drive per-frame simulation passes and render passes into ping-pong scene textures
 * - Present the final texture to the canvas, tracking an EMA FPS estimate
 */
import type { Module, GridSpec } from "../../module";
import { GPUResources } from "./gpu-resources";
import { ParticleStore } from "./particle-store";
import {
  AbstractEngine,
  GetParticlesInRadiusOptions,
  GetParticlesInRadiusResult,
  IParticle,
} from "../../interfaces";
import { ModuleRegistry } from "./module-registry";
import { SpacialGrid } from "./spacial-grid";
import { SimulationPipeline } from "./simulation-pipeline";
import { RenderPipeline } from "./render-pipeline";
import { LocalQuery } from "./local-query";
import { GridPipeline } from "./grid-pipeline";
import { getGridChannelCount, resampleGridBuffer } from "../../grid/store";

export class WebGPUEngine extends AbstractEngine {
  private resources: GPUResources;
  private particles: ParticleStore;
  private registry: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: SpacialGrid;
  private gridPipeline: GridPipeline;
  private gridStores: Map<string, { spec: GridSpec; read: GPUBuffer; write: GPUBuffer }> = new Map();
  private gridSpecs: Map<string, GridSpec> = new Map();
  private lastGridResizeAt = 0;
  private gridResizeCooldownMs = 150;
  private bufferMaxParticles: number; // Buffer allocation size (separate from effective maxParticles)
  private workgroupSize: number;
  private simStrideValue: number = 0;
  private shouldSyncNextTick: boolean = false;
  private animationId: number | null = null;
  private didSwapchainWarmup: boolean = false;

  private localQuery: LocalQuery;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    grids?: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
    maxParticles?: number;
    workgroupSize?: number;
    maxNeighbors?: number;
  }) {
    super({
      ...options,
      constrainIterations: options.constrainIterations ?? 50,
    });
    // Buffer allocation size (separate from effective maxParticles limit)
    this.bufferMaxParticles = options.maxParticles ?? 100000;
    // Set effective maxParticles limit (null means no limit)
    this.setMaxParticles(options.maxParticles ?? null);
    this.workgroupSize = options.workgroupSize ?? 64;
    this.resources = new GPUResources({ canvas: options.canvas });
    this.particles = new ParticleStore(this.bufferMaxParticles, 12);
    this.registry = new ModuleRegistry([
      ...options.forces,
      ...options.render,
      ...(options.grids ?? []),
    ]);
    this.sim = new SimulationPipeline();
    this.render = new RenderPipeline();
    this.grid = new SpacialGrid(this.cellSize);
    this.gridPipeline = new GridPipeline();
    this.localQuery = new LocalQuery();
  }

  async initialize(): Promise<void> {
    await this.resources.initialize();

    // Core buffers
    this.resources.createParticleBuffer(this.bufferMaxParticles, 12);
    this.resources.createRenderUniformBuffer(24);

    // Build program + module uniform buffers
    this.attachGridSpecsFromModules();
    this.registry.initialize(this.resources);
    const program = this.registry.getProgram();
    if (program.extraBindings.simState) {
      // SIM_STATE is a per-particle float array used by integration and force-module state.
      // Its stride is program-dependent (base 4 + per-module state slots), so we must
      // allocate using the generated program's stride. Allocating a fixed 4-float stride
      // causes out-of-bounds reads/writes for particles beyond a threshold (e.g. ~40k),
      // resulting in "exploding" velocities/positions.
      this.resources.createSimStateBuffer(
        this.bufferMaxParticles,
        program.simStateStride
      );
    }

    // Build compute pipelines
    this.sim.initialize(this.resources, program);

    this.setupGridStores();
    this.gridPipeline.initialize(
      this.resources,
      this.registry,
      this.gridModules,
      this.gridSpecs
    );
    this.seedGridsFromParticles();

    // Ensure scene textures
    const size = this.view.getSize();
    this.resources.canvas.width = size.width;
    this.resources.canvas.height = size.height;
    this.render.ensureTargets(this.resources, size.width, size.height);

    // Safari/WebKit workaround:
    // On WebKit's WebGPU implementation, the first present can stay blank until the canvas
    // experiences a "real" resize (even 1px). Apps have been working around this by
    // jiggling size once after starting. We do it here, once, after the final canvas size
    // is set and before the first present.
    await this.warmupSwapchainIfNeeded(size.width, size.height);

    // Configure grid storage + uniforms
    this.grid.configure(this.view.getSnapshot(), this.resources, program);

    // Seed module uniforms on GPU
    this.registry.writeAllModuleUniforms();

    // Cache sim stride value
    this.simStrideValue = program.simStateStride;
  }

  // Implement abstract methods for animation loop
  protected startAnimationLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  protected stopAnimationLoop(): void {
    // WebGPU doesn't need to cancel requestAnimationFrame explicitly
    // since it's handled in the animate method
  }

  async destroy(): Promise<void> {
    this.pause();
    // Stop animation loop to prevent using destroyed resources
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.localQuery.dispose();
    this.gridStores.forEach((store) => {
      store.read.destroy();
      store.write.destroy();
    });
    this.gridStores.clear();
    this.gridSpecs.clear();
    await this.resources.dispose();
  }

  // Override setSize to also update WebGPU-specific resources
  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.resources.canvas.width = width;
    this.resources.canvas.height = height;
    this.render.ensureTargets(this.resources, width, height);
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.registry.getProgram()
    );
  }

  // Override onViewChanged to update grid when view changes
  protected onViewChanged(): void {
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.registry.getProgram()
    );
    this.updateGridStoresForView();
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

  addParticle(p: IParticle): number {
    const index = this.particles.addParticle(p);
    if (index < 0) return -1;
    // Push only the new particle record to GPU (no full-scene readback).
    this.particles.syncParticleToGPU(this.resources, index);
    // Update maxSize tracking
    this.updateMaxSize(p.size);
    return index;
  }

  setParticle(index: number, p: IParticle): void {
    this.particles.setParticle(index, p);
    this.particles.syncParticleToGPU(this.resources, index);
    this.updateMaxSize(p.size);
  }

  setParticleMass(index: number, mass: number): void {
    this.particles.setParticleMass(index, mass);
    this.particles.syncParticleMassToGPU(this.resources, index);
  }

  getGrid(moduleName: string): Promise<ArrayBufferView> {
    const store = this.gridStores.get(moduleName);
    if (!store) {
      return Promise.reject(new Error(`Grid module not found: ${moduleName}`));
    }
    const channels = getGridChannelCount(store.spec);
    const length = store.spec.width * store.spec.height * channels;
    const bytes = length * 4;
    return this.resources.readBuffer(store.read, bytes).then((buf) => {
      return new Float32Array(buf);
    });
  }

  setGrid(moduleName: string, data: ArrayBufferView): void {
    const store = this.gridStores.get(moduleName);
    if (!store) return;
    const device = this.resources.getDevice();
    device.queue.writeBuffer(
      store.read,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
    device.queue.writeBuffer(
      store.write,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  /**
   * Forces GPU-to-CPU synchronization and returns current particle data.
   * Use this when you need the most up-to-date particle positions from GPU.
   */
  async getParticles(): Promise<IParticle[]> {
    await this.particles.syncFromGPU(this.resources);
    return this.particles.getParticles();
  }

  async getParticle(index: number): Promise<IParticle> {
    await this.particles.syncFromGPU(this.resources);
    return this.particles.getParticle(index);
  }

  async getParticlesInRadius(
    center: { x: number; y: number },
    radius: number,
    opts?: GetParticlesInRadiusOptions
  ): Promise<GetParticlesInRadiusResult> {
    return await this.localQuery.getParticlesInRadius(
      this.resources,
      center,
      radius,
      this.getCount(),
      opts
    );
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
    // Clear scene textures proactively
    this.render.clearTargets(this.resources, this.clearColor);
    // Reset maxSize tracking
    this.resetMaxSize();
    // Sync module uniforms to GPU (important for grab module reset)
    this.registry.writeAllModuleUniforms();
    this.gridPipeline.reset();
    const device = this.resources.getDevice();
    for (const store of this.gridStores.values()) {
      const channels = getGridChannelCount(store.spec);
      const length = store.spec.width * store.spec.height * channels;
      const zeros = new Float32Array(length);
      device.queue.writeBuffer(store.read, 0, zeros);
      device.queue.writeBuffer(store.write, 0, zeros);
    }
  }

  private animate = async (): Promise<void> => {
    const dt = this.getTimeDelta();
    this.updateFPS(dt);

    // Write view uniforms
    const snapshot = this.view.getSnapshot();
    this.resources.writeRenderUniforms(snapshot);

    // Keep grid/world extents in sync with current view
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.registry.getProgram()
    );

    let gridReadBuffers:
      | Map<string, GPUBuffer>
      | undefined = undefined;

    // Encode command buffer
    const encoder = this.resources.getDevice().createCommandEncoder();

    // Only run simulation/oscillators when playing
    if (this.playing) {
      // Update engine-owned oscillators before simulation uniforms are written
      this.updateOscillators(dt);
      this.seedGridsFromParticles();
      if (this.gridModules.length > 0 && this.gridStores.size > 0) {
        this.gridPipeline.run(
          encoder,
          this.resources,
          this.registry,
          this.gridModules,
          this.gridStores
        );
      }
      gridReadBuffers =
        this.gridStores.size > 0
          ? new Map(
              Array.from(this.gridStores.entries()).map(([name, store]) => [
                name,
                store.read,
              ])
            )
          : undefined;
      // Update simulation uniforms (dt, count, simStride, maxSize, maxParticles)
      const actualCount = this.particles.getCount();
      this.resources.writeSimulationUniform(this.registry.getProgram(), {
        dt,
        count: actualCount,
        simStride: this.simStrideValue,
        maxSize: this.getMaxSize(),
        iteration: 0,
        maxNeighbors: this.getMaxNeighbors(),
        maxParticles: this.maxParticles ?? -1, // Use -1 as sentinel for null
      });

      // Run simulation passes
      this.sim.runPasses(encoder, this.resources, {
        particleCount: this.getCount(), // Use effective count
        gridCellCount: this.grid.getCellCount(),
        workgroupSize: this.workgroupSize,
        constrainIterations: this.constrainIterations,
        gridBuffers: gridReadBuffers,
      });

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
        await this.particles.syncFromGPU(this.resources);
      }
    }

    const particleCount = this.getCount(); // Use effective count

    // Always run render passes to keep displaying current state
    if (!gridReadBuffers && this.gridStores.size > 0) {
      gridReadBuffers = new Map(
        Array.from(this.gridStores.entries()).map(([name, store]) => [
          name,
          store.read,
        ])
      );
    }
    const lastView = this.render.runPasses(
      encoder,
      this.registry.getEnabledRenderModules(),
      this.registry.getProgram(),
      this.resources,
      this.view.getSize(),
      particleCount,
      this.clearColor,
      gridReadBuffers
    );

    this.render.present(encoder, this.resources, lastView);
    this.resources.getDevice().queue.submit([encoder.finish()]);

    // Continue animation loop regardless of playing state
    this.animationId = requestAnimationFrame(this.animate);
  };

  private waitForNextTick(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  private setupGridStores(): void {
    const device = this.resources.getDevice();
    this.gridStores.clear();
    this.gridSpecs.clear();
    const view = this.view.getSnapshot();
    for (const module of this.gridModules) {
      if (module.role !== "grid") continue;
      const spec = (module as unknown as { gridSpec?: GridSpec }).gridSpec;
      if (!spec) continue;
      const resolved = this.resolveGridSpec(spec, view);
      if (resolved !== spec) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
      }
      const channels = getGridChannelCount(resolved);
      const length =
        Math.max(1, resolved.width) * Math.max(1, resolved.height) * channels;
      const sizeBytes = length * 4;
      const usage =
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST;
      const read = device.createBuffer({ size: sizeBytes, usage });
      const write = device.createBuffer({ size: sizeBytes, usage });
      this.gridStores.set(module.name, { spec: resolved, read, write });
      this.gridSpecs.set(module.name, resolved);
    }
    for (const module of this.modules) {
      const attach = (module as unknown as { attachGridSpec?: (spec: GridSpec) => void }).attachGridSpec;
      const getName = (module as unknown as { getGridModuleName?: () => string }).getGridModuleName;
      if (!attach || !getName) continue;
      const gridName = getName.call(module);
      const spec = this.gridSpecs.get(gridName);
      if (spec) attach.call(module, spec);
    }
  }

  private attachGridSpecsFromModules(): void {
    const specs = new Map<string, GridSpec>();
    for (const module of this.gridModules) {
      const spec = (module as unknown as { gridSpec?: GridSpec }).gridSpec;
      if (!spec) continue;
      specs.set(module.name, spec);
    }
    for (const module of this.modules) {
      const attach = (module as unknown as { attachGridSpec?: (spec: GridSpec) => void }).attachGridSpec;
      const getName = (module as unknown as { getGridModuleName?: () => string }).getGridModuleName;
      if (!attach || !getName) continue;
      const gridName = getName.call(module);
      const spec = specs.get(gridName);
      if (spec) attach.call(module, spec);
    }
  }

  private resolveGridSpec(
    spec: GridSpec,
    view: { width: number; height: number; zoom: number }
  ) {
    if (!spec.followView) return spec;
    const cellSize = spec.cellSize;
    if (!cellSize || cellSize <= 0) return spec;
    const width = Math.max(1, Math.ceil(view.width / cellSize));
    const height = Math.max(1, Math.ceil(view.height / cellSize));
    if (
      width === spec.width &&
      height === spec.height &&
      cellSize === spec.cellSize
    ) {
      return spec;
    }
    return { ...spec, width, height, cellSize };
  }

  private updateGridStoresForView(): void {
    if (this.gridModules.length === 0) return;
    const view = this.view.getSnapshot();
    const now = performance.now();
    const allowResize = now - this.lastGridResizeAt >= this.gridResizeCooldownMs;
    let resized = false;
    let specChanged = false;
    const regenerate = new Set<string>();
    const previousStores = new Map(this.gridStores);
    for (const module of this.gridModules) {
      if (module.role !== "grid") continue;
      const spec = (module as unknown as { gridSpec?: GridSpec }).gridSpec;
      if (!spec) continue;
      const input = module.read() as Record<string, number>;
      const inputCellSize =
        typeof input.cellSize === "number" && input.cellSize > 0
          ? input.cellSize
          : undefined;
      const cellSizeChanged =
        inputCellSize !== undefined && inputCellSize !== spec.cellSize;
      const baseSpec = cellSizeChanged
        ? { ...spec, cellSize: inputCellSize }
        : spec;
      if (!cellSizeChanged && !allowResize) continue;
      const resolved = this.resolveGridSpec(baseSpec, view);
      if (resolved === spec) continue;
      const sizeChanged =
        resolved.width !== spec.width || resolved.height !== spec.height;
      if (cellSizeChanged) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
        regenerate.add(module.name);
        resized = true;
        continue;
      }
      if (!sizeChanged) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
        const store = this.gridStores.get(module.name);
        if (store) {
          store.spec = resolved;
          this.gridSpecs.set(module.name, resolved);
        }
        specChanged = true;
        continue;
      }
      (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
      resized = true;
    }
    if (!resized && !specChanged) return;
    if (!resized) {
      this.attachGridSpecsFromModules();
      return;
    }
    this.lastGridResizeAt = now;
    this.setupGridStores();
    this.gridPipeline.initialize(
      this.resources,
      this.registry,
      this.gridModules,
      this.gridSpecs
    );
    for (const module of this.gridModules) {
      if (regenerate.has(module.name)) continue;
      const prev = previousStores.get(module.name);
      const next = this.gridStores.get(module.name);
      if (!prev || !next) continue;
      const prevSpec = prev.spec;
      const prevChannels = getGridChannelCount(prevSpec);
      const readBytes =
        Math.max(1, prevSpec.width) *
        Math.max(1, prevSpec.height) *
        prevChannels *
        4;
      this.resources.readBuffer(prev.read, readBytes).then((buf) => {
        const src = new Float32Array(buf);
        const resampled = resampleGridBuffer(src, prevSpec, next.spec, {
          forceFloat: true,
        }) as Float32Array;
        this.setGrid(module.name, resampled);
        this.gridPipeline.markInitialized(module.name);
      });
    }
  }

  private seedGridsFromParticles(): void {
    if (this.gridModules.length === 0 || this.gridStores.size === 0) return;
    const particles = this.particles.getParticles();
    if (particles.length === 0) return;
    const view = this.view.getSnapshot();

    for (const module of this.gridModules) {
      if (!module.isEnabled()) continue;
      if (this.gridPipeline.isInitialized(module.name)) continue;
      const seed = (module as unknown as {
        seedFromParticlesBuffer?: (
          particles: IParticle[],
          view: { width: number; height: number; cx: number; cy: number; zoom: number }
        ) => Float32Array | null;
      }).seedFromParticlesBuffer;
      if (!seed) continue;
      const data = seed.call(module, particles, view);
      if (!data) continue;
      this.setGrid(module.name, data);
      this.gridPipeline.markInitialized(module.name);
    }
  }

  private isWebKitWebGPU(): boolean {
    // We specifically want WebKit's WebGPU, not Chromium/Blink.
    // - On iOS, *all* browsers use WebKit, so we treat them as WebKit.
    // - On macOS, Safari is WebKit; Chrome/Edge/Opera are not (even though their UA includes "AppleWebKit").
    try {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      if (isIOS) return true;
      const isAppleWebKit = /AppleWebKit\//.test(ua);
      const isSafari = /Safari\//.test(ua);
      const isChromiumLike = /(Chrome|Chromium|Edg|OPR)\//.test(ua);
      return isAppleWebKit && isSafari && !isChromiumLike;
    } catch {
      return false;
    }
  }

  private async warmupSwapchainIfNeeded(
    width: number,
    height: number
  ): Promise<void> {
    if (this.didSwapchainWarmup) return;
    if (!this.isWebKitWebGPU()) return;
    if (height <= 1) return;

    this.didSwapchainWarmup = true;

    // 1px "resize" to force WebKit to fully bind the swapchain/currentTexture.
    // We wait a couple of animation frames to match real-world workarounds that proved reliable.
    try {
      this.resources.canvas.width = width;
      this.resources.canvas.height = height - 1;
      await this.waitForNextTick();
      this.resources.canvas.width = width;
      this.resources.canvas.height = height;
      await this.waitForNextTick();
      // Re-ensure targets (idempotent) in case any implementation ties resources to canvas size.
      this.render.ensureTargets(this.resources, width, height);
    } catch {
      // If anything goes wrong, fail open: rendering may still work on other browsers.
    }
  }

  // Override export to use module registry
  export(): Record<string, Record<string, number>> {
    const settings: Record<string, Record<string, number>> = {};
    for (const module of this.registry.getModules()) {
      const moduleData = module.read();
      settings[module.name] = moduleData as Record<string, number>;
    }
    return settings;
  }

  // Override onModuleSettingsChanged to sync to GPU
  protected onModuleSettingsChanged(): void {
    this.registry.writeAllModuleUniforms();
    this.updateGridStoresForView();
  }

  // Handle configuration changes
  protected onClearColorChanged(): void {
    // Clear color changes don't require any immediate system updates
    // The new color will be used in the next render pass
  }

  protected onCellSizeChanged(): void {
    // Update spatial grid with new cell size
    this.grid.setCellSize(this.cellSize);

    // If initialized, reconfigure the grid with current view
    if (this.resources && this.view) {
      try {
        const program = this.registry.getProgram();
        this.grid.configure(this.view.getSnapshot(), this.resources, program);
      } catch (error) {
        // Ignore if not fully initialized yet
      }
    }
  }

  protected onConstrainIterationsChanged(): void {
    // Constrain iterations changes don't require any immediate system updates
    // The new value will be used in the next simulation pass
  }

  protected onMaxNeighborsChanged(): void {
    // Max neighbors affects only simulation-side neighbor iterator cap; no immediate rebuild needed
  }

  protected onMaxParticlesChanged(): void {
    // Max particles affects effective count; no immediate rebuild needed
  }

}
