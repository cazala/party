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
import { DEFAULTS } from "../../config";
import type { Module } from "../../module";
import { GPUResources } from "./gpu-resources";
import { ParticleStore } from "./particle-store";
import { AbstractEngine, IParticle } from "../../interfaces";
import { ModuleRegistry } from "./module-registry";
import { GridSystem } from "./grid-system";
import { SimulationPipeline } from "./simulation-pipeline";
import { RenderPipeline } from "./render-pipeline";

export class WebGPUEngine extends AbstractEngine {
  private resources: GPUResources;
  private particles: ParticleStore;
  private registry: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: GridSystem;
  private maxParticles: number = DEFAULTS.maxParticles;
  private simStrideValue: number = 0;

  constructor(options: { canvas: HTMLCanvasElement; modules: Module[] }) {
    const { canvas, modules } = options;
    super(canvas, modules);
    this.resources = new GPUResources({ canvas });
    this.particles = new ParticleStore(this.maxParticles, 12);
    this.registry = new ModuleRegistry([...modules]);
    this.sim = new SimulationPipeline();
    this.render = new RenderPipeline();
    this.grid = new GridSystem();
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
  }

  addParticle(p: IParticle): void {
    this.particles.addParticle(p);
    this.particles.syncToGPU(this.resources);
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
  }

  private animate = (): void => {
    if (!this.playing) return;

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

    // Update simulation uniforms (dt, count, simStride)
    this.resources.writeSimulationUniform(this.registry.getProgram(), {
      dt,
      count: this.particles.getCount(),
      simStride: this.simStrideValue,
    });

    // Encode simulation + render
    const encoder = this.resources.getDevice().createCommandEncoder();
    this.sim.runPasses(encoder, this.resources, {
      particleCount: this.particles.getCount(),
      gridCellCount: this.grid.getCellCount(),
      workgroupSize: DEFAULTS.workgroupSize,
      constrainIterations: this.constrainIterations,
    });

    const lastView = this.render.runPasses(
      encoder,
      this.registry.getEnabledRenderModules(),
      this.registry.getProgram(),
      this.resources,
      this.view.getSize(),
      this.particles.getCount()
    );

    this.render.present(encoder, this.resources, lastView);
    this.resources.getDevice().queue.submit([encoder.finish()]);

    requestAnimationFrame(this.animate);
  };

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
}
