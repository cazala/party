import { DEFAULTS } from "./config";
import type { Module } from "./module";
import { GPUResources } from "./gpu-resources";
import { ViewController } from "./view-controller";
import { ParticleStore, type WebGPUParticle } from "./particle-store";
import { ModuleRegistry } from "./module-registry";
import { GridSystem } from "./grid-system";
import { SimulationPipeline } from "./simulation-pipeline";
import { RenderPipeline } from "./render-pipeline";

export class Engine {
  private resources: GPUResources;
  private particles: ParticleStore;
  private modules: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: GridSystem;
  private view: ViewController;

  private isPlaying: boolean = false;
  private lastTime: number = 0;
  private constrainIterations: number = 50;
  private maxParticles: number = DEFAULTS.maxParticles;
  private simWriter:
    | ((values: Partial<Record<string, number>>) => void)
    | null = null;
  private fpsEstimate: number = 60;
  private fpsSmoothing: number = 0.15; // EMA smoothing factor

  constructor(
    canvas: HTMLCanvasElement,
    modules: readonly Module<string, string, any>[]
  ) {
    this.resources = new GPUResources({ canvas });
    const width = Math.max(1, canvas.width || (canvas as any).clientWidth || 1);
    const height = Math.max(
      1,
      canvas.height || (canvas as any).clientHeight || 1
    );
    this.view = new ViewController(width, height);
    this.particles = new ParticleStore(this.maxParticles, 12);
    this.modules = new ModuleRegistry(modules);
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

    // Cache sim uniform writer
    this.simWriter = this.modules.getUniformWriter("simulation");
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTime = performance.now();
    this.animate();
  }

  pause(): void {
    this.isPlaying = false;
  }

  toggle(): void {
    this.isPlaying ? this.pause() : this.play();
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

  setParticles(p: WebGPUParticle[]): void {
    this.particles.setParticles(p);
    this.particles.syncToGPU(this.resources);
  }

  addParticle(p: WebGPUParticle): void {
    this.particles.addParticle(p);
    this.particles.syncToGPU(this.resources);
  }

  getParticles(): WebGPUParticle[] {
    return this.particles.getParticles();
  }

  getParticle(index: number): WebGPUParticle {
    return this.particles.getParticle(index);
  }

  getCount(): number {
    return this.particles.getCount();
  }

  clear(): void {
    this.particles.clear();
    // Clear scene textures proactively
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
      // ignore if textures not ready
    }
  }

  private animate = (): void => {
    if (!this.isPlaying) return;

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
    this.view.writeRenderUniforms(this.resources);

    // Keep grid/world extents in sync with current view
    this.grid.resizeIfNeeded(
      this.view.getSnapshot(),
      this.resources,
      this.modules.getProgram()
    );

    // Update simulation uniforms
    this.simWriter?.({ dt, count: this.particles.getCount() });

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
      this.modules.getEnabledRenderDescriptors(),
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
