/**
 * Performance Monitoring System for Compute Backends
 * 
 * This module provides comprehensive performance tracking, analysis,
 * and reporting for both CPU and WebGPU backends to enable
 * intelligent performance optimization and backend selection.
 */

import { ComputeBackend, ComputeMetrics } from './compute-backend';

export interface PerformanceSnapshot {
  /** Timestamp of the snapshot */
  timestamp: number;
  /** Backend type */
  backend: 'cpu' | 'webgpu';
  /** Number of particles processed */
  particleCount: number;
  /** Frame computation time in milliseconds */
  frameTimeMs: number;
  /** Memory usage in MB */
  memoryUsageMB: number;
  /** Particles processed per second */
  particlesPerSecond: number;
  /** GPU utilization (WebGPU only) */
  gpuUtilization?: number;
  /** Force-specific timings */
  forceTimings?: Map<string, number>;
}

export interface PerformanceComparison {
  /** CPU backend performance */
  cpu: PerformanceSnapshot;
  /** WebGPU backend performance */
  webgpu: PerformanceSnapshot;
  /** Performance improvement factor (webgpu/cpu) */
  improvementFactor: number;
  /** Recommended backend based on analysis */
  recommendedBackend: 'cpu' | 'webgpu';
  /** Reason for recommendation */
  recommendation: string;
}

export interface PerformanceAnalysis {
  /** Current performance trend (improving/degrading/stable) */
  trend: 'improving' | 'degrading' | 'stable';
  /** Average frame time over recent history */
  avgFrameTimeMs: number;
  /** Frame time standard deviation (consistency measure) */
  frameTimeStdDev: number;
  /** 95th percentile frame time (worst case performance) */
  p95FrameTimeMs: number;
  /** Current throughput in particles per second */
  throughputPPS: number;
  /** Performance bottleneck identification */
  bottlenecks: string[];
  /** Performance recommendations */
  recommendations: string[];
}

export interface PerformanceBenchmark {
  /** Particle count for this benchmark */
  particleCount: number;
  /** Backend type */
  backend: 'cpu' | 'webgpu';
  /** Average frame time over benchmark duration */
  avgFrameTimeMs: number;
  /** Minimum frame time (best case) */
  minFrameTimeMs: number;
  /** Maximum frame time (worst case) */
  maxFrameTimeMs: number;
  /** Target was achieved (60fps = 16.67ms) */
  targetAchieved: boolean;
  /** Memory usage during benchmark */
  peakMemoryMB: number;
}

/**
 * Comprehensive performance monitoring and analysis system
 */
export class PerformanceMonitor {
  private snapshots: PerformanceSnapshot[] = [];
  private maxSnapshots: number = 300; // 5 seconds at 60fps
  private benchmarkResults: Map<string, PerformanceBenchmark[]> = new Map();
  
  /** Performance targets */
  private readonly TARGET_FRAME_TIME = 16.67; // 60fps
  private readonly TARGET_FRAME_TIME_BUDGET = 20; // Some tolerance
  
  /**
   * Record a performance snapshot
   */
  recordSnapshot(backend: ComputeBackend, particleCount: number, additionalData?: {
    forceTimings?: Map<string, number>;
  }): void {
    const metrics = backend.getMetrics();
    const capabilities = backend.getCapabilities();
    
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      backend: capabilities.type,
      particleCount,
      frameTimeMs: metrics.computeTimeMs,
      memoryUsageMB: metrics.memoryUsageMB,
      particlesPerSecond: metrics.particlesPerSecond,
      gpuUtilization: metrics.gpuUtilization,
      forceTimings: additionalData?.forceTimings
    };
    
    this.snapshots.push(snapshot);
    
    // Trim snapshots to maintain memory bounds
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Analyze current performance trends
   */
  analyzePerformance(lookbackSeconds: number = 2): PerformanceAnalysis {
    const cutoffTime = Date.now() - (lookbackSeconds * 1000);
    const recentSnapshots = this.snapshots.filter(s => s.timestamp >= cutoffTime);
    
    if (recentSnapshots.length === 0) {
      return {
        trend: 'stable',
        avgFrameTimeMs: 0,
        frameTimeStdDev: 0,
        p95FrameTimeMs: 0,
        throughputPPS: 0,
        bottlenecks: [],
        recommendations: ['Not enough data for analysis']
      };
    }
    
    // Calculate statistics
    const frameTimes = recentSnapshots.map(s => s.frameTimeMs);
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const throughput = recentSnapshots[recentSnapshots.length - 1]?.particlesPerSecond || 0;
    
    // Calculate standard deviation
    const variance = frameTimes.reduce((sum, time) => sum + Math.pow(time - avgFrameTime, 2), 0) / frameTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate 95th percentile
    const sortedTimes = [...frameTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95FrameTime = sortedTimes[p95Index] || 0;
    
    // Determine trend
    const trend = this.calculateTrend(recentSnapshots);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(recentSnapshots, avgFrameTime);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(recentSnapshots, avgFrameTime, p95FrameTime, stdDev);
    
    return {
      trend,
      avgFrameTimeMs: avgFrameTime,
      frameTimeStdDev: stdDev,
      p95FrameTimeMs: p95FrameTime,
      throughputPPS: throughput,
      bottlenecks,
      recommendations
    };
  }

  /**
   * Compare performance between CPU and WebGPU backends
   */
  compareBackends(): PerformanceComparison | null {
    const recentCpuSnapshots = this.snapshots.filter(s => s.backend === 'cpu').slice(-30);
    const recentWebgpuSnapshots = this.snapshots.filter(s => s.backend === 'webgpu').slice(-30);
    
    if (recentCpuSnapshots.length === 0 || recentWebgpuSnapshots.length === 0) {
      return null;
    }
    
    const cpuSnapshot = this.averageSnapshots(recentCpuSnapshots);
    const webgpuSnapshot = this.averageSnapshots(recentWebgpuSnapshots);
    
    const improvementFactor = cpuSnapshot.frameTimeMs > 0 ? 
      cpuSnapshot.frameTimeMs / webgpuSnapshot.frameTimeMs : 1;
    
    const recommendedBackend = this.recommendBackend(cpuSnapshot, webgpuSnapshot);
    const recommendation = this.explainRecommendation(cpuSnapshot, webgpuSnapshot, recommendedBackend);
    
    return {
      cpu: cpuSnapshot,
      webgpu: webgpuSnapshot,
      improvementFactor,
      recommendedBackend,
      recommendation
    };
  }

  /**
   * Run performance benchmark for a specific configuration
   */
  async runBenchmark(
    backend: ComputeBackend, 
    particleCounts: number[], 
    durationSeconds: number = 2
  ): Promise<PerformanceBenchmark[]> {
    const results: PerformanceBenchmark[] = [];
    
    for (const particleCount of particleCounts) {
      console.log(`Running benchmark: ${backend.getCapabilities().type} backend, ${particleCount} particles`);
      
      const startTime = Date.now();
      const frameTimes: number[] = [];
      let peakMemory = 0;
      
      // Run benchmark for specified duration
      while (Date.now() - startTime < durationSeconds * 1000) {
        const frameStart = performance.now();
        
        // Simulate processing (in real implementation, this would be actual particle processing)
        await new Promise(resolve => setTimeout(resolve, 1));
        
        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        frameTimes.push(frameTime);
        
        // Track memory usage
        const metrics = backend.getMetrics();
        peakMemory = Math.max(peakMemory, metrics.memoryUsageMB);
        
        // Small delay to simulate frame timing
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Calculate benchmark results
      const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      const minFrameTime = Math.min(...frameTimes);
      const maxFrameTime = Math.max(...frameTimes);
      const targetAchieved = avgFrameTime <= this.TARGET_FRAME_TIME_BUDGET;
      
      const benchmark: PerformanceBenchmark = {
        particleCount,
        backend: backend.getCapabilities().type,
        avgFrameTimeMs: avgFrameTime,
        minFrameTimeMs: minFrameTime,
        maxFrameTimeMs: maxFrameTime,
        targetAchieved,
        peakMemoryMB: peakMemory
      };
      
      results.push(benchmark);
      
      // Store results for future reference
      const key = backend.getCapabilities().type;
      if (!this.benchmarkResults.has(key)) {
        this.benchmarkResults.set(key, []);
      }
      this.benchmarkResults.get(key)!.push(benchmark);
    }
    
    return results;
  }

  /**
   * Get historical benchmark results
   */
  getBenchmarkHistory(backend?: 'cpu' | 'webgpu'): Map<string, PerformanceBenchmark[]> {
    if (backend) {
      const results = this.benchmarkResults.get(backend);
      return results ? new Map([[backend, results]]) : new Map();
    }
    return new Map(this.benchmarkResults);
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.snapshots = [];
    this.benchmarkResults.clear();
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    snapshots: PerformanceSnapshot[];
    benchmarks: { [backend: string]: PerformanceBenchmark[] };
  } {
    const benchmarks: { [backend: string]: PerformanceBenchmark[] } = {};
    for (const [key, value] of this.benchmarkResults) {
      benchmarks[key] = value;
    }
    
    return {
      snapshots: [...this.snapshots],
      benchmarks
    };
  }

  /**
   * Calculate performance trend from recent snapshots
   */
  private calculateTrend(snapshots: PerformanceSnapshot[]): 'improving' | 'degrading' | 'stable' {
    if (snapshots.length < 10) return 'stable';
    
    const midPoint = Math.floor(snapshots.length / 2);
    const firstHalf = snapshots.slice(0, midPoint);
    const secondHalf = snapshots.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.frameTimeMs, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.frameTimeMs, 0) / secondHalf.length;
    
    const improvement = (firstHalfAvg - secondHalfAvg) / firstHalfAvg;
    
    if (improvement > 0.05) return 'improving'; // 5% improvement
    if (improvement < -0.05) return 'degrading'; // 5% degradation
    return 'stable';
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(snapshots: PerformanceSnapshot[], avgFrameTime: number): string[] {
    const bottlenecks: string[] = [];
    
    // Check if frame time exceeds target
    if (avgFrameTime > this.TARGET_FRAME_TIME_BUDGET) {
      bottlenecks.push(`Frame time ${avgFrameTime.toFixed(2)}ms exceeds 60fps target (${this.TARGET_FRAME_TIME}ms)`);
    }
    
    // Check memory usage
    const avgMemory = snapshots.reduce((sum, s) => sum + s.memoryUsageMB, 0) / snapshots.length;
    if (avgMemory > 500) { // 500MB threshold
      bottlenecks.push(`High memory usage: ${avgMemory.toFixed(1)}MB`);
    }
    
    // Check GPU utilization (WebGPU only)
    const webgpuSnapshots = snapshots.filter(s => s.gpuUtilization !== undefined);
    if (webgpuSnapshots.length > 0) {
      const avgGpuUtil = webgpuSnapshots.reduce((sum, s) => sum + (s.gpuUtilization || 0), 0) / webgpuSnapshots.length;
      if (avgGpuUtil > 90) {
        bottlenecks.push(`GPU utilization high: ${avgGpuUtil.toFixed(1)}%`);
      } else if (avgGpuUtil < 30) {
        bottlenecks.push(`GPU underutilized: ${avgGpuUtil.toFixed(1)}%`);
      }
    }
    
    return bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    snapshots: PerformanceSnapshot[], 
    avgFrameTime: number, 
    p95FrameTime: number, 
    stdDev: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Frame time recommendations
    if (avgFrameTime > this.TARGET_FRAME_TIME_BUDGET) {
      recommendations.push('Consider reducing particle count or switching to WebGPU backend');
    }
    
    // Consistency recommendations
    if (stdDev > avgFrameTime * 0.3) {
      recommendations.push('High frame time variance detected - consider optimizing force calculations');
    }
    
    // Memory recommendations
    const avgMemory = snapshots.reduce((sum, s) => sum + s.memoryUsageMB, 0) / snapshots.length;
    if (avgMemory > 200) {
      recommendations.push('Consider implementing memory pooling or reducing particle data size');
    }
    
    // Backend recommendations
    const hasWebGPU = snapshots.some(s => s.backend === 'webgpu');
    const hasCPU = snapshots.some(s => s.backend === 'cpu');
    
    if (!hasWebGPU && avgFrameTime > this.TARGET_FRAME_TIME) {
      recommendations.push('Try WebGPU backend for better performance with large particle counts');
    }
    
    if (hasWebGPU && hasCPU) {
      const webgpuAvg = snapshots.filter(s => s.backend === 'webgpu').reduce((sum, s) => sum + s.frameTimeMs, 0) / 
                       snapshots.filter(s => s.backend === 'webgpu').length;
      const cpuAvg = snapshots.filter(s => s.backend === 'cpu').reduce((sum, s) => sum + s.frameTimeMs, 0) / 
                    snapshots.filter(s => s.backend === 'cpu').length;
      
      if (cpuAvg < webgpuAvg && snapshots[0].particleCount < 1000) {
        recommendations.push('CPU backend may be more efficient for smaller particle counts');
      }
    }
    
    return recommendations;
  }

  /**
   * Average multiple snapshots into a single representative snapshot
   */
  private averageSnapshots(snapshots: PerformanceSnapshot[]): PerformanceSnapshot {
    if (snapshots.length === 0) {
      throw new Error('Cannot average empty snapshots array');
    }
    
    const avg = snapshots.reduce((sum, snapshot) => ({
      timestamp: Math.max(sum.timestamp, snapshot.timestamp),
      backend: snapshot.backend,
      particleCount: Math.round((sum.particleCount + snapshot.particleCount) / 2),
      frameTimeMs: sum.frameTimeMs + snapshot.frameTimeMs,
      memoryUsageMB: sum.memoryUsageMB + snapshot.memoryUsageMB,
      particlesPerSecond: sum.particlesPerSecond + snapshot.particlesPerSecond,
      gpuUtilization: sum.gpuUtilization !== undefined && snapshot.gpuUtilization !== undefined ?
        (sum.gpuUtilization + snapshot.gpuUtilization) : undefined
    }), snapshots[0]);
    
    return {
      ...avg,
      frameTimeMs: avg.frameTimeMs / snapshots.length,
      memoryUsageMB: avg.memoryUsageMB / snapshots.length,
      particlesPerSecond: avg.particlesPerSecond / snapshots.length,
      gpuUtilization: avg.gpuUtilization !== undefined ? avg.gpuUtilization / snapshots.length : undefined
    };
  }

  /**
   * Recommend backend based on performance comparison
   */
  private recommendBackend(cpu: PerformanceSnapshot, webgpu: PerformanceSnapshot): 'cpu' | 'webgpu' {
    // If WebGPU is significantly faster, recommend it
    if (webgpu.frameTimeMs < cpu.frameTimeMs * 0.8) {
      return 'webgpu';
    }
    
    // If CPU is faster or comparable and uses less memory, recommend it
    if (cpu.frameTimeMs <= webgpu.frameTimeMs && cpu.memoryUsageMB < webgpu.memoryUsageMB) {
      return 'cpu';
    }
    
    // For high particle counts, prefer WebGPU even if marginally slower
    if (webgpu.particleCount > 2000) {
      return 'webgpu';
    }
    
    // Default to faster backend
    return webgpu.frameTimeMs < cpu.frameTimeMs ? 'webgpu' : 'cpu';
  }

  /**
   * Explain backend recommendation
   */
  private explainRecommendation(cpu: PerformanceSnapshot, webgpu: PerformanceSnapshot, recommended: 'cpu' | 'webgpu'): string {
    if (recommended === 'webgpu') {
      const improvement = ((cpu.frameTimeMs - webgpu.frameTimeMs) / cpu.frameTimeMs * 100);
      if (improvement > 20) {
        return `WebGPU is ${improvement.toFixed(1)}% faster (${webgpu.frameTimeMs.toFixed(2)}ms vs ${cpu.frameTimeMs.toFixed(2)}ms)`;
      } else {
        return `WebGPU recommended for high particle count (${webgpu.particleCount}) despite similar performance`;
      }
    } else {
      const memoryAdvantage = webgpu.memoryUsageMB - cpu.memoryUsageMB;
      if (memoryAdvantage > 50) {
        return `CPU uses ${memoryAdvantage.toFixed(1)}MB less memory with comparable performance`;
      } else {
        const improvement = ((webgpu.frameTimeMs - cpu.frameTimeMs) / webgpu.frameTimeMs * 100);
        return `CPU is ${improvement.toFixed(1)}% faster (${cpu.frameTimeMs.toFixed(2)}ms vs ${webgpu.frameTimeMs.toFixed(2)}ms)`;
      }
    }
  }
}