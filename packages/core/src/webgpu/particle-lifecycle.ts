/**
 * GPU Particle Lifecycle Management
 * 
 * This module manages particle lifecycle operations on the GPU,
 * including creation, updates, death detection, and cleanup.
 * Optimizes memory usage and performance by handling particle
 * management directly on the GPU.
 */

import { WebGPUContext } from './webgpu-context';
import { ShaderManager } from './shader-manager';
import { BufferManager } from './buffer-manager';
import { ParticleArrays, ParticleState } from './particle-data';

export interface LifecycleOptions {
  /** Maximum number of particles that can be managed */
  maxParticles: number;
  /** Whether to automatically compact arrays when particles die */
  autoCompaction: boolean;
  /** Compaction threshold (fraction of dead particles before compaction) */
  compactionThreshold: number;
  /** Whether to enable particle recycling */
  enableRecycling: boolean;
  /** Maximum age for particle recycling (milliseconds) */
  maxRecycleAge: number;
}

export interface LifecycleStats {
  /** Total number of particles currently active */
  activeParticles: number;
  /** Number of particles that died this frame */
  particlesDied: number;
  /** Number of particles spawned this frame */
  particlesSpawned: number;
  /** Number of particles recycled this frame */
  particlesRecycled: number;
  /** Total number of compaction operations */
  compactionOps: number;
  /** Current fragmentation ratio (0-1, lower is better) */
  fragmentationRatio: number;
}

export interface SpawnRequest {
  /** Position to spawn particle */
  position: [number, number];
  /** Initial velocity */
  velocity?: [number, number];
  /** Particle mass */
  mass?: number;
  /** Particle size */
  size?: number;
  /** Particle color (RGBA) */
  color?: [number, number, number, number];
  /** Particle lifetime in milliseconds (-1 for infinite) */
  lifetime?: number;
}

/**
 * Manages particle lifecycle operations on GPU for optimal performance
 */
export class ParticleLifecycleManager {
  private context: WebGPUContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;
  private options: LifecycleOptions;
  private stats: LifecycleStats;

  /** Main particle data buffer */
  private particleBuffer: GPUBuffer | null = null;
  
  /** Indirect buffer for compute dispatches */
  private indirectBuffer: GPUBuffer | null = null;
  
  /** Counter buffer for active particle count */
  private counterBuffer: GPUBuffer | null = null;
  
  /** Dead particle indices buffer */
  private deadIndicesBuffer: GPUBuffer | null = null;
  
  /** Free particle indices buffer for recycling */
  private freeIndicesBuffer: GPUBuffer | null = null;

  /** Compute pipelines for lifecycle operations */
  private updatePipeline: GPUComputePipeline | null = null;
  private compactionPipeline: GPUComputePipeline | null = null;
  private spawnPipeline: GPUComputePipeline | null = null;
  
  /** Bind groups for compute operations */
  private updateBindGroup: GPUBindGroup | null = null;
  private compactionBindGroup: GPUBindGroup | null = null;
  private spawnBindGroup: GPUBindGroup | null = null;

  /** Current particle capacity */
  private capacity: number = 0;
  
  /** Spawn requests queue */
  private pendingSpawns: SpawnRequest[] = [];

  constructor(
    context: WebGPUContext,
    shaderManager: ShaderManager,
    bufferManager: BufferManager,
    options: Partial<LifecycleOptions> = {}
  ) {
    this.context = context;
    this.shaderManager = shaderManager;
    this.bufferManager = bufferManager;
    this.options = {
      maxParticles: 10000,
      autoCompaction: true,
      compactionThreshold: 0.3, // 30% dead particles
      enableRecycling: true,
      maxRecycleAge: 1000, // 1 second
      ...options
    };

    this.stats = {
      activeParticles: 0,
      particlesDied: 0,
      particlesSpawned: 0,
      particlesRecycled: 0,
      compactionOps: 0,
      fragmentationRatio: 0
    };
  }

  /**
   * Initialize the lifecycle manager
   */
  async initialize(): Promise<void> {
    this.capacity = this.options.maxParticles;
    
    // Create GPU buffers
    await this.createBuffers();
    
    // Create compute pipelines
    await this.createPipelines();
    
    // Create bind groups
    await this.createBindGroups();
  }

  /**
   * Update particle lifecycles on GPU
   */
  async updateLifecycles(deltaTime: number): Promise<void> {
    if (!this.updatePipeline || !this.updateBindGroup) {
      throw new Error('Lifecycle manager not initialized');
    }

    // Reset per-frame stats
    this.stats.particlesDied = 0;
    this.stats.particlesSpawned = 0;
    this.stats.particlesRecycled = 0;

    // Process pending spawns
    if (this.pendingSpawns.length > 0) {
      await this.processSpawnRequests();
    }

    // Update particle ages and detect deaths
    await this.runLifecycleUpdate(deltaTime);

    // Compact arrays if needed
    if (this.options.autoCompaction && this.shouldCompact()) {
      await this.compactParticleArrays();
    }

    // Update stats
    await this.updateStats();
  }

  /**
   * Spawn new particles
   */
  spawnParticles(requests: SpawnRequest[]): void {
    this.pendingSpawns.push(...requests);
  }

  /**
   * Get current lifecycle statistics
   */
  getStats(): LifecycleStats {
    return { ...this.stats };
  }

  /**
   * Get particle buffer for use in other compute operations
   */
  getParticleBuffer(): GPUBuffer {
    if (!this.particleBuffer) {
      throw new Error('Particle buffer not initialized');
    }
    return this.particleBuffer;
  }

  /**
   * Get current particle capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.particleBuffer) this.bufferManager.destroyBuffer(this.particleBuffer);
    if (this.indirectBuffer) this.bufferManager.destroyBuffer(this.indirectBuffer);
    if (this.counterBuffer) this.bufferManager.destroyBuffer(this.counterBuffer);
    if (this.deadIndicesBuffer) this.bufferManager.destroyBuffer(this.deadIndicesBuffer);
    if (this.freeIndicesBuffer) this.bufferManager.destroyBuffer(this.freeIndicesBuffer);

    this.particleBuffer = null;
    this.indirectBuffer = null;
    this.counterBuffer = null;
    this.deadIndicesBuffer = null;
    this.freeIndicesBuffer = null;
    this.updatePipeline = null;
    this.compactionPipeline = null;
    this.spawnPipeline = null;
    this.updateBindGroup = null;
    this.compactionBindGroup = null;
    this.spawnBindGroup = null;
  }

  /**
   * Create GPU buffers for lifecycle management
   */
  private async createBuffers(): Promise<void> {
    const device = this.context.getDevice();

    // Main particle data buffer
    this.particleBuffer = this.bufferManager.createAlignedParticleBuffer(
      this.capacity,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      { enablePooling: false, growthPadding: 0 }
    );

    // Indirect dispatch buffer for compute operations
    this.indirectBuffer = this.bufferManager.createBuffer({
      size: 12, // 3 x u32 for dispatch(x, y, z)
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'particle-indirect-buffer'
    });

    // Counter buffer for tracking active particles
    this.counterBuffer = this.bufferManager.createBuffer({
      size: 16, // Aligned u32 counters: active, dead, spawn, recycle
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'particle-counter-buffer'
    });

    // Dead particle indices for compaction
    this.deadIndicesBuffer = this.bufferManager.createBuffer({
      size: this.capacity * 4, // u32 per potential dead particle
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'dead-indices-buffer'
    });

    // Free particle indices for recycling
    this.freeIndicesBuffer = this.bufferManager.createBuffer({
      size: this.capacity * 4, // u32 per potential free slot
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'free-indices-buffer'
    });

    // Initialize counter buffer
    const initialCounters = new Uint32Array([0, 0, 0, 0]); // active, dead, spawn, recycle
    this.context.writeBuffer(this.counterBuffer, initialCounters);
  }

  /**
   * Create compute pipelines for lifecycle operations
   */
  private async createPipelines(): Promise<void> {
    // Lifecycle update pipeline
    const updateShader = `
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
      
      struct Counters {
        active: atomic<u32>,
        dead: atomic<u32>,
        spawn: atomic<u32>,
        recycle: atomic<u32>,
      }
      
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<storage, read_write> counters: Counters;
      @group(0) @binding(2) var<storage, read_write> deadIndices: array<u32>;
      @group(0) @binding(3) var<uniform> deltaTime: f32;
      
      const PARTICLE_ACTIVE: u32 = 1u;
      const PARTICLE_DEAD: u32 = 8u;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= arrayLength(&particles)) {
          return;
        }
        
        var particle = particles[index];
        
        // Skip already dead particles
        if ((particle.state & PARTICLE_DEAD) != 0u) {
          return;
        }
        
        // Update age if particle has finite lifetime
        if (particle.lifetime.y > 0.0) {
          particle.lifetime.x += deltaTime;
          
          // Check if particle should die
          if (particle.lifetime.x >= particle.lifetime.y) {
            particle.state |= PARTICLE_DEAD;
            let deadIndex = atomicAdd(&counters.dead, 1u);
            deadIndices[deadIndex] = index;
          }
        }
        
        particles[index] = particle;
      }
    `;

    this.updatePipeline = this.shaderManager.createComputePipeline({
      shaderSource: updateShader,
      options: { label: 'particle-lifecycle-update' }
    });

    // Compaction pipeline (simplified version)
    const compactionShader = `
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>,
        state: u32,
      }
      
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      @group(0) @binding(1) var<storage, read> deadIndices: array<u32>;
      @group(0) @binding(2) var<storage, read> counters: array<u32>;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        // Simplified compaction - in practice this would be more complex
        // This is a placeholder for the actual compaction algorithm
      }
    `;

    this.compactionPipeline = this.shaderManager.createComputePipeline({
      shaderSource: compactionShader,
      options: { label: 'particle-compaction' }
    });

    // Spawn pipeline (placeholder)
    const spawnShader = `
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>,
        state: u32,
      }
      
      @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        // Spawn logic would go here
      }
    `;

    this.spawnPipeline = this.shaderManager.createComputePipeline({
      shaderSource: spawnShader,
      options: { label: 'particle-spawn' }
    });
  }

  /**
   * Create bind groups for compute pipelines
   */
  private async createBindGroups(): Promise<void> {
    const device = this.context.getDevice();

    if (!this.particleBuffer || !this.counterBuffer || !this.deadIndicesBuffer) {
      throw new Error('Buffers not initialized');
    }

    // Delta time uniform buffer
    const deltaTimeBuffer = this.bufferManager.createUniformBuffer(
      new Float32Array([0.016]), // 16ms default
      'delta-time-buffer'
    );

    // Update bind group
    this.updateBindGroup = device.createBindGroup({
      layout: this.updatePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.counterBuffer } },
        { binding: 2, resource: { buffer: this.deadIndicesBuffer } },
        { binding: 3, resource: { buffer: deltaTimeBuffer } }
      ]
    });

    // Compaction bind group
    this.compactionBindGroup = device.createBindGroup({
      layout: this.compactionPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.deadIndicesBuffer } },
        { binding: 2, resource: { buffer: this.counterBuffer } }
      ]
    });

    // Spawn bind group
    this.spawnBindGroup = device.createBindGroup({
      layout: this.spawnPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } }
      ]
    });
  }

  /**
   * Process pending spawn requests
   */
  private async processSpawnRequests(): Promise<void> {
    // In a full implementation, this would upload spawn data to GPU
    // and run the spawn compute shader
    this.stats.particlesSpawned += this.pendingSpawns.length;
    this.pendingSpawns = [];
  }

  /**
   * Run lifecycle update compute shader
   */
  private async runLifecycleUpdate(deltaTime: number): Promise<void> {
    if (!this.updatePipeline || !this.updateBindGroup) {
      throw new Error('Update pipeline not initialized');
    }

    const encoder = this.context.createCommandEncoder('lifecycle-update');
    const computePass = encoder.beginComputePass();
    
    computePass.setPipeline(this.updatePipeline);
    computePass.setBindGroup(0, this.updateBindGroup);
    
    const workgroups = Math.ceil(this.stats.activeParticles / 64);
    computePass.dispatchWorkgroups(workgroups);
    
    computePass.end();
    this.context.submit([encoder.finish()]);
  }

  /**
   * Check if array compaction is needed
   */
  private shouldCompact(): boolean {
    if (this.stats.activeParticles === 0) return false;
    
    const deadRatio = this.stats.particlesDied / this.stats.activeParticles;
    return deadRatio >= this.options.compactionThreshold;
  }

  /**
   * Compact particle arrays to remove dead particles
   */
  private async compactParticleArrays(): Promise<void> {
    if (!this.compactionPipeline || !this.compactionBindGroup) {
      throw new Error('Compaction pipeline not initialized');
    }

    const encoder = this.context.createCommandEncoder('particle-compaction');
    const computePass = encoder.beginComputePass();
    
    computePass.setPipeline(this.compactionPipeline);
    computePass.setBindGroup(0, this.compactionBindGroup);
    
    const workgroups = Math.ceil(this.capacity / 64);
    computePass.dispatchWorkgroups(workgroups);
    
    computePass.end();
    this.context.submit([encoder.finish()]);
    
    this.stats.compactionOps++;
  }

  /**
   * Update lifecycle statistics
   */
  private async updateStats(): Promise<void> {
    // In a full implementation, this would read back counter values from GPU
    // For now, we'll use placeholder logic
    
    this.stats.fragmentationRatio = this.stats.activeParticles > 0 ? 
      this.stats.particlesDied / this.stats.activeParticles : 0;
  }
}