/**
 * WebGPU Physics Implementation
 *
 * WebGPU-accelerated implementation of physics forces (gravity, inertia, friction)
 * with automatic CPU fallback when WebGPU is unavailable.
 */

import { Vector2D } from "../../vector";
import { Particle } from "../../particle";
import { Force, SpatialGrid } from "../../system";
import {
  PhysicsCPU,
  PhysicsOptions,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
} from "./cpu";

/**
 * WebGPU-accelerated physics force implementation
 */
export class PhysicsWebGPU implements Force {
  public gravity: {
    strength: number;
    direction: Vector2D;
  };
  public inertia: number;
  public friction: number;

  // Store previous positions for inertia calculation (CPU fallback)
  private previousPositions: Map<number, Vector2D> = new Map();

  // WebGPU state (lazily initialized)
  private gpuAvailable: boolean =
    typeof navigator !== "undefined" && !!(navigator as any).gpu;
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private shaderModule: GPUShaderModule | null = null;
  private cpuFallback: PhysicsCPU | null = null;

  constructor(options: PhysicsOptions = {}) {
    this.gravity = {
      strength: options.gravity?.strength || DEFAULT_GRAVITY_STRENGTH,
      direction:
        options.gravity?.direction || DEFAULT_GRAVITY_DIRECTION.clone(),
    };

    // Handle angle-based direction setting
    if (options.gravity?.angle !== undefined) {
      this.gravity.direction = Vector2D.fromAngle(options.gravity.angle);
    }

    this.inertia = options.inertia || DEFAULT_INERTIA;
    this.friction = options.friction || DEFAULT_FRICTION;
  }

  private lastDeltaTime: number = 1 / 60;

  before(particles: Particle[], deltaTime: number): void {
    this.lastDeltaTime = deltaTime || this.lastDeltaTime;
    if (!this.gpuAvailable) {
      this.ensureCPUFallback();
      return;
    }
    // Initialize previous position only for new particles; preserve last frame for inertia
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!this.previousPositions.has(p.id)) {
        this.previousPositions.set(p.id, p.position.clone());
      }
    }
  }

  // Gravity methods (backward compatibility)
  get strength(): number {
    return this.gravity.strength;
  }

  set strength(value: number) {
    this.gravity.strength = value;
  }

  get direction(): Vector2D {
    return this.gravity.direction;
  }

  set direction(value: Vector2D) {
    this.gravity.direction = value.clone();
  }

  setStrength(strength: number): void {
    this.gravity.strength = strength;
  }

  setDirection(direction: Vector2D): void {
    this.gravity.direction = direction.clone().normalize();
  }

  /**
   * Set gravity direction from angle in radians
   * @param angle Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up)
   */
  setDirectionFromAngle(angle: number): void {
    this.gravity.direction = Vector2D.fromAngle(angle);
  }

  setInertia(inertia: number): void {
    this.inertia = Math.max(0, Math.min(1, inertia)); // Clamp between 0 and 1
  }

  setFriction(friction: number): void {
    this.friction = Math.max(0, Math.min(1, friction)); // Clamp between 0 and 1
  }

  // System calls the batch signature
  apply(
    particles: Particle[],
    _spatialGrid: SpatialGrid
  ): void | Promise<void> {
    if (!this.gpuAvailable) {
      this.ensureCPUFallback();
      return this.cpuFallback!.apply(particles, _spatialGrid);
    }
    return this.runGPUPhysics(particles);
  }

  /**
   * Process batched particles on GPU (called after all particles processed)
   */
  after(
    _particles: Particle[],
    _deltaTime: number,
    _spatialGrid: SpatialGrid
  ): void | Promise<void> {
    // No-op; GPU work happens in apply()
  }

  private ensureCPUFallback(): void {
    if (!this.cpuFallback) {
      this.cpuFallback = new PhysicsCPU({
        gravity: {
          strength: this.gravity.strength,
          direction: this.gravity.direction.clone(),
        },
        inertia: this.inertia,
        friction: this.friction,
      });
    } else {
      this.cpuFallback.setStrength(this.gravity.strength);
      this.cpuFallback.setDirection(this.gravity.direction);
      this.cpuFallback.setInertia(this.inertia);
      this.cpuFallback.setFriction(this.friction);
    }
  }

  /**
   * Initialize WebGPU device and pipeline
   */
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
        gravityDir: vec2<f32>,
        gravityStrength: f32,
        friction: f32,
        inertia: f32,
        deltaTime: f32,
        count: u32,
        _pad0: u32,
      };

      @group(0) @binding(0) var<storage, read_write> velocities: array<vec2<f32>>;
      @group(0) @binding(1) var<storage, read> masses: array<f32>;
      @group(0) @binding(2) var<storage, read> posCurr: array<vec2<f32>>;
      @group(0) @binding(3) var<storage, read> posPrev: array<vec2<f32>>;
      @group(0) @binding(4) var<uniform> params: Params;

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let i: u32 = gid.x;
        if (i >= params.count) { return; }
        var v: vec2<f32> = velocities[i];
        if (params.gravityStrength != 0.0) {
          let g = normalize(params.gravityDir) * params.gravityStrength * params.deltaTime;
          v = v + g;
        }
        if (params.inertia != 0.0) {
          let disp = posCurr[i] - posPrev[i];
          v = v + disp * (params.inertia * params.deltaTime);
        }
        if (params.friction != 0.0) {
          v = v + (-params.friction) * v * params.deltaTime;
        }
        velocities[i] = v;
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

  /**
   * Run GPU physics for eligible particles (unpinned, not grabbed)
   */
  private async runGPUPhysics(particles: Particle[]): Promise<void> {
    const ok = await this.ensureGPU();
    if (!ok || !this.device || !this.pipeline || !this.bindGroupLayout) return;

    // Collect eligible particles
    const indices: number[] = [];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.pinned && !p.grabbed && p.mass > 0) indices.push(i);
    }
    const count = indices.length;
    if (count === 0) return;

    // Build input arrays
    const velocities = new Float32Array(count * 2);
    const masses = new Float32Array(count);
    const posCurr = new Float32Array(count * 2);
    const posPrev = new Float32Array(count * 2);
    for (let j = 0; j < count; j++) {
      const p = particles[indices[j]];
      velocities[j * 2] = p.velocity.x;
      velocities[j * 2 + 1] = p.velocity.y;
      masses[j] = p.mass;
      posCurr[j * 2] = p.position.x;
      posCurr[j * 2 + 1] = p.position.y;
      const prev = this.previousPositions.get(p.id);
      const px = prev ? prev.x : p.position.x;
      const py = prev ? prev.y : p.position.y;
      posPrev[j * 2] = px;
      posPrev[j * 2 + 1] = py;
    }

    const device = this.device;

    // Create buffers
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

    const massesBuffer = device.createBuffer({
      size: masses.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(massesBuffer, 0, masses.buffer as ArrayBuffer);

    const posCurrBuffer = device.createBuffer({
      size: posCurr.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(posCurrBuffer, 0, posCurr.buffer as ArrayBuffer);

    const posPrevBuffer = device.createBuffer({
      size: posPrev.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(posPrevBuffer, 0, posPrev.buffer as ArrayBuffer);

    // Uniforms
    // 32-byte uniform buffer (8 x 4-byte slots)
    const uniformData = new ArrayBuffer(32);
    const f32 = new Float32Array(uniformData);
    const u32 = new Uint32Array(uniformData);
    f32[0] = this.gravity.direction.x;
    f32[1] = this.gravity.direction.y;
    f32[2] = this.gravity.strength;
    f32[3] = this.friction;
    f32[4] = this.inertia;
    f32[5] = this.lastDeltaTime;
    u32[6] = count;
    const uniformBuffer = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Bind group
    const bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: velocitiesBuffer } },
        { binding: 1, resource: { buffer: massesBuffer } },
        { binding: 2, resource: { buffer: posCurrBuffer } },
        { binding: 3, resource: { buffer: posPrevBuffer } },
        { binding: 4, resource: { buffer: uniformBuffer } },
      ],
    });

    // Encode commands
    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = 64;
    const numGroups = Math.ceil(count / workgroupSize);
    pass.dispatchWorkgroups(numGroups);
    pass.end();

    // Read back velocities
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

    // Resting-state damping: clamp tiny velocities when displacement is negligible
    const velocityEpsilon = 0.05; // units per second
    const displacementEpsilonSq = 0.01 * 0.01; // squared units

    for (let j = 0; j < count; j++) {
      const idx = indices[j];
      const p = particles[idx];
      let vx = updated[j * 2];
      let vy = updated[j * 2 + 1];

      const dx = posCurr[j * 2] - posPrev[j * 2];
      const dy = posCurr[j * 2 + 1] - posPrev[j * 2 + 1];
      const dispSq = dx * dx + dy * dy;

      if (
        Math.abs(vx) < velocityEpsilon &&
        Math.abs(vy) < velocityEpsilon &&
        dispSq < displacementEpsilonSq
      ) {
        vx = 0;
        vy = 0;
      }

      p.velocity.x = vx;
      p.velocity.y = vy;
    }

    // Cleanup (buffers will be GC'd; explicit destroy if desired)
    velocitiesBuffer.destroy();
    massesBuffer.destroy();
    posCurrBuffer.destroy();
    posPrevBuffer.destroy();
    uniformBuffer.destroy();
    readbackBuffer.destroy();

    for (let i = 0; i < particles.length; i++) {
      this.previousPositions.set(
        particles[i].id,
        particles[i].position.clone()
      );
    }
  }

  /**
   * Set the compute backend for GPU acceleration
   */
  // No compute backend abstraction

  /**
   * Clean up stored positions for removed particles
   */
  cleanupRemovedParticles(activeParticleIds: Set<number>): void {
    for (const particleId of this.previousPositions.keys()) {
      if (!activeParticleIds.has(particleId)) {
        this.previousPositions.delete(particleId);
      }
    }
  }

  /**
   * Clear all stored positions (useful for resets)
   */
  clearPositionHistory(): void {
    this.previousPositions.clear();
  }

  clear?(): void {
    this.clearPositionHistory();
  }
}

export function createWebGPUPhysicsForce(
  gravity: { strength?: number; direction?: Vector2D } = {},
  inertia: number = DEFAULT_INERTIA,
  friction: number = DEFAULT_FRICTION
): PhysicsWebGPU {
  return new PhysicsWebGPU({
    gravity,
    inertia,
    friction,
  });
}
