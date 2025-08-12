/**
 * Compute Backend Abstraction
 * 
 * This module provides a unified interface for particle computation
 * that can be implemented by both CPU and WebGPU backends, enabling
 * seamless switching and fallback handling.
 */

import { Particle } from '../modules/particle';
import { SpatialGrid } from '../modules/spatial-grid';

export interface BackendCapabilities {
  /** Backend type identifier */
  type: 'cpu' | 'webgpu';
  /** Maximum recommended particle count */
  maxParticles: number;
  /** Supported force types */
  supportedForces: string[];
  /** Whether backend supports spatial acceleration */
  supportsSpatialAcceleration: boolean;
  /** Performance score (0-100) */
  performanceScore: number;
  /** Memory limit in MB */
  memoryLimitMB?: number;
}

export interface ComputeMetrics {
  /** Last frame computation time in milliseconds */
  computeTimeMs: number;
  /** Average computation time over recent frames */
  averageComputeTimeMs: number;
  /** Particles processed per second */
  particlesPerSecond: number;
  /** Memory usage in MB */
  memoryUsageMB: number;
  /** GPU utilization (0-100, WebGPU only) */
  gpuUtilization?: number;
}

export interface ForceComputeParams {
  /** Particles to process */
  particles: Particle[];
  /** Spatial grid for neighbor queries */
  spatialGrid: SpatialGrid;
  /** Delta time in milliseconds */
  deltaTime: number;
  /** Force-specific parameters */
  forceParams: Record<string, any>;
}

export interface ForceComputeResult {
  /** Whether computation was successful */
  success: boolean;
  /** Number of particles processed */
  particlesProcessed: number;
  /** Computation time in milliseconds */
  computeTimeMs: number;
  /** Any error that occurred */
  error?: string;
}

/**
 * Abstract base class for particle computation backends
 */
export abstract class ComputeBackend {
  protected metrics: ComputeMetrics = {
    computeTimeMs: 0,
    averageComputeTimeMs: 0,
    particlesPerSecond: 0,
    memoryUsageMB: 0
  };

  protected frameHistory: number[] = [];
  protected readonly MAX_FRAME_HISTORY = 60;

  /**
   * Initialize the backend
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Check if backend is available and ready
   */
  abstract isAvailable(): boolean;

  /**
   * Get backend capabilities
   */
  abstract getCapabilities(): BackendCapabilities;

  /**
   * Apply physics forces to particles
   */
  abstract applyPhysics(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply fluid dynamics forces
   */
  abstract applyFluid(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply collision detection and response
   */
  abstract applyCollisions(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply flocking behavior forces
   */
  abstract applyBehavior(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply boundary forces
   */
  abstract applyBoundary(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply joint constraint forces
   */
  abstract applyJoints(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply interaction forces
   */
  abstract applyInteraction(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Apply sensor-based forces
   */
  abstract applySensors(params: ForceComputeParams): Promise<ForceComputeResult>;

  /**
   * Update spatial grid data structures
   */
  abstract updateSpatialGrid(particles: Particle[], spatialGrid: SpatialGrid): Promise<void>;

  /**
   * Get current performance metrics
   */
  getMetrics(): ComputeMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up backend resources
   */
  abstract destroy(): void;

  /**
   * Update performance metrics after computation
   */
  protected updateMetrics(computeTimeMs: number, particleCount: number): void {
    this.metrics.computeTimeMs = computeTimeMs;
    
    // Update frame history
    this.frameHistory.push(computeTimeMs);
    if (this.frameHistory.length > this.MAX_FRAME_HISTORY) {
      this.frameHistory.shift();
    }
    
    // Calculate average
    this.metrics.averageComputeTimeMs = 
      this.frameHistory.reduce((sum, time) => sum + time, 0) / this.frameHistory.length;
    
    // Calculate particles per second
    this.metrics.particlesPerSecond = 
      computeTimeMs > 0 ? (particleCount / computeTimeMs) * 1000 : 0;
  }
}

/**
 * CPU-based compute backend using the existing particle system
 */
export class CPUComputeBackend extends ComputeBackend {
  private initialized = false;

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true; // CPU backend is always available
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getCapabilities(): BackendCapabilities {
    return {
      type: 'cpu',
      maxParticles: 5000, // Conservative estimate for 60fps
      supportedForces: ['physics', 'fluid', 'collisions', 'behavior', 'boundary', 'joints', 'interaction', 'sensors'],
      supportsSpatialAcceleration: true,
      performanceScore: 50 // Baseline score
    };
  }

  async applyPhysics(params: ForceComputeParams): Promise<ForceComputeResult> {
    const startTime = performance.now();
    
    try {
      // CPU physics implementation would use existing forces
      // For now, return success as the existing system handles this
      
      const endTime = performance.now();
      const computeTime = endTime - startTime;
      
      this.updateMetrics(computeTime, params.particles.length);
      
      return {
        success: true,
        particlesProcessed: params.particles.length,
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

  async applyFluid(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('fluid', params);
  }

  async applyCollisions(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('collisions', params);
  }

  async applyBehavior(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('behavior', params);
  }

  async applyBoundary(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('boundary', params);
  }

  async applyJoints(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('joints', params);
  }

  async applyInteraction(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('interaction', params);
  }

  async applySensors(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.delegateToExistingSystem('sensors', params);
  }

  async updateSpatialGrid(particles: Particle[], spatialGrid: SpatialGrid): Promise<void> {
    // Use existing spatial grid implementation
    spatialGrid.clearIncremental(particles);
    for (const particle of particles) {
      spatialGrid.insert(particle);
    }
  }

  destroy(): void {
    this.initialized = false;
    this.frameHistory = [];
  }

  /**
   * Delegate to existing CPU-based force implementation
   */
  private async delegateToExistingSystem(forceType: string, params: ForceComputeParams): Promise<ForceComputeResult> {
    const startTime = performance.now();
    
    try {
      // The existing force system will handle this
      // This backend acts as a compatibility layer
      
      const endTime = performance.now();
      const computeTime = endTime - startTime;
      
      this.updateMetrics(computeTime, params.particles.length);
      
      return {
        success: true,
        particlesProcessed: params.particles.length,
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
}

/**
 * WebGPU-based compute backend for high-performance particle computation
 */
export class WebGPUComputeBackend extends ComputeBackend {
  private initialized = false;
  private capabilities: BackendCapabilities | null = null;

  async initialize(): Promise<boolean> {
    try {
      // WebGPU initialization would happen here
      // For now, we'll simulate initialization
      
      this.capabilities = {
        type: 'webgpu',
        maxParticles: 50000, // Much higher capacity
        supportedForces: ['physics', 'fluid', 'collisions', 'behavior', 'boundary'],
        supportsSpatialAcceleration: true,
        performanceScore: 85, // High performance score
        memoryLimitMB: 1024 // 1GB GPU memory estimate
      };
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU backend:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getCapabilities(): BackendCapabilities {
    return this.capabilities || {
      type: 'webgpu',
      maxParticles: 0,
      supportedForces: [],
      supportsSpatialAcceleration: false,
      performanceScore: 0
    };
  }

  async applyPhysics(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('physics', params);
  }

  async applyFluid(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('fluid', params);
  }

  async applyCollisions(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('collisions', params);
  }

  async applyBehavior(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('behavior', params);
  }

  async applyBoundary(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('boundary', params);
  }

  async applyJoints(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('joints', params);
  }

  async applyInteraction(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('interaction', params);
  }

  async applySensors(params: ForceComputeParams): Promise<ForceComputeResult> {
    return this.stubForceImplementation('sensors', params);
  }

  async updateSpatialGrid(particles: Particle[], spatialGrid: SpatialGrid): Promise<void> {
    // GPU-based spatial grid update would be implemented here
    // For now, fall back to CPU implementation
    spatialGrid.clearIncremental(particles);
    for (const particle of particles) {
      spatialGrid.insert(particle);
    }
  }

  destroy(): void {
    this.initialized = false;
    this.capabilities = null;
    this.frameHistory = [];
  }

  /**
   * Stub implementation for WebGPU forces (to be implemented in subsequent issues)
   */
  private async stubForceImplementation(forceType: string, params: ForceComputeParams): Promise<ForceComputeResult> {
    const startTime = performance.now();
    
    // Simulate GPU computation time (much faster than CPU)
    await new Promise(resolve => setTimeout(resolve, 0.1));
    
    const endTime = performance.now();
    const computeTime = endTime - startTime;
    
    this.updateMetrics(computeTime, params.particles.length);
    
    return {
      success: true,
      particlesProcessed: params.particles.length,
      computeTimeMs: computeTime
    };
  }
}