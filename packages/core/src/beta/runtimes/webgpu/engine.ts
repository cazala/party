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
import { View } from "../../view";
import { ParticleStore } from "./particle-store";
import { IEngine, IParticle } from "../../interfaces";
import { ModuleRegistry } from "./module-registry";
import { GridSystem } from "./grid-system";
import { SimulationPipeline } from "./simulation-pipeline";
import { RenderPipeline } from "./render-pipeline";

export class WebGPUEngine implements IEngine {
  private resources: GPUResources;
  private particles: ParticleStore;
  private modules: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: GridSystem;
  private view: View;

  private playing: boolean = false;
  private lastTime: number = 0;
  private constrainIterations: number = DEFAULTS.constrainIterations;
  private maxParticles: number = DEFAULTS.maxParticles;
  private simStrideValue: number = 0;
  private fpsEstimate: number = 60;
  private fpsSmoothing: number = 0.15; // EMA smoothing factor

  constructor(options: { canvas: HTMLCanvasElement; modules: Module[] }) {
    const { canvas, modules } = options;
    this.resources = new GPUResources({ canvas });
    this.view = new View(canvas.width, canvas.height);
    this.particles = new ParticleStore(this.maxParticles, 12);
    this.modules = new ModuleRegistry([...modules]);
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
    this.modules.initialize(this.resources);
    const program = this.modules.getProgram();
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
    this.modules.writeAllModuleUniforms();

    // Cache sim stride value
    this.simStrideValue = program.simStateStride;
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTime = performance.now();
    this.animate();
  }

  pause(): void {
    this.playing = false;
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  destroy(): void {
    this.pause();
    this.resources.dispose();
  }

  getSize(): { width: number; height: number } {
    return this.view.getSize();
  }

  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.resources.canvas.width = width;
    this.resources.canvas.height = height;
    this.render.ensureTargets(this.resources, width, height);
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.modules.getProgram()
    );
  }

  setCamera(x: number, y: number): void {
    this.view.setCamera(x, y);
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.modules.getProgram()
    );
  }

  getCamera(): { x: number; y: number } {
    return this.view.getCamera();
  }

  setZoom(z: number): void {
    this.view.setZoom(z);
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.modules.getProgram()
    );
  }

  getZoom(): number {
    return this.view.getZoom();
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

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;

    // Update FPS estimate (EMA)
    if (dt > 0) {
      const instantFps = 1 / dt;
      this.fpsEstimate =
        this.fpsEstimate * (1 - this.fpsSmoothing) +
        instantFps * this.fpsSmoothing;
    }

    // Write view uniforms
    const snapshot = this.view.getSnapshot();
    this.resources.writeRenderUniforms(snapshot);

    // Keep grid/world extents in sync with current view
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.modules.getProgram()
    );

    // Update simulation uniforms (dt, count, simStride)
    this.resources.writeSimulationUniform(this.modules.getProgram(), {
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
      this.modules.getEnabledRenderModules(),
      this.modules.getProgram(),
      this.resources,
      this.view.getSize(),
      this.particles.getCount()
    );

    this.render.present(encoder, this.resources, lastView);
    this.resources.getDevice().queue.submit([encoder.finish()]);

    requestAnimationFrame(this.animate);
  };

  getFPS(): number {
    return this.fpsEstimate;
  }
}
