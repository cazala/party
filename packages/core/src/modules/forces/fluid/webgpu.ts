import { Particle } from "../../particle";
import { SpatialGrid } from "../../spatial-grid";
import { Force } from "../../system";
import {
  FluidCPU,
  DEFAULT_FLUID_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_VISCOSITY,
  DEFAULT_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_NEAR_THRESHOLD,
} from "./cpu";

export class FluidWebGPU implements Force {
  public enabled: boolean;
  public influenceRadius: number;
  public targetDensity: number;
  public pressureMultiplier: number;
  public viscosity: number;
  public nearPressureMultiplier: number;
  public nearThreshold: number;

  private gpuAvailable: boolean =
    typeof navigator !== "undefined" && !!(navigator as any).gpu;
  private cpuFallback: FluidCPU;
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private shaderModule: GPUShaderModule | null = null;

  constructor(
    options: {
      enabled?: boolean;
      influenceRadius?: number;
      targetDensity?: number;
      pressureMultiplier?: number;
      viscosity?: number;
      nearPressureMultiplier?: number;
      nearThreshold?: number;
    } = {}
  ) {
    this.enabled = options.enabled ?? DEFAULT_FLUID_ENABLED;
    this.influenceRadius = options.influenceRadius ?? DEFAULT_INFLUENCE_RADIUS;
    this.targetDensity = options.targetDensity ?? DEFAULT_TARGET_DENSITY;
    this.pressureMultiplier =
      options.pressureMultiplier ?? DEFAULT_PRESSURE_MULTIPLIER;
    this.viscosity = options.viscosity ?? DEFAULT_VISCOSITY;
    this.nearPressureMultiplier =
      options.nearPressureMultiplier ?? DEFAULT_NEAR_PRESSURE_MULTIPLIER;
    this.nearThreshold = options.nearThreshold ?? DEFAULT_NEAR_THRESHOLD;

    // CPU fallback mirrors parameters
    this.cpuFallback = new FluidCPU({
      enabled: this.enabled,
      influenceRadius: this.influenceRadius,
      targetDensity: this.targetDensity,
      pressureMultiplier: this.pressureMultiplier,
      viscosity: this.viscosity,
      nearPressureMultiplier: this.nearPressureMultiplier,
      nearThreshold: this.nearThreshold,
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.cpuFallback.setEnabled(enabled);
  }

  clearDensities(): void {
    this.cpuFallback.clearDensities();
  }

  clear(): void {
    this.cpuFallback.clear();
  }

  before(particles: Particle[], _deltaTime: number): void {
    // For now, use CPU path for neighbor search and density updates
    this.cpuFallback.enabled = this.enabled;
    this.cpuFallback.influenceRadius = this.influenceRadius;
    this.cpuFallback.targetDensity = this.targetDensity;
    this.cpuFallback.pressureMultiplier = this.pressureMultiplier;
    this.cpuFallback.viscosity = this.viscosity;
    this.cpuFallback.nearPressureMultiplier = this.nearPressureMultiplier;
    this.cpuFallback.nearThreshold = this.nearThreshold;
    this.cpuFallback.before(particles);
  }

  apply(particles: Particle[], spatialGrid: SpatialGrid): void | Promise<void> {
    if (!this.gpuAvailable) {
      return this.cpuFallback.apply(particles, spatialGrid);
    }
    return this.runGPUFluid(particles, spatialGrid);
  }

  private async ensureGPU(): Promise<boolean> {
    if (!this.gpuAvailable) return false;
    if (
      this.device &&
      this.pipeline &&
      this.bindGroupLayout &&
      this.shaderModule
    )
      return true;
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return false;
    this.device = await adapter.requestDevice();
    if (!this.device) return false;
    const device = this.device;
    const shaderCode = /* wgsl */ `
      struct Params {
        radius: f32,
        targetDensity: f32,
        pressureMultiplier: f32,
        viscosity: f32,
        nearPressureMultiplier: f32,
        nearThreshold: f32,
        count: u32,
        maxNeighbors: u32,
      };

      @group(0) @binding(0) var<storage, read_write> velocities: array<vec2<f32>>;
      @group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
      @group(0) @binding(2) var<storage, read> densities: array<f32>;
      @group(0) @binding(3) var<storage, read> nearDensities: array<f32>;
      @group(0) @binding(4) var<storage, read> neighborIndices: array<u32>;
      @group(0) @binding(5) var<storage, read> neighborCounts: array<u32>;
      @group(0) @binding(6) var<storage, read> pinnedFlags: array<u32>;
      @group(0) @binding(7) var<uniform> params: Params;

      const PI: f32 = 3.141592653589793;

      fn poly6_derivative(distance: f32, radius: f32) -> f32 {
        if (distance >= radius) { return 0.0; }
        let r2 = radius * radius;
        let r4 = r2 * r2; // r^4
        let scale = (-12.0 / PI) / r4;
        return (distance - radius) * scale;
      }

      fn viscosity_kernel(distance: f32, radius: f32) -> f32 {
        let r2 = radius * radius;
        let v = max(0.0, r2 - distance * distance);
        let num = v * v * v;
        let r4 = r2 * r2;
        let r8 = r4 * r4;
        let denom = (PI / 4.0) * r8;
        return num / denom;
      }

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let i = gid.x;
        if (i >= params.count) { return; }
        if (pinnedFlags[i] != 0u) { return; }

        let pos_i = positions[i];
        let vel_i = velocities[i];

        var pressureForce: vec2<f32> = vec2<f32>(0.0, 0.0);
        var viscosityForce: vec2<f32> = vec2<f32>(0.0, 0.0);

        let baseIdx: u32 = i * params.maxNeighbors;
        let nCount: u32 = neighborCounts[i];

        for (var k: u32 = 0u; k < nCount; k = k + 1u) {
          let j: u32 = neighborIndices[baseIdx + k];
          if (j >= params.count) { continue; }
          if (j == i) { continue; }
          let pos_j = positions[j];
          let dx = pos_j - pos_i;
          let dist = length(dx);
          if (dist == 0.0 || dist >= params.radius) { continue; }
          let dir = dx / dist;

          let slope = poly6_derivative(dist, params.radius);
          let density_j = densities[j];
          let near_j = nearDensities[j];
          let pressure = (density_j - params.targetDensity) * params.pressureMultiplier;
          let nearPressure = near_j * params.nearPressureMultiplier;
          let effectivePressure = select(pressure, nearPressure, dist < params.nearThreshold);
          if (density_j > 0.0) {
            pressureForce = pressureForce + (dir * effectivePressure * slope) / density_j;
          }

          let infl = viscosity_kernel(dist, params.radius);
          let vel_j = velocities[j];
          viscosityForce = viscosityForce + (vel_j - vel_i) * infl;
        }

        pressureForce = -pressureForce;

        let density_i = densities[i];
        if (density_i > 0.0) {
          var force = pressureForce / density_i;
          force = force * 1000000.0 + (viscosityForce * 1000.0) / density_i;
          let mag = length(force);
          if (mag > 100.0) {
            force = normalize(force) * 100.0;
          }
          velocities[i] = vel_i + force;
        }
      }
    `;
    this.shaderModule = device.createShaderModule({ code: shaderCode });
    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: { module: this.shaderModule, entryPoint: "main" },
    });
    return true;
  }

  private async runGPUFluid(
    particles: Particle[],
    spatialGrid: SpatialGrid
  ): Promise<void> {
    const ok = await this.ensureGPU();
    if (!ok || !this.device || !this.pipeline || !this.bindGroupLayout) {
      this.cpuFallback.apply(particles, spatialGrid);
      return;
    }
    const device = this.device;

    const N = particles.length;
    const positions = new Float32Array(N * 2);
    const velocities = new Float32Array(N * 2);
    const densities = new Float32Array(N);
    const nearDensities = new Float32Array(N);
    const pinnedFlags = new Uint32Array(N);
    const MAX_NEIGHBORS = 64;
    const neighborIndices = new Uint32Array(N * MAX_NEIGHBORS);
    const neighborCounts = new Uint32Array(N);

    for (let i = 0; i < N; i++) {
      const p = particles[i];
      positions[i * 2] = p.position.x;
      positions[i * 2 + 1] = p.position.y;
      velocities[i * 2] = p.velocity.x;
      velocities[i * 2 + 1] = p.velocity.y;
      densities[i] = this.cpuFallback.densities.get(p.id) ?? 0;
      nearDensities[i] = this.cpuFallback.nearDensities.get(p.id) ?? 0;
      pinnedFlags[i] = p.pinned ? 1 : 0;
    }

    for (let i = 0; i < N; i++) {
      const p = particles[i];
      const neighbors = spatialGrid.getParticles(
        p.position,
        this.influenceRadius
      );
      const count = Math.min(neighbors.length, MAX_NEIGHBORS);
      neighborCounts[i] = count;
      for (let k = 0; k < count; k++) {
        const n = neighbors[k];
        const j = particles.indexOf(n);
        neighborIndices[i * MAX_NEIGHBORS + k] = j >= 0 ? j : (i as any);
      }
    }

    const positionsBuffer = device.createBuffer({
      size: positions.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      positionsBuffer,
      0,
      positions.buffer as ArrayBuffer
    );

    const velocitiesBuffer = device.createBuffer({
      size: velocities.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      velocitiesBuffer,
      0,
      velocities.buffer as ArrayBuffer
    );

    const densitiesBuffer = device.createBuffer({
      size: densities.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      densitiesBuffer,
      0,
      densities.buffer as ArrayBuffer
    );

    const nearDensitiesBuffer = device.createBuffer({
      size: nearDensities.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      nearDensitiesBuffer,
      0,
      nearDensities.buffer as ArrayBuffer
    );

    const neighborIndicesBuffer = device.createBuffer({
      size: neighborIndices.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      neighborIndicesBuffer,
      0,
      neighborIndices.buffer as ArrayBuffer
    );

    const neighborCountsBuffer = device.createBuffer({
      size: neighborCounts.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      neighborCountsBuffer,
      0,
      neighborCounts.buffer as ArrayBuffer
    );

    const pinnedFlagsBuffer = device.createBuffer({
      size: pinnedFlags.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      pinnedFlagsBuffer,
      0,
      pinnedFlags.buffer as ArrayBuffer
    );

    const uniformData = new ArrayBuffer(32);
    const f32 = new Float32Array(uniformData);
    const u32 = new Uint32Array(uniformData);
    f32[0] = this.influenceRadius;
    f32[1] = this.targetDensity;
    f32[2] = this.pressureMultiplier;
    f32[3] = this.viscosity;
    f32[4] = this.nearPressureMultiplier;
    f32[5] = this.nearThreshold;
    u32[6] = N;
    u32[7] = MAX_NEIGHBORS;
    const uniformBuffer = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: velocitiesBuffer } },
        { binding: 1, resource: { buffer: positionsBuffer } },
        { binding: 2, resource: { buffer: densitiesBuffer } },
        { binding: 3, resource: { buffer: nearDensitiesBuffer } },
        { binding: 4, resource: { buffer: neighborIndicesBuffer } },
        { binding: 5, resource: { buffer: neighborCountsBuffer } },
        { binding: 6, resource: { buffer: pinnedFlagsBuffer } },
        { binding: 7, resource: { buffer: uniformBuffer } },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = 64;
    const numGroups = Math.ceil(N / workgroupSize);
    pass.dispatchWorkgroups(numGroups);
    pass.end();

    const readbackBuffer = device.createBuffer({
      size: velocities.byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyBufferToBuffer(
      velocitiesBuffer,
      0,
      readbackBuffer,
      0,
      velocities.byteLength
    );
    device.queue.submit([commandEncoder.finish()]);
    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const out = readbackBuffer.getMappedRange();
    const updated = new Float32Array(out.slice(0));
    readbackBuffer.unmap();

    for (let i = 0; i < N; i++) {
      if (pinnedFlags[i]) continue;
      particles[i].velocity.x = updated[i * 2];
      particles[i].velocity.y = updated[i * 2 + 1];
    }

    positionsBuffer.destroy();
    velocitiesBuffer.destroy();
    densitiesBuffer.destroy();
    nearDensitiesBuffer.destroy();
    neighborIndicesBuffer.destroy();
    neighborCountsBuffer.destroy();
    pinnedFlagsBuffer.destroy();
    uniformBuffer.destroy();
    readbackBuffer.destroy();

    console.log("GPU fluid applied");
  }
}
