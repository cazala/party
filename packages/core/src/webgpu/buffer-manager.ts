/**
 * WebGPU Buffer Management System
 * 
 * This module provides efficient GPU buffer management for particle data,
 * including memory pooling, automatic resizing, and optimized data layouts.
 */

import { WebGPUContext } from './webgpu-context';

export interface BufferDescriptor {
  /** Buffer size in bytes */
  size: number;
  /** Buffer usage flags */
  usage: GPUBufferUsageFlags;
  /** Buffer label for debugging */
  label?: string;
  /** Whether buffer should be mappable for reading */
  mappableForRead?: boolean;
}

export interface ParticleBufferLayout {
  /** Position data (vec2<f32>) */
  position: { offset: number; size: number };
  /** Velocity data (vec2<f32>) */
  velocity: { offset: number; size: number };
  /** Acceleration data (vec2<f32>) */
  acceleration: { offset: number; size: number };
  /** Mass data (f32) */
  mass: { offset: number; size: number };
  /** Size/radius data (f32) */
  size: { offset: number; size: number };
  /** Color data (vec4<f32>) */
  color: { offset: number; size: number };
  /** Total stride per particle */
  stride: number;
}

export interface BufferPool {
  /** Available buffers in the pool */
  available: GPUBuffer[];
  /** Currently in-use buffers */
  inUse: Set<GPUBuffer>;
  /** Buffer descriptor template */
  descriptor: BufferDescriptor;
}

/**
 * Manages GPU buffers for efficient particle data storage and manipulation
 */
export class BufferManager {
  private context: WebGPUContext;
  private bufferPools: Map<string, BufferPool> = new Map();
  private managedBuffers: Set<GPUBuffer> = new Set();
  
  /** Standard particle buffer layout (Structure of Arrays approach) */
  public readonly particleLayout: ParticleBufferLayout;
  
  /** Alignment requirements for uniform buffers */
  private readonly UNIFORM_BUFFER_ALIGNMENT = 256;
  
  /** Alignment requirements for storage buffers */
  private readonly STORAGE_BUFFER_ALIGNMENT = 16;

  constructor(context: WebGPUContext) {
    this.context = context;
    
    // Define optimized particle layout (Structure of Arrays for better GPU performance)
    this.particleLayout = {
      position: { offset: 0, size: 8 },      // vec2<f32> = 8 bytes
      velocity: { offset: 8, size: 8 },      // vec2<f32> = 8 bytes  
      acceleration: { offset: 16, size: 8 }, // vec2<f32> = 8 bytes
      mass: { offset: 24, size: 4 },         // f32 = 4 bytes
      size: { offset: 28, size: 4 },         // f32 = 4 bytes
      color: { offset: 32, size: 16 },       // vec4<f32> = 16 bytes
      stride: 48 // Total: 48 bytes per particle (aligned to 16 bytes)
    };
  }

  /**
   * Create a buffer with automatic size alignment
   */
  createBuffer(descriptor: BufferDescriptor): GPUBuffer {
    // Align buffer size based on usage
    const alignedSize = this.alignBufferSize(descriptor.size, descriptor.usage);
    
    const alignedDescriptor: GPUBufferDescriptor = {
      size: alignedSize,
      usage: descriptor.usage,
      label: descriptor.label,
      mappedAtCreation: false
    };

    const buffer = this.context.createBuffer(alignedDescriptor);
    this.managedBuffers.add(buffer);
    
    return buffer;
  }

  /**
   * Create a buffer from pool or new if pool is empty
   */
  getPooledBuffer(descriptor: BufferDescriptor): GPUBuffer {
    const poolKey = this.createPoolKey(descriptor);
    let pool = this.bufferPools.get(poolKey);
    
    if (!pool) {
      pool = {
        available: [],
        inUse: new Set(),
        descriptor: { ...descriptor }
      };
      this.bufferPools.set(poolKey, pool);
    }

    // Try to get buffer from pool
    if (pool.available.length > 0) {
      const buffer = pool.available.pop()!;
      pool.inUse.add(buffer);
      return buffer;
    }

    // Create new buffer if pool is empty
    const buffer = this.createBuffer(descriptor);
    pool.inUse.add(buffer);
    return buffer;
  }

  /**
   * Return a buffer to its pool
   */
  returnBufferToPool(buffer: GPUBuffer): void {
    // Find which pool this buffer belongs to
    for (const pool of this.bufferPools.values()) {
      if (pool.inUse.has(buffer)) {
        pool.inUse.delete(buffer);
        pool.available.push(buffer);
        return;
      }
    }
  }

  /**
   * Create particle data buffer with optimal layout
   */
  createParticleBuffer(particleCount: number, usage: GPUBufferUsageFlags = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST): GPUBuffer {
    const bufferSize = particleCount * this.particleLayout.stride;
    
    return this.createBuffer({
      size: bufferSize,
      usage,
      label: `particle-buffer-${particleCount}`
    });
  }

  /**
   * Create uniform buffer for compute shader constants
   */
  createUniformBuffer(data: ArrayBuffer, label?: string): GPUBuffer {
    const alignedSize = this.alignBufferSize(data.byteLength, GPUBufferUsage.UNIFORM);
    
    const buffer = this.createBuffer({
      size: alignedSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label
    });

    // Write data to buffer
    this.context.writeBuffer(buffer, data);
    
    return buffer;
  }

  /**
   * Create staging buffer for CPU-GPU data transfers
   */
  createStagingBuffer(size: number, label?: string): GPUBuffer {
    return this.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: label || 'staging-buffer',
      mappableForRead: true
    });
  }

  /**
   * Resize a buffer while preserving existing data
   */
  async resizeBuffer(
    oldBuffer: GPUBuffer, 
    newSize: number, 
    usage: GPUBufferUsageFlags,
    preserveData: boolean = true
  ): Promise<GPUBuffer> {
    const newBuffer = this.createBuffer({
      size: newSize,
      usage,
      label: 'resized-buffer'
    });

    if (preserveData && oldBuffer.size > 0) {
      // Copy existing data to new buffer
      const encoder = this.context.createCommandEncoder('resize-buffer-copy');
      const copySize = Math.min(oldBuffer.size, newSize);
      encoder.copyBufferToBuffer(oldBuffer, 0, newBuffer, 0, copySize);
      this.context.submit([encoder.finish()]);
      
      // Wait for copy to complete
      await this.context.getDevice().queue.onSubmittedWorkDone();
    }

    // Clean up old buffer
    this.destroyBuffer(oldBuffer);
    
    return newBuffer;
  }

  /**
   * Write particle data to buffer with proper layout
   */
  writeParticleData(
    buffer: GPUBuffer, 
    particles: Array<{
      position: [number, number];
      velocity: [number, number];
      acceleration: [number, number];
      mass: number;
      size: number;
      color: [number, number, number, number];
    }>,
    offset: number = 0
  ): void {
    const arrayBuffer = new ArrayBuffer(particles.length * this.particleLayout.stride);
    const view = new DataView(arrayBuffer);
    
    for (let i = 0; i < particles.length; i++) {
      const particleOffset = i * this.particleLayout.stride;
      const particle = particles[i];
      
      // Position (vec2<f32>)
      view.setFloat32(particleOffset + this.particleLayout.position.offset, particle.position[0], true);
      view.setFloat32(particleOffset + this.particleLayout.position.offset + 4, particle.position[1], true);
      
      // Velocity (vec2<f32>)
      view.setFloat32(particleOffset + this.particleLayout.velocity.offset, particle.velocity[0], true);
      view.setFloat32(particleOffset + this.particleLayout.velocity.offset + 4, particle.velocity[1], true);
      
      // Acceleration (vec2<f32>)
      view.setFloat32(particleOffset + this.particleLayout.acceleration.offset, particle.acceleration[0], true);
      view.setFloat32(particleOffset + this.particleLayout.acceleration.offset + 4, particle.acceleration[1], true);
      
      // Mass (f32)
      view.setFloat32(particleOffset + this.particleLayout.mass.offset, particle.mass, true);
      
      // Size (f32)
      view.setFloat32(particleOffset + this.particleLayout.size.offset, particle.size, true);
      
      // Color (vec4<f32>)
      view.setFloat32(particleOffset + this.particleLayout.color.offset, particle.color[0], true);
      view.setFloat32(particleOffset + this.particleLayout.color.offset + 4, particle.color[1], true);
      view.setFloat32(particleOffset + this.particleLayout.color.offset + 8, particle.color[2], true);
      view.setFloat32(particleOffset + this.particleLayout.color.offset + 12, particle.color[3], true);
    }
    
    this.context.writeBuffer(buffer, arrayBuffer, offset);
  }

  /**
   * Read particle data from buffer
   */
  async readParticleData(buffer: GPUBuffer, particleCount: number): Promise<ArrayBuffer> {
    const expectedSize = particleCount * this.particleLayout.stride;
    if (buffer.size < expectedSize) {
      throw new Error(`Buffer too small: expected ${expectedSize}, got ${buffer.size}`);
    }
    
    return await this.context.readBuffer(buffer);
  }

  /**
   * Get buffer memory usage statistics
   */
  getMemoryUsage(): {
    totalAllocated: number;
    activeBuffers: number;
    pooledBuffers: number;
    pools: Map<string, { available: number; inUse: number }>;
  } {
    let totalAllocated = 0;
    let pooledBuffers = 0;
    const poolStats = new Map<string, { available: number; inUse: number }>();
    
    // Count managed buffers
    for (const buffer of this.managedBuffers) {
      totalAllocated += buffer.size;
    }
    
    // Count pooled buffers
    for (const [key, pool] of this.bufferPools) {
      pooledBuffers += pool.available.length + pool.inUse.size;
      poolStats.set(key, {
        available: pool.available.length,
        inUse: pool.inUse.size
      });
    }
    
    return {
      totalAllocated,
      activeBuffers: this.managedBuffers.size,
      pooledBuffers,
      pools: poolStats
    };
  }

  /**
   * Destroy a buffer and remove from management
   */
  destroyBuffer(buffer: GPUBuffer): void {
    this.context.destroyBuffer(buffer);
    this.managedBuffers.delete(buffer);
    
    // Remove from any pools
    for (const pool of this.bufferPools.values()) {
      pool.inUse.delete(buffer);
      const availableIndex = pool.available.indexOf(buffer);
      if (availableIndex !== -1) {
        pool.available.splice(availableIndex, 1);
      }
    }
  }

  /**
   * Clean up all managed resources
   */
  destroy(): void {
    // Destroy all managed buffers
    for (const buffer of this.managedBuffers) {
      buffer.destroy();
    }
    
    // Clear pools
    for (const pool of this.bufferPools.values()) {
      for (const buffer of pool.available) {
        buffer.destroy();
      }
      for (const buffer of pool.inUse) {
        buffer.destroy();
      }
    }
    
    this.managedBuffers.clear();
    this.bufferPools.clear();
  }

  /**
   * Align buffer size to proper boundaries
   */
  private alignBufferSize(size: number, usage: GPUBufferUsageFlags): number {
    let alignment = 4; // Default alignment
    
    if (usage & GPUBufferUsage.UNIFORM) {
      alignment = this.UNIFORM_BUFFER_ALIGNMENT;
    } else if (usage & GPUBufferUsage.STORAGE) {
      alignment = this.STORAGE_BUFFER_ALIGNMENT;
    }
    
    return Math.ceil(size / alignment) * alignment;
  }

  /**
   * Create cache key for buffer pooling
   */
  private createPoolKey(descriptor: BufferDescriptor): string {
    return `${descriptor.size}-${descriptor.usage}-${descriptor.mappableForRead ? '1' : '0'}`;
  }
}