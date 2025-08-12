/**
 * Performance Comparison and Benchmarking System
 * 
 * This module provides comprehensive performance benchmarking
 * between CPU and WebGPU implementations to demonstrate
 * performance improvements and guide backend selection.
 */

import { Particle } from '../modules/particle';
import { Vector2D } from '../modules/vector';
import { WebGPUContext } from './webgpu-context';
import { BufferManager } from './buffer-manager';
import { DataSynchronizer } from './data-synchronizer';
import { PhysicsWebGPU } from './forces/physics-webgpu';

export interface BenchmarkOptions {
  /** Particle counts to test */
  particleCounts: number[];
  /** Duration of each test in seconds */
  testDurationSeconds: number;
  /** Number of warmup frames */
  warmupFrames: number;
  /** Target frame rate for timing */
  targetFPS: number;
  /** Whether to include memory usage measurements */
  measureMemory: boolean;
  /** Random seed for reproducible tests */
  randomSeed?: number;
}

export interface BenchmarkResult {
  /** Number of particles tested */
  particleCount: number;
  /** CPU performance metrics */
  cpu: {
    /** Average frame time in milliseconds */
    avgFrameTimeMs: number;
    /** Minimum frame time */
    minFrameTimeMs: number;
    /** Maximum frame time */
    maxFrameTimeMs: number;
    /** Frames per second */
    fps: number;
    /** Total frames processed */
    totalFrames: number;
    /** Memory usage in MB */
    memoryUsageMB?: number;
  };
  /** GPU performance metrics */
  gpu: {
    /** Average frame time in milliseconds */
    avgFrameTimeMs: number;
    /** Minimum frame time */
    minFrameTimeMs: number;
    /** Maximum frame time */
    maxFrameTimeMs: number;
    /** Frames per second */
    fps: number;
    /** Total frames processed */
    totalFrames: number;
    /** Memory usage in MB */
    memoryUsageMB?: number;
    /** GPU synchronization overhead */
    syncOverheadMs: number;
  };
  /** Performance comparison */
  comparison: {
    /** Performance improvement factor (CPU time / GPU time) */
    speedupFactor: number;
    /** Relative performance description */
    description: string;
    /** Whether GPU is faster */
    gpuFaster: boolean;
  };
}

export interface BenchmarkReport {
  /** Individual benchmark results */
  results: BenchmarkResult[];
  /** Summary statistics */
  summary: {
    /** Average speedup across all tests */
    avgSpeedup: number;
    /** Best speedup achieved */
    maxSpeedup: number;
    /** Particle count threshold where GPU becomes beneficial */
    gpuThresholdParticles?: number;
    /** Recommended backend for different scenarios */
    recommendations: {
      small: 'cpu' | 'webgpu'; // < 1000 particles
      medium: 'cpu' | 'webgpu'; // 1000-5000 particles  
      large: 'cpu' | 'webgpu'; // > 5000 particles
    };
  };
  /** Test configuration */
  config: BenchmarkOptions;
  /** System information */
  system: {
    userAgent: string;
    timestamp: number;
    webgpuSupported: boolean;
  };
}

/**
 * Comprehensive performance benchmarking system
 */
export class PerformanceBenchmark {
  private context: WebGPUContext;
  private bufferManager: BufferManager;
  private synchronizer: DataSynchronizer;
  private physicsGPU: PhysicsWebGPU;
  private options: BenchmarkOptions;

  constructor(
    context: WebGPUContext,
    bufferManager: BufferManager,
    synchronizer: DataSynchronizer,
    physicsGPU: PhysicsWebGPU,
    options: Partial<BenchmarkOptions> = {}
  ) {
    this.context = context;
    this.bufferManager = bufferManager;
    this.synchronizer = synchronizer;
    this.physicsGPU = physicsGPU;
    this.options = {
      particleCounts: [100, 500, 1000, 2500, 5000, 10000],
      testDurationSeconds: 2.0,
      warmupFrames: 30,
      targetFPS: 60,
      measureMemory: true,
      randomSeed: 42,
      ...options
    };
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(): Promise<BenchmarkReport> {
    console.log('Starting comprehensive performance benchmark...');
    console.log(`Testing particle counts: ${this.options.particleCounts.join(', ')}`);
    
    const results: BenchmarkResult[] = [];
    
    for (const particleCount of this.options.particleCounts) {
      console.log(`\nBenchmarking ${particleCount} particles...`);
      
      const result = await this.benchmarkParticleCount(particleCount);
      results.push(result);
      
      // Log intermediate results
      this.logBenchmarkResult(result);
    }
    
    // Generate comprehensive report
    const report = this.generateReport(results);
    
    console.log('\n=== Benchmark Complete ===');
    this.logReport(report);
    
    return report;
  }

  /**
   * Benchmark a specific particle count
   */
  private async benchmarkParticleCount(particleCount: number): Promise<BenchmarkResult> {
    // Create test particles
    const testParticles = this.createBenchmarkParticles(particleCount);
    
    // Test parameters
    const testParams = {
      gravityStrength: 0.1,
      gravityDirection: { x: 0, y: 1 },
      inertia: 0.99,
      friction: 0.01,
      deltaTime: 1000 / this.options.targetFPS,
      bounds: { width: 1920, height: 1080 }
    };
    
    // Benchmark CPU performance
    console.log('  Testing CPU performance...');
    const cpuResults = await this.benchmarkCPU(testParticles, testParams);
    
    // Benchmark GPU performance
    console.log('  Testing GPU performance...');  
    const gpuResults = await this.benchmarkGPU(testParticles, testParams);
    
    // Calculate comparison metrics
    const speedupFactor = cpuResults.avgFrameTimeMs / Math.max(gpuResults.avgFrameTimeMs, 0.001);
    const gpuFaster = speedupFactor > 1.0;
    
    let description = '';
    if (speedupFactor > 10) {
      description = 'GPU significantly faster';
    } else if (speedupFactor > 2) {
      description = 'GPU moderately faster';
    } else if (speedupFactor > 1.2) {
      description = 'GPU slightly faster';
    } else if (speedupFactor > 0.8) {
      description = 'Similar performance';
    } else if (speedupFactor > 0.5) {
      description = 'CPU slightly faster';
    } else {
      description = 'CPU significantly faster';
    }
    
    return {
      particleCount,
      cpu: cpuResults,
      gpu: gpuResults,
      comparison: {
        speedupFactor,
        description,
        gpuFaster
      }
    };
  }

  /**
   * Benchmark CPU performance
   */
  private async benchmarkCPU(particles: Particle[], params: any): Promise<BenchmarkResult['cpu']> {
    const frameTimes: number[] = [];
    let totalFrames = 0;
    let memoryUsageMB = 0;
    
    // Warmup
    for (let i = 0; i < this.options.warmupFrames; i++) {
      const testParticles = particles.map(p => p.clone());
      this.applyCPUPhysics(testParticles, params);
    }
    
    // Measure memory usage
    if (this.options.measureMemory) {
      memoryUsageMB = this.estimateCPUMemoryUsage(particles);
    }
    
    // Run benchmark
    const startTime = performance.now();
    const endTime = startTime + (this.options.testDurationSeconds * 1000);
    
    while (performance.now() < endTime) {
      const frameStart = performance.now();
      
      // Clone particles for independent test
      const testParticles = particles.map(p => p.clone());
      this.applyCPUPhysics(testParticles, params);
      
      const frameTime = performance.now() - frameStart;
      frameTimes.push(frameTime);
      totalFrames++;
    }
    
    // Calculate statistics
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const fps = 1000 / avgFrameTime;
    
    return {
      avgFrameTimeMs: avgFrameTime,
      minFrameTimeMs: minFrameTime,
      maxFrameTimeMs: maxFrameTime,
      fps,
      totalFrames,
      memoryUsageMB: this.options.measureMemory ? memoryUsageMB : undefined
    };
  }

  /**
   * Benchmark GPU performance
   */
  private async benchmarkGPU(particles: Particle[], params: any): Promise<BenchmarkResult['gpu']> {
    const frameTimes: number[] = [];
    const syncTimes: number[] = [];
    let totalFrames = 0;
    let memoryUsageMB = 0;
    
    // Initialize GPU data once
    await this.synchronizer.syncToGPU(particles);
    const particleBuffer = this.synchronizer.getCurrentGPUBuffer();
    
    // Warmup
    for (let i = 0; i < this.options.warmupFrames; i++) {
      await this.physicsGPU.applyPhysics(particleBuffer, particles.length, params);
    }
    
    // Measure memory usage
    if (this.options.measureMemory) {
      memoryUsageMB = this.estimateGPUMemoryUsage(particles);
    }
    
    // Run benchmark
    const startTime = performance.now();
    const endTime = startTime + (this.options.testDurationSeconds * 1000);
    
    while (performance.now() < endTime) {
      const frameStart = performance.now();
      
      // Measure sync overhead
      const syncStart = performance.now();
      await this.synchronizer.syncToGPU(particles);
      const syncTime = performance.now() - syncStart;
      syncTimes.push(syncTime);
      
      // Apply GPU physics
      const gpuBuffer = this.synchronizer.getCurrentGPUBuffer();
      await this.physicsGPU.applyPhysics(gpuBuffer, particles.length, params);
      
      const frameTime = performance.now() - frameStart;
      frameTimes.push(frameTime);
      totalFrames++;
    }
    
    // Calculate statistics
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const fps = 1000 / avgFrameTime;
    const avgSyncOverhead = syncTimes.reduce((sum, time) => sum + time, 0) / syncTimes.length;
    
    return {
      avgFrameTimeMs: avgFrameTime,
      minFrameTimeMs: minFrameTime,
      maxFrameTimeMs: maxFrameTime,
      fps,
      totalFrames,
      memoryUsageMB: this.options.measureMemory ? memoryUsageMB : undefined,
      syncOverheadMs: avgSyncOverhead
    };
  }

  /**
   * Apply CPU physics (simplified version for benchmarking)
   */
  private applyCPUPhysics(particles: Particle[], params: any): void {
    for (const particle of particles) {
      if (particle.pinned || particle.grabbed) continue;
      
      // Reset acceleration
      particle.acceleration.zero();
      
      // Apply gravity
      particle.acceleration.add(
        new Vector2D(
          params.gravityDirection.x * params.gravityStrength,
          params.gravityDirection.y * params.gravityStrength
        )
      );
      
      // Apply friction
      const friction = particle.velocity.clone().multiply(-params.friction);
      particle.acceleration.add(friction.divide(particle.mass));
      
      // Update velocity
      const accelDelta = particle.acceleration.clone().multiply(params.deltaTime * 0.001);
      particle.velocity.add(accelDelta);
      
      // Apply inertia
      particle.velocity.multiply(params.inertia);
      
      // Update position
      const velDelta = particle.velocity.clone().multiply(params.deltaTime * 0.001);
      particle.position.add(velDelta);
      
      // Boundary handling
      if (particle.position.x < particle.size || particle.position.x > params.bounds.width - particle.size) {
        particle.velocity.x *= -0.8;
        particle.position.x = Math.max(particle.size, Math.min(params.bounds.width - particle.size, particle.position.x));
      }
      
      if (particle.position.y < particle.size || particle.position.y > params.bounds.height - particle.size) {
        particle.velocity.y *= -0.8;
        particle.position.y = Math.max(particle.size, Math.min(params.bounds.height - particle.size, particle.position.y));
      }
    }
  }

  /**
   * Create benchmark particles with varied properties
   */
  private createBenchmarkParticles(count: number): Particle[] {
    const particles: Particle[] = [];
    
    // Use deterministic random number generator
    let seed = this.options.randomSeed || 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    for (let i = 0; i < count; i++) {
      const particle = new Particle({
        position: new Vector2D(
          random() * 1800 + 60,  // Random position within bounds
          random() * 1000 + 60
        ),
        velocity: new Vector2D(
          (random() - 0.5) * 200,  // Random velocity
          (random() - 0.5) * 200
        ),
        mass: random() * 3 + 0.5,  // Random mass
        size: random() * 15 + 3,   // Random size
        color: '#ffffff'
      });
      
      // Randomly pin some particles for variety
      if (random() < 0.05) { // 5% pinned
        particle.pinned = true;
      }
      
      particles.push(particle);
    }
    
    return particles;
  }

  /**
   * Estimate CPU memory usage
   */
  private estimateCPUMemoryUsage(particles: Particle[]): number {
    // Rough estimation: each Particle object ~200 bytes in memory
    const particleMemory = particles.length * 200;
    return particleMemory / (1024 * 1024); // Convert to MB
  }

  /**
   * Estimate GPU memory usage
   */
  private estimateGPUMemoryUsage(particles: Particle[]): number {
    // GPU buffer size based on particle layout
    const bufferSize = this.bufferManager.particleLayout.stride * particles.length;
    
    // Add overhead for other GPU buffers (uniforms, staging, etc.)
    const totalGPUMemory = bufferSize * 1.5; // 50% overhead estimate
    return totalGPUMemory / (1024 * 1024); // Convert to MB
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateReport(results: BenchmarkResult[]): BenchmarkReport {
    const speedups = results.map(r => r.comparison.speedupFactor);
    const avgSpeedup = speedups.reduce((sum, s) => sum + s, 0) / speedups.length;
    const maxSpeedup = Math.max(...speedups);
    
    // Find GPU threshold (where GPU becomes faster than CPU)
    let gpuThresholdParticles: number | undefined;
    for (const result of results) {
      if (result.comparison.gpuFaster) {
        gpuThresholdParticles = result.particleCount;
        break;
      }
    }
    
    // Generate recommendations
    const smallRecommendation = results.find(r => r.particleCount >= 500)?.comparison.gpuFaster ? 'webgpu' : 'cpu';
    const mediumRecommendation = results.find(r => r.particleCount >= 2500)?.comparison.gpuFaster ? 'webgpu' : 'cpu';  
    const largeRecommendation = results.find(r => r.particleCount >= 5000)?.comparison.gpuFaster ? 'webgpu' : 'cpu';
    
    return {
      results,
      summary: {
        avgSpeedup,
        maxSpeedup,
        gpuThresholdParticles,
        recommendations: {
          small: smallRecommendation,
          medium: mediumRecommendation,
          large: largeRecommendation
        }
      },
      config: this.options,
      system: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        webgpuSupported: !!navigator.gpu
      }
    };
  }

  /**
   * Log individual benchmark result
   */
  private logBenchmarkResult(result: BenchmarkResult): void {
    console.log(`    CPU: ${result.cpu.avgFrameTimeMs.toFixed(2)}ms (${result.cpu.fps.toFixed(1)} FPS)`);
    console.log(`    GPU: ${result.gpu.avgFrameTimeMs.toFixed(2)}ms (${result.gpu.fps.toFixed(1)} FPS)`);
    console.log(`    Speedup: ${result.comparison.speedupFactor.toFixed(2)}x - ${result.comparison.description}`);
  }

  /**
   * Log comprehensive benchmark report
   */
  private logReport(report: BenchmarkReport): void {
    console.log('\n=== Performance Benchmark Report ===');
    console.log(`Average Speedup: ${report.summary.avgSpeedup.toFixed(2)}x`);
    console.log(`Maximum Speedup: ${report.summary.maxSpeedup.toFixed(2)}x`);
    
    if (report.summary.gpuThresholdParticles) {
      console.log(`GPU becomes beneficial at: ${report.summary.gpuThresholdParticles} particles`);
    } else {
      console.log('GPU not faster than CPU in tested range');
    }
    
    console.log('\n--- Recommendations ---');
    console.log(`Small simulations (<1000): ${report.summary.recommendations.small.toUpperCase()}`);
    console.log(`Medium simulations (1000-5000): ${report.summary.recommendations.medium.toUpperCase()}`);
    console.log(`Large simulations (>5000): ${report.summary.recommendations.large.toUpperCase()}`);
    
    console.log('\n--- Detailed Results ---');
    for (const result of report.results) {
      const status = result.comparison.gpuFaster ? '📈' : '📉';
      console.log(`${status} ${result.particleCount} particles: ${result.comparison.speedupFactor.toFixed(2)}x speedup`);
    }
    
    console.log('=====================================\n');
  }
}