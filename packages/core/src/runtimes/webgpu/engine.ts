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
import {
  AbstractEngine,
  GetParticlesInRadiusOptions,
  GetParticlesInRadiusResult,
  IParticle,
  ParticleQuery,
} from "../../interfaces";
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
  private bufferMaxParticles: number; // Buffer allocation size (separate from effective maxParticles)
  private workgroupSize: number;
  private simStrideValue: number = 0;
  private shouldSyncNextTick: boolean = false;
  private animationId: number | null = null;
  private didSwapchainWarmup: boolean = false;

  // Brush/local query pipeline (compact readback)
  private brushQueryPipeline: GPUComputePipeline | null = null;
  private brushQueryUniform: GPUBuffer | null = null;
  private brushQueryCount: GPUBuffer | null = null;
  private brushQueryOut: GPUBuffer | null = null;
  private brushQueryCapacity: number = 0;

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
      constrainIterations: options.constrainIterations ?? 50,
    });
    // Buffer allocation size (separate from effective maxParticles limit)
    this.bufferMaxParticles = options.maxParticles ?? 100000;
    // Set effective maxParticles limit (null means no limit)
    this.setMaxParticles(options.maxParticles ?? null);
    this.workgroupSize = options.workgroupSize ?? 64;
    this.resources = new GPUResources({ canvas: options.canvas });
    this.particles = new ParticleStore(this.bufferMaxParticles, 12);
    this.registry = new ModuleRegistry([...options.forces, ...options.render]);
    this.sim = new SimulationPipeline();
    this.render = new RenderPipeline();
    this.grid = new SpacialGrid(this.cellSize);
  }

  async initialize(): Promise<void> {
    await this.resources.initialize();

    // Core buffers
    this.resources.createParticleBuffer(this.bufferMaxParticles, 12);
    this.resources.createRenderUniformBuffer(24);

    // Build program + module uniform buffers
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
    const maxResults = Math.max(1, Math.floor(opts?.maxResults ?? 20000));
    this.ensureBrushQueryPipeline(maxResults);

    const device = this.resources.getDevice();

    // Reset atomic counter
    device.queue.writeBuffer(this.brushQueryCount!, 0, new Uint32Array([0]));

    // Uniform: v0 = [cx, cy, radius, maxResults], v1 = [particleCount, 0, 0, 0]
    const u = new Float32Array(8);
    u[0] = center.x;
    u[1] = center.y;
    u[2] = radius;
    u[3] = maxResults;
    u[4] = this.getCount(); // effective count is fine
    device.queue.writeBuffer(this.brushQueryUniform!, 0, u);

    const particleBuffer = this.resources.getParticleBuffer();
    if (!particleBuffer) return { particles: [], truncated: false };

    const bindGroup = device.createBindGroup({
      layout: this.brushQueryPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this.brushQueryUniform! } },
        { binding: 2, resource: { buffer: this.brushQueryCount! } },
        { binding: 3, resource: { buffer: this.brushQueryOut! } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.brushQueryPipeline!);
    pass.setBindGroup(0, bindGroup);
    const wg = 256;
    const n = Math.max(0, Math.floor(this.getCount()));
    pass.dispatchWorkgroups(Math.ceil(n / wg));
    pass.end();
    device.queue.submit([encoder.finish()]);

    // Read back count + packed vec4 list
    const countBuf = await this.resources.readBuffer(this.brushQueryCount!, 4);
    const found = new Uint32Array(countBuf)[0] ?? 0;
    const truncated = found > maxResults;
    const readCount = Math.min(found, maxResults);
    if (readCount === 0) return { particles: [], truncated };

    const outBuf = await this.resources.readBuffer(
      this.brushQueryOut!,
      readCount * 16 // vec4<f32>
    );
    const outFloats = new Float32Array(outBuf);

    const particles: ParticleQuery[] = [];
    for (let i = 0; i < readCount; i++) {
      const base = i * 4;
      particles.push({
        position: { x: outFloats[base + 0], y: outFloats[base + 1] },
        size: outFloats[base + 2],
        mass: outFloats[base + 3],
      });
    }

    return { particles, truncated };
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

    // Only run simulation/oscillators when playing
    if (this.playing) {
      // Update engine-owned oscillators before simulation uniforms are written
      this.updateOscillators(dt);
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

  private ensureBrushQueryPipeline(maxResults: number): void {
    const device = this.resources.getDevice();

    // (Re)allocate buffers if capacity changed
    if (this.brushQueryCapacity !== maxResults) {
      this.brushQueryCapacity = maxResults;
      this.brushQueryUniform?.destroy();
      this.brushQueryCount?.destroy();
      this.brushQueryOut?.destroy();
      this.brushQueryUniform = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.brushQueryCount = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      this.brushQueryOut = device.createBuffer({
        size: maxResults * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
    }

    if (this.brushQueryPipeline) return;

    const code = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
};

struct QueryUniforms {
  v0: vec4<f32>, // center.x, center.y, radius, maxResults (as f32)
  v1: vec4<f32>, // particleCount, 0,0,0
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> query: QueryUniforms;
@group(0) @binding(2) var<storage, read_write> outCount: atomic<u32>;
@group(0) @binding(3) var<storage, read_write> outData: array<vec4<f32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let count = u32(query.v1.x);
  if (i >= count) { return; }

  let p = particles[i];
  if (p.mass == 0.0) { return; }

  let cx = query.v0.x;
  let cy = query.v0.y;
  let radius = query.v0.z;
  let maxResults = u32(query.v0.w);

  // Disc-intersection semantics: dist <= radius + p.size
  let dx = p.position.x - cx;
  let dy = p.position.y - cy;
  let rr = radius + p.size;
  if (dx * dx + dy * dy > rr * rr) { return; }

  let outIdx = atomicAdd(&outCount, 1u);
  if (outIdx >= maxResults) { return; }
  outData[outIdx] = vec4<f32>(p.position.x, p.position.y, p.size, p.mass);
}
`;

    this.brushQueryPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: device.createShaderModule({ code }), entryPoint: "main" },
    });
  }
}
