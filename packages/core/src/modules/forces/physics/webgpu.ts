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

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    if (particle.pinned || particle.grabbed) {
      return;
    }

    // Placeholder: batch for future GPU processing
    // For now, fall back to CPU per-particle

    // CPU fallback processing
    this.applyCPU(particle);
  }

  /**
   * Process batched particles on GPU (called after all particles processed)
   */
  after(
    particles: Particle[],
    _deltaTime: number,
    _spatialGrid: SpatialGrid
  ): void | Promise<void> {
    if (!this.gpuAvailable) return;
    return this.runGPUPhysics(particles);
  }

  /**
   * CPU implementation of physics forces (fallback)
   */
  private applyCPU(particle: Particle): void {
    const currentPosition = particle.position.clone();
    const previousPosition = this.previousPositions.get(particle.id);

    // Apply gravity force
    if (this.gravity.strength !== 0) {
      const gravityForce = this.gravity.direction
        .clone()
        .normalize()
        .multiply(this.gravity.strength * particle.mass);
      particle.applyForce(gravityForce);
    }

    // Apply inertia (momentum from actual position change)
    if (this.inertia > 0 && previousPosition) {
      // Calculate actual velocity from position change
      const actualVelocity = currentPosition.clone().subtract(previousPosition);
      const inertiaForce = actualVelocity
        .clone()
        .multiply(this.inertia * particle.mass);
      particle.applyForce(inertiaForce);
    }

    // Apply friction (dampen current velocity)
    if (this.friction > 0) {
      const frictionForce = particle.velocity
        .clone()
        .multiply(-this.friction * particle.mass);
      particle.applyForce(frictionForce);
    }

    // Store current position for next frame
    this.previousPositions.set(particle.id, currentPosition);
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
        count: u32,
      };

      @group(0) @binding(0) var<storage, read_write> velocities: array<vec2<f32>>;
      @group(0) @binding(1) var<storage, read> masses: array<f32>;
      @group(0) @binding(2) var<uniform> params: Params;

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let i: u32 = gid.x;
        if (i >= params.count) { return; }
        // Skip zero-mass (dead) particles implicitly by mass check
        let m: f32 = masses[i];
        var v: vec2<f32> = velocities[i];
        // Gravity
        if (params.gravityStrength != 0.0) {
          let g = normalize(params.gravityDir) * params.gravityStrength * m;
          v = v + g;
        }
        // Friction (simple damping)
        if (params.friction != 0.0) {
          v = v + (-params.friction * m) * v;
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
    for (let j = 0; j < count; j++) {
      const p = particles[indices[j]];
      velocities[j * 2] = p.velocity.x;
      velocities[j * 2 + 1] = p.velocity.y;
      masses[j] = p.mass;
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

    // Uniforms
    const paramsData = new Float32Array([
      this.gravity.direction.x,
      this.gravity.direction.y,
      this.gravity.strength,
      this.friction,
    ]);
    // Pack params into 5 floats (last slot reinterpreted as u32 count via separate buffer)
    // Simpler approach: use a 16-byte aligned uniform buffer with 8 floats
    const uniformData = new ArrayBuffer(32);
    new Float32Array(uniformData, 0, 4).set(paramsData);
    new Uint32Array(uniformData, 16, 1)[0] = count;
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
        { binding: 2, resource: { buffer: uniformBuffer } },
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

    // Write back to particles
    for (let j = 0; j < count; j++) {
      const p = particles[indices[j]];
      p.velocity.x = updated[j * 2];
      p.velocity.y = updated[j * 2 + 1];
    }

    // Cleanup (buffers will be GC'd; explicit destroy if desired)
    velocitiesBuffer.destroy();
    massesBuffer.destroy();
    uniformBuffer.destroy();
    readbackBuffer.destroy();
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
