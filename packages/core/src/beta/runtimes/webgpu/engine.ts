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
import type { Module } from "../../module";
import { GPUResources } from "./gpu-resources";
import { ParticleStore } from "./particle-store";
import { AbstractEngine, IParticle } from "../../interfaces";
import { ModuleRegistry } from "./module-registry";
import { SpacialGrid } from "./spacial-grid";
import { SimulationPipeline } from "./simulation-pipeline";
import { RenderPipeline } from "./render-pipeline";

export class WebGPUEngine extends AbstractEngine {
  private resources: GPUResources;
  private particles: ParticleStore;
  private registry: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: SpacialGrid;
  private maxParticles: number;
  private workgroupSize: number;
  private simStrideValue: number = 0;
  private shouldSyncNextTick: boolean = false;
  private animationId: number | null = null;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
    maxParticles?: number;
    workgroupSize?: number;
  }) {
    super({
      ...options,
      constrainIterations: options.constrainIterations ?? 50,
    });
    this.maxParticles = options.maxParticles ?? 100000;
    this.workgroupSize = options.workgroupSize ?? 64;
    this.resources = new GPUResources({ canvas: options.canvas });
    this.particles = new ParticleStore(this.maxParticles, 12);
    this.registry = new ModuleRegistry([...options.forces, ...options.render]);
    this.sim = new SimulationPipeline();
    this.render = new RenderPipeline();
    this.grid = new SpacialGrid(this.cellSize);
  }

  async initialize(): Promise<void> {
    await this.resources.initialize();

    // Core buffers
    this.resources.createParticleBuffer(this.maxParticles, 12);
    this.resources.createRenderUniformBuffer(24);

    // Build program + module uniform buffers
    this.registry.initialize(this.resources);
    const program = this.registry.getProgram();
    if (program.extraBindings.simState) {
      this.resources.createSimStateBuffer(this.maxParticles, 4);
    }

    // Build compute pipelines
    this.sim.initialize(this.resources, program);

    // Ensure scene textures
    const size = this.view.getSize();
    this.resources.canvas.width = size.width;
    this.resources.canvas.height = size.height;
    this.render.ensureTargets(this.resources, size.width, size.height);

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

  destroy(): void {
    this.pause();
    this.resources.dispose();
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
    // Update maxSize tracking
    this.updateMaxSize(p.size);
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

  getCount(): number {
    return this.particles.getCount();
  }

  clear(): void {
    this.particles.clear();
    // Clear scene textures proactively
    this.render.clearTargets(this.resources);
    // Reset maxSize tracking
    this.resetMaxSize();
    // Sync module uniforms to GPU (important for grab module reset)
    this.registry.writeAllModuleUniforms();
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

    // Encode command buffer
    const encoder = this.resources.getDevice().createCommandEncoder();

    // Only run simulation passes when playing
    if (this.playing) {
      // Update simulation uniforms (dt, count, simStride, maxSize)
      this.resources.writeSimulationUniform(this.registry.getProgram(), {
        dt,
        count: this.particles.getCount(),
        simStride: this.simStrideValue,
        maxSize: this.getMaxSize(),
        iteration: 0,
      });

      // Run simulation passes
      this.sim.runPasses(encoder, this.resources, {
        particleCount: this.particles.getCount(),
        gridCellCount: this.grid.getCellCount(),
        workgroupSize: this.workgroupSize,
        constrainIterations: this.constrainIterations,
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

    const particleCount = this.particles.getCount();

    // Always run render passes to keep displaying current state
    const lastView = this.render.runPasses(
      encoder,
      this.registry.getEnabledRenderModules(),
      this.registry.getProgram(),
      this.resources,
      this.view.getSize(),
      particleCount,
      this.clearColor
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
}
