/**
 * WebGPU Physics Force Implementation
 * 
 * This module implements basic physics forces (gravity, friction, inertia)
 * on the GPU using WebGPU compute shaders for high-performance particle
 * simulation with thousands of particles.
 */

import { WebGPUContext } from '../webgpu-context';
import { ShaderManager } from '../shader-manager';
import { BufferManager } from '../buffer-manager';
import { Vector2D } from '../../modules/vector';

export interface PhysicsParams {
  /** Gravity strength */
  gravityStrength: number;
  /** Gravity direction vector */
  gravityDirection: { x: number; y: number };
  /** Inertia factor (0-1) */
  inertia: number;
  /** Friction coefficient (0-1) */
  friction: number;
  /** Delta time for integration */
  deltaTime: number;
  /** Simulation bounds */
  bounds: { width: number; height: number };
}

export interface PhysicsComputeResult {
  /** Whether computation completed successfully */
  success: boolean;
  /** Number of particles processed */
  particlesProcessed: number;
  /** Computation time in milliseconds */
  computeTimeMs: number;
  /** Any errors that occurred */
  error?: string;
}

/**
 * WebGPU implementation of basic physics forces
 */
export class PhysicsWebGPU {
  private context: WebGPUContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;

  /** Compute pipeline for physics update */
  private physicsPipeline: GPUComputePipeline | null = null;
  
  /** Uniform buffer for physics parameters */
  private paramsBuffer: GPUBuffer | null = null;
  
  /** Bind group for compute shader */
  private bindGroup: GPUBindGroup | null = null;
  
  /** Current physics parameters */
  private currentParams: PhysicsParams;

  constructor(
    context: WebGPUContext,
    shaderManager: ShaderManager,
    bufferManager: BufferManager
  ) {
    this.context = context;
    this.shaderManager = shaderManager;
    this.bufferManager = bufferManager;
    
    // Default physics parameters
    this.currentParams = {
      gravityStrength: 0.1,
      gravityDirection: { x: 0, y: 1 },
      inertia: 0.99,
      friction: 0.01,
      deltaTime: 0.016,
      bounds: { width: 800, height: 600 }
    };
  }

  /**
   * Initialize the WebGPU physics system
   */
  async initialize(): Promise<void> {
    // Create physics compute pipeline
    await this.createPhysicsPipeline();
    
    // Create parameter buffer
    await this.createParameterBuffer();
    
    // Create bind group
    await this.createBindGroup();
  }

  /**
   * Apply physics forces to particles on GPU
   */
  async applyPhysics(
    particleBuffer: GPUBuffer,
    particleCount: number,
    params: Partial<PhysicsParams> = {}
  ): Promise<PhysicsComputeResult> {
    const startTime = performance.now();
    
    try {
      if (!this.physicsPipeline || !this.bindGroup) {
        throw new Error('Physics WebGPU not initialized');
      }

      // Update parameters if provided
      const updatedParams = { ...this.currentParams, ...params };
      if (this.paramsChanged(updatedParams)) {
        await this.updateParameters(updatedParams);
        this.currentParams = updatedParams;
      }

      // Create bind group with current particle buffer
      await this.updateBindGroup(particleBuffer);

      // Dispatch compute shader
      const encoder = this.context.createCommandEncoder('physics-compute');
      const computePass = encoder.beginComputePass({
        label: 'physics-force-pass'
      });

      computePass.setPipeline(this.physicsPipeline);
      computePass.setBindGroup(0, this.bindGroup);

      // Calculate workgroups (64 particles per workgroup)
      const workgroups = Math.ceil(particleCount / 64);
      computePass.dispatchWorkgroups(workgroups);

      computePass.end();
      this.context.submit([encoder.finish()]);

      // Wait for completion
      await this.context.getDevice().queue.onSubmittedWorkDone();

      const computeTime = performance.now() - startTime;
      
      return {
        success: true,
        particlesProcessed: particleCount,
        computeTimeMs: computeTime
      };

    } catch (error) {
      return {
        success: false,
        particlesProcessed: 0,
        computeTimeMs: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update physics parameters
   */
  updateParams(params: Partial<PhysicsParams>): void {
    this.currentParams = { ...this.currentParams, ...params };
  }

  /**
   * Get current physics parameters
   */
  getParams(): PhysicsParams {
    return { ...this.currentParams };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.paramsBuffer) {
      this.bufferManager.destroyBuffer(this.paramsBuffer);
      this.paramsBuffer = null;
    }
    
    this.physicsPipeline = null;
    this.bindGroup = null;
  }

  /**
   * Create physics compute pipeline with optimized shader
   */
  private async createPhysicsPipeline(): Promise<void> {
    const physicsShader = `
      // Particle structure matching our data layout
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>, // age, duration
        state: u32,
      }
      
      // Physics parameters uniform buffer
      struct PhysicsParams {
        gravityStrength: f32,
        gravityDirection: vec2<f32>,
        inertia: f32,
        friction: f32,
        deltaTime: f32,
        boundsWidth: f32,
        boundsHeight: f32,
        _padding: f32, // Ensure 16-byte alignment
      }
      
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<uniform> params: PhysicsParams;
      
      // Particle state flags
      const PARTICLE_ACTIVE: u32 = 1u;
      const PARTICLE_PINNED: u32 = 2u;
      const PARTICLE_GRABBED: u32 = 4u;
      const PARTICLE_DEAD: u32 = 8u;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= arrayLength(&particles)) {
          return;
        }
        
        var particle = particles[index];
        
        // Skip inactive, pinned, grabbed, or dead particles
        if ((particle.state & PARTICLE_ACTIVE) == 0u || 
            (particle.state & PARTICLE_PINNED) != 0u ||
            (particle.state & PARTICLE_GRABBED) != 0u ||
            (particle.state & PARTICLE_DEAD) != 0u) {
          return;
        }
        
        // Reset acceleration
        particle.acceleration = vec2<f32>(0.0, 0.0);
        
        // Apply gravity force
        if (params.gravityStrength > 0.0) {
          let gravityForce = params.gravityDirection * params.gravityStrength * particle.mass;
          particle.acceleration += gravityForce / particle.mass;
        }
        
        // Apply friction (velocity damping)
        if (params.friction > 0.0) {
          let frictionForce = -particle.velocity * params.friction;
          particle.acceleration += frictionForce / particle.mass;
        }
        
        // Update velocity using acceleration (Euler integration)
        particle.velocity += particle.acceleration * params.deltaTime;
        
        // Apply inertia (momentum preservation)
        if (params.inertia < 1.0) {
          particle.velocity *= params.inertia;
        }
        
        // Update position using velocity
        particle.position += particle.velocity * params.deltaTime;
        
        // Simple boundary handling (bounce)
        if (particle.position.x < 0.0 || particle.position.x > params.boundsWidth) {
          particle.velocity.x *= -0.8; // Damped bounce
          particle.position.x = clamp(particle.position.x, 0.0, params.boundsWidth);
        }
        
        if (particle.position.y < 0.0 || particle.position.y > params.boundsHeight) {
          particle.velocity.y *= -0.8; // Damped bounce  
          particle.position.y = clamp(particle.position.y, 0.0, params.boundsHeight);
        }
        
        // Write back updated particle
        particles[index] = particle;
      }
    `;

    this.physicsPipeline = this.shaderManager.createComputePipeline({
      shaderSource: physicsShader,
      options: {
        label: 'physics-compute-pipeline',
        entryPoint: 'main'
      }
    });
  }

  /**
   * Create parameter buffer for physics constants
   */
  private async createParameterBuffer(): Promise<void> {
    // Create buffer data with proper alignment
    const paramsData = new Float32Array([
      this.currentParams.gravityStrength,        // f32
      this.currentParams.gravityDirection.x,     // vec2.x
      this.currentParams.gravityDirection.y,     // vec2.y
      this.currentParams.inertia,                // f32
      this.currentParams.friction,               // f32
      this.currentParams.deltaTime,              // f32
      this.currentParams.bounds.width,           // f32
      this.currentParams.bounds.height,          // f32
    ]);

    this.paramsBuffer = this.bufferManager.createUniformBuffer(
      paramsData.buffer,
      'physics-params-buffer'
    );
  }

  /**
   * Create bind group for compute shader
   */
  private async createBindGroup(): Promise<void> {
    // This will be updated with actual particle buffer in updateBindGroup
    this.bindGroup = null;
  }

  /**
   * Update bind group with current particle buffer
   */
  private async updateBindGroup(particleBuffer: GPUBuffer): Promise<void> {
    const device = this.context.getDevice();
    
    if (!this.physicsPipeline || !this.paramsBuffer) {
      throw new Error('Physics pipeline or parameters not initialized');
    }

    this.bindGroup = device.createBindGroup({
      layout: this.physicsPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: particleBuffer }
        },
        {
          binding: 1,
          resource: { buffer: this.paramsBuffer }
        }
      ],
      label: 'physics-bind-group'
    });
  }

  /**
   * Update physics parameters in GPU buffer
   */
  private async updateParameters(params: PhysicsParams): Promise<void> {
    if (!this.paramsBuffer) {
      await this.createParameterBuffer();
      return;
    }

    const paramsData = new Float32Array([
      params.gravityStrength,
      params.gravityDirection.x,
      params.gravityDirection.y,
      params.inertia,
      params.friction,
      params.deltaTime,
      params.bounds.width,
      params.bounds.height,
    ]);

    this.context.writeBuffer(this.paramsBuffer, paramsData.buffer);
  }

  /**
   * Check if parameters have changed
   */
  private paramsChanged(newParams: PhysicsParams): boolean {
    const current = this.currentParams;
    return (
      current.gravityStrength !== newParams.gravityStrength ||
      current.gravityDirection.x !== newParams.gravityDirection.x ||
      current.gravityDirection.y !== newParams.gravityDirection.y ||
      current.inertia !== newParams.inertia ||
      current.friction !== newParams.friction ||
      current.deltaTime !== newParams.deltaTime ||
      current.bounds.width !== newParams.bounds.width ||
      current.bounds.height !== newParams.bounds.height
    );
  }
}