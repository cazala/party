/**
 * WebGPU Module Exports
 * 
 * This file exports all WebGPU-related classes and utilities
 * for use in the particle physics system.
 */

// Core WebGPU infrastructure
export { WebGPUContext } from './webgpu-context';
export { WebGPUDetector } from './webgpu-detector';
export { ShaderManager } from './shader-manager';
export { BufferManager } from './buffer-manager';
export { FallbackManager } from './fallback-manager';

// Compute backend system
export { 
  ComputeBackend, 
  CPUComputeBackend, 
  WebGPUComputeBackend,
  type BackendCapabilities,
  type ComputeMetrics,
  type ForceComputeParams,
  type ForceComputeResult
} from './compute-backend';

// Particle data management
export { 
  ParticleDataConverter,
  type ParticleArrays,
  type ParticleLayout,
  ParticleState
} from './particle-data';

export { DataSynchronizer } from './data-synchronizer';
export { ParticleLifecycleManager } from './particle-lifecycle';

// Performance and monitoring
export { PerformanceMonitor } from './performance-monitor';
export { ConsistencyVerifier } from './verification';
export { PerformanceBenchmark } from './performance-benchmark';

// WebGPU forces
export { PhysicsWebGPU } from './forces/physics-webgpu';

// Type exports for external use
export type {
  WebGPUCapabilities,
  WebGPUContextOptions
} from './webgpu-context';

export type {
  WebGPUDetectionResult,
  FallbackStrategy
} from './webgpu-detector';

export type {
  ShaderCompileOptions,
  ComputePipelineDescriptor,
  ShaderTemplate
} from './shader-manager';

export type {
  BufferDescriptor,
  ParticleBufferLayout
} from './buffer-manager';

export type {
  SyncOptions,
  SyncStats
} from './data-synchronizer';

export type {
  LifecycleOptions,
  LifecycleStats,
  SpawnRequest
} from './particle-lifecycle';

export type {
  FallbackEvent,
  FallbackState
} from './fallback-manager';

export type {
  PerformanceSnapshot,
  PerformanceComparison,
  PerformanceAnalysis,
  PerformanceBenchmark as PerformanceBenchmarkResult
} from './performance-monitor';

export type {
  VerificationOptions,
  ConsistencyResult,
  VerificationReport
} from './verification';

export type {
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkReport
} from './performance-benchmark';

export type {
  PhysicsParams,
  PhysicsComputeResult
} from './forces/physics-webgpu';

/**
 * Initialize WebGPU system with default configuration
 */
export async function initializeWebGPU(options: {
  preferredBackend?: 'cpu' | 'webgpu' | 'auto';
  enableFallback?: boolean;
  debug?: boolean;
} = {}): Promise<{
  context: WebGPUContext;
  detector: WebGPUDetector;
  bufferManager: BufferManager;
  shaderManager: ShaderManager;
  fallbackManager: FallbackManager;
  available: boolean;
}> {
  const context = new WebGPUContext({
    debug: options.debug || false,
    powerPreference: 'high-performance'
  });

  const detector = new WebGPUDetector();
  const detection = await detector.detect();
  
  let available = false;
  if (detection.available) {
    available = await context.initialize();
  }

  const bufferManager = new BufferManager(context);
  const shaderManager = new ShaderManager(context);
  const fallbackManager = new FallbackManager(detector, {
    enabled: options.enableFallback !== false
  });

  return {
    context,
    detector,
    bufferManager,
    shaderManager,
    fallbackManager,
    available
  };
}