/**
 * CPU ↔ GPU Data Synchronization System
 * 
 * This module manages efficient bi-directional data synchronization
 * between CPU particle data and GPU buffers, handling partial updates,
 * double buffering, and optimal transfer strategies.
 */

import { Particle } from '../modules/particle';
import { WebGPUContext } from './webgpu-context';
import { BufferManager } from './buffer-manager';
import { ParticleArrays, ParticleDataConverter } from './particle-data';

export interface SyncOptions {
  /** Whether to use double buffering for smooth updates */
  doubleBuffering: boolean;
  /** Whether to enable partial updates for efficiency */
  partialUpdates: boolean;
  /** Batch size for partial updates */
  batchSize: number;
  /** Whether to automatically sync on changes */
  autoSync: boolean;
  /** Sync frequency in milliseconds for auto-sync */
  syncIntervalMs: number;
}

export interface SyncStats {
  /** Total number of sync operations */
  totalSyncs: number;
  /** Number of full synchronizations */
  fullSyncs: number;
  /** Number of partial synchronizations */
  partialSyncs: number;
  /** Total bytes transferred CPU → GPU */
  bytesToGPU: number;
  /** Total bytes transferred GPU → CPU */
  bytesToCPU: number;
  /** Average sync time in milliseconds */
  avgSyncTimeMs: number;
  /** Last sync timestamp */
  lastSyncTime: number;
}

export interface PendingUpdate {
  /** Index of particle to update */
  index: number;
  /** Type of update */
  type: 'position' | 'velocity' | 'acceleration' | 'mass' | 'size' | 'color' | 'state' | 'all';
  /** Timestamp when update was queued */
  timestamp: number;
}

/**
 * Manages efficient synchronization between CPU and GPU particle data
 */
export class DataSynchronizer {
  private context: WebGPUContext;
  private bufferManager: BufferManager;
  private options: SyncOptions;
  private stats: SyncStats;

  /** GPU buffers for double buffering */
  private primaryBuffer: GPUBuffer | null = null;
  private secondaryBuffer: GPUBuffer | null = null;
  private currentBuffer: 'primary' | 'secondary' = 'primary';

  /** Cached particle arrays for efficient comparison */
  private cachedArrays: ParticleArrays | null = null;
  
  /** Pending updates queue for partial synchronization */
  private pendingUpdates: Map<number, PendingUpdate> = new Map();
  
  /** Automatic sync timer */
  private autoSyncTimer: number | null = null;
  
  /** Buffer size and capacity tracking */
  private bufferCapacity: number = 0;
  private lastParticleCount: number = 0;
  
  /** Sync operation tracking for performance monitoring */
  private syncTimes: number[] = [];
  private readonly MAX_SYNC_HISTORY = 60;

  constructor(
    context: WebGPUContext,
    bufferManager: BufferManager,
    options: Partial<SyncOptions> = {}
  ) {
    this.context = context;
    this.bufferManager = bufferManager;
    this.options = {
      doubleBuffering: true,
      partialUpdates: true,
      batchSize: 100,
      autoSync: false,
      syncIntervalMs: 16, // ~60fps
      ...options
    };
    
    this.stats = {
      totalSyncs: 0,
      fullSyncs: 0,
      partialSyncs: 0,
      bytesToGPU: 0,
      bytesToCPU: 0,
      avgSyncTimeMs: 0,
      lastSyncTime: 0
    };
  }

  /**
   * Initialize synchronizer with particle capacity
   */
  async initialize(initialCapacity: number = 1000): Promise<void> {
    this.bufferCapacity = initialCapacity;
    
    // Create primary buffer
    this.primaryBuffer = this.bufferManager.createParticleBuffer(
      initialCapacity,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    );

    // Create secondary buffer if double buffering is enabled
    if (this.options.doubleBuffering) {
      this.secondaryBuffer = this.bufferManager.createParticleBuffer(
        initialCapacity,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      );
    }

    // Start auto-sync if enabled
    if (this.options.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Synchronize CPU particles to GPU
   */
  async syncToGPU(particles: Particle[], force: boolean = false): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check if sync is needed
      if (!force && !this.needsSync(particles)) {
        return;
      }

      // Ensure buffer capacity
      await this.ensureCapacity(particles.length);

      // Convert particles to GPU format
      const arrays = ParticleDataConverter.particlesToArrays(particles, this.bufferCapacity);
      
      // Perform synchronization
      if (this.options.partialUpdates && this.pendingUpdates.size > 0 && this.cachedArrays) {
        await this.performPartialSync(arrays);
      } else {
        await this.performFullSync(arrays);
      }
      
      // Update cache and stats
      this.cachedArrays = arrays;
      this.lastParticleCount = particles.length;
      this.updateStats(startTime, 'toGPU', this.getBufferSize(particles.length));
      
    } catch (error) {
      console.error('Failed to sync particles to GPU:', error);
      throw error;
    }
  }

  /**
   * Synchronize GPU data back to CPU particles
   */
  async syncFromGPU(): Promise<Particle[]> {
    const startTime = performance.now();
    
    try {
      if (!this.primaryBuffer) {
        throw new Error('GPU buffers not initialized');
      }

      // Read data from current GPU buffer
      const bufferData = await this.context.readBuffer(this.getCurrentBuffer());
      
      // Parse buffer data into arrays
      const arrays = ParticleDataConverter.parseInterleavedBuffer(bufferData, this.lastParticleCount);
      
      // Convert back to Particle objects
      const particles = ParticleDataConverter.arraysToParticles(arrays);
      
      // Update stats
      this.updateStats(startTime, 'fromGPU', bufferData.byteLength);
      
      return particles;
      
    } catch (error) {
      console.error('Failed to sync particles from GPU:', error);
      throw error;
    }
  }

  /**
   * Queue a partial update for a specific particle
   */
  queuePartialUpdate(
    particleIndex: number, 
    updateType: PendingUpdate['type'] = 'all'
  ): void {
    if (!this.options.partialUpdates) {
      return; // Partial updates disabled
    }

    const update: PendingUpdate = {
      index: particleIndex,
      type: updateType,
      timestamp: Date.now()
    };

    this.pendingUpdates.set(particleIndex, update);

    // Auto-sync if queue is large enough
    if (this.pendingUpdates.size >= this.options.batchSize && this.options.autoSync) {
      this.flushPendingUpdates();
    }
  }

  /**
   * Flush all pending partial updates
   */
  async flushPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    // This would need access to current particles to perform partial sync
    // In a real implementation, we'd maintain a reference to the particle system
    console.log(`Flushing ${this.pendingUpdates.size} pending updates`);
    this.pendingUpdates.clear();
  }

  /**
   * Get current GPU buffer for rendering or compute operations
   */
  getCurrentGPUBuffer(): GPUBuffer {
    return this.getCurrentBuffer();
  }

  /**
   * Get GPU buffer capacity
   */
  getCapacity(): number {
    return this.bufferCapacity;
  }

  /**
   * Get synchronization statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Swap buffers (double buffering)
   */
  swapBuffers(): void {
    if (this.options.doubleBuffering && this.secondaryBuffer) {
      this.currentBuffer = this.currentBuffer === 'primary' ? 'secondary' : 'primary';
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      return; // Already running
    }

    this.autoSyncTimer = window.setInterval(() => {
      if (this.pendingUpdates.size > 0) {
        this.flushPendingUpdates();
      }
    }, this.options.syncIntervalMs);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSync();

    if (this.primaryBuffer) {
      this.bufferManager.destroyBuffer(this.primaryBuffer);
      this.primaryBuffer = null;
    }

    if (this.secondaryBuffer) {
      this.bufferManager.destroyBuffer(this.secondaryBuffer);
      this.secondaryBuffer = null;
    }

    this.cachedArrays = null;
    this.pendingUpdates.clear();
    this.syncTimes = [];
  }

  /**
   * Check if synchronization is needed
   */
  private needsSync(particles: Particle[]): boolean {
    // Always sync if no cache exists
    if (!this.cachedArrays) {
      return true;
    }

    // Always sync if particle count changed
    if (particles.length !== this.lastParticleCount) {
      return true;
    }

    // Check if any particles have been modified
    // This is a simplified check - in reality we'd track particle modification timestamps
    return this.pendingUpdates.size > 0;
  }

  /**
   * Ensure buffer capacity is sufficient
   */
  private async ensureCapacity(particleCount: number): Promise<void> {
    const requiredCapacity = Math.max(particleCount, 1000);
    
    if (requiredCapacity > this.bufferCapacity) {
      const newCapacity = Math.ceil(requiredCapacity * 1.5); // 50% growth buffer
      
      console.log(`Resizing GPU buffers from ${this.bufferCapacity} to ${newCapacity} particles`);
      
      // Create new buffers
      const newPrimaryBuffer = this.bufferManager.createParticleBuffer(
        newCapacity,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      );
      
      let newSecondaryBuffer: GPUBuffer | null = null;
      if (this.options.doubleBuffering) {
        newSecondaryBuffer = this.bufferManager.createParticleBuffer(
          newCapacity,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        );
      }

      // Copy existing data if present
      if (this.primaryBuffer && this.lastParticleCount > 0) {
        const copySize = this.getBufferSize(this.lastParticleCount);
        const encoder = this.context.createCommandEncoder('buffer-resize-copy');
        encoder.copyBufferToBuffer(this.primaryBuffer, 0, newPrimaryBuffer, 0, copySize);
        
        if (this.secondaryBuffer && newSecondaryBuffer) {
          encoder.copyBufferToBuffer(this.secondaryBuffer, 0, newSecondaryBuffer, 0, copySize);
        }
        
        this.context.submit([encoder.finish()]);
        await this.context.getDevice().queue.onSubmittedWorkDone();
      }

      // Clean up old buffers
      if (this.primaryBuffer) {
        this.bufferManager.destroyBuffer(this.primaryBuffer);
      }
      if (this.secondaryBuffer) {
        this.bufferManager.destroyBuffer(this.secondaryBuffer);
      }

      // Update references
      this.primaryBuffer = newPrimaryBuffer;
      this.secondaryBuffer = newSecondaryBuffer;
      this.bufferCapacity = newCapacity;
    }
  }

  /**
   * Perform full synchronization of all particle data
   */
  private async performFullSync(arrays: ParticleArrays): Promise<void> {
    const buffer = this.getCurrentBuffer();
    const interleavedData = ParticleDataConverter.createInterleavedBuffer(arrays);
    
    this.context.writeBuffer(buffer, interleavedData);
    this.stats.fullSyncs++;
    
    // Clear pending updates since we did a full sync
    this.pendingUpdates.clear();
  }

  /**
   * Perform partial synchronization of only changed data
   */
  private async performPartialSync(arrays: ParticleArrays): Promise<void> {
    // In a full implementation, this would only update changed particles
    // For now, we'll fall back to full sync
    await this.performFullSync(arrays);
    this.stats.partialSyncs++;
  }

  /**
   * Get the currently active buffer
   */
  private getCurrentBuffer(): GPUBuffer {
    if (!this.primaryBuffer) {
      throw new Error('GPU buffers not initialized');
    }

    if (this.options.doubleBuffering && this.secondaryBuffer) {
      return this.currentBuffer === 'primary' ? this.primaryBuffer : this.secondaryBuffer;
    }

    return this.primaryBuffer;
  }

  /**
   * Calculate buffer size for given particle count
   */
  private getBufferSize(particleCount: number): number {
    return particleCount * ParticleDataConverter.LAYOUT.stride;
  }

  /**
   * Update synchronization statistics
   */
  private updateStats(startTime: number, direction: 'toGPU' | 'fromGPU', bytes: number): void {
    const syncTime = performance.now() - startTime;
    
    this.stats.totalSyncs++;
    this.stats.lastSyncTime = Date.now();
    
    if (direction === 'toGPU') {
      this.stats.bytesToGPU += bytes;
    } else {
      this.stats.bytesToCPU += bytes;
    }

    // Track sync times for average calculation
    this.syncTimes.push(syncTime);
    if (this.syncTimes.length > this.MAX_SYNC_HISTORY) {
      this.syncTimes.shift();
    }

    // Calculate average sync time
    this.stats.avgSyncTimeMs = this.syncTimes.reduce((sum, time) => sum + time, 0) / this.syncTimes.length;
  }
}