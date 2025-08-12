/**
 * CPU/GPU Result Consistency Verification
 * 
 * This module provides comprehensive testing and verification
 * that WebGPU implementations produce identical results to
 * their CPU counterparts within acceptable numerical tolerances.
 */

import { Particle } from '../modules/particle';
import { Vector2D } from '../modules/vector';
import { WebGPUContext } from './webgpu-context';
import { BufferManager } from './buffer-manager';
import { DataSynchronizer } from './data-synchronizer';
import { PhysicsWebGPU } from './forces/physics-webgpu';
import { ParticleDataConverter } from './particle-data';

export interface VerificationOptions {
  /** Numerical tolerance for floating-point comparisons */
  tolerance: number;
  /** Number of test iterations to run */
  iterations: number;
  /** Test particle counts */
  particleCounts: number[];
  /** Random seed for reproducible tests */
  randomSeed?: number;
  /** Whether to log detailed comparison results */
  verbose: boolean;
}

export interface ConsistencyResult {
  /** Whether the test passed */
  passed: boolean;
  /** Test description */
  testName: string;
  /** Number of particles tested */
  particleCount: number;
  /** Number of iterations completed */
  iterations: number;
  /** Maximum difference found */
  maxDifference: number;
  /** Average difference across all comparisons */
  avgDifference: number;
  /** Detailed differences if test failed */
  differences?: Array<{
    particleIndex: number;
    property: string;
    cpuValue: number | [number, number];
    gpuValue: number | [number, number];
    difference: number;
  }>;
  /** Performance comparison */
  performance?: {
    cpuTimeMs: number;
    gpuTimeMs: number;
    speedup: number;
  };
}

export interface VerificationReport {
  /** Overall test results */
  overallPassed: boolean;
  /** Individual test results */
  results: ConsistencyResult[];
  /** Summary statistics */
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    maxDifferenceFound: number;
    avgSpeedup: number;
  };
  /** Test configuration used */
  config: VerificationOptions;
}

/**
 * Verifies CPU and GPU implementation consistency
 */
export class ConsistencyVerifier {
  private context: WebGPUContext;
  private bufferManager: BufferManager;
  private synchronizer: DataSynchronizer;
  private physicsGPU: PhysicsWebGPU;
  private options: VerificationOptions;

  constructor(
    context: WebGPUContext,
    bufferManager: BufferManager,
    synchronizer: DataSynchronizer,
    physicsGPU: PhysicsWebGPU,
    options: Partial<VerificationOptions> = {}
  ) {
    this.context = context;
    this.bufferManager = bufferManager;
    this.synchronizer = synchronizer;
    this.physicsGPU = physicsGPU;
    this.options = {
      tolerance: 1e-4, // 0.0001 tolerance for floating point
      iterations: 10,
      particleCounts: [100, 500, 1000],
      verbose: false,
      ...options
    };
  }

  /**
   * Run comprehensive verification tests
   */
  async runVerification(): Promise<VerificationReport> {
    console.log('Starting CPU/GPU consistency verification...');
    
    const results: ConsistencyResult[] = [];
    
    // Test basic physics forces
    for (const particleCount of this.options.particleCounts) {
      const result = await this.verifyPhysicsConsistency(particleCount);
      results.push(result);
    }
    
    // Generate report
    const report = this.generateReport(results);
    
    if (this.options.verbose) {
      this.logReport(report);
    }
    
    return report;
  }

  /**
   * Verify physics force consistency between CPU and GPU
   */
  async verifyPhysicsConsistency(particleCount: number): Promise<ConsistencyResult> {
    console.log(`Verifying physics consistency with ${particleCount} particles...`);
    
    // Create test particles with deterministic properties
    const testParticles = this.createTestParticles(particleCount);
    
    let maxDifference = 0;
    let totalDifference = 0;
    let comparisonCount = 0;
    let cpuTimeTotal = 0;
    let gpuTimeTotal = 0;
    
    const differences: ConsistencyResult['differences'] = [];
    
    for (let iteration = 0; iteration < this.options.iterations; iteration++) {
      // Clone particles for independent CPU and GPU tests
      const cpuParticles = testParticles.map(p => p.clone());
      const gpuParticles = testParticles.map(p => p.clone());
      
      // Test parameters
      const testParams = {
        gravityStrength: 0.1,
        gravityDirection: { x: 0, y: 1 },
        inertia: 0.99,
        friction: 0.01,
        deltaTime: 0.016,
        bounds: { width: 800, height: 600 }
      };
      
      // Run CPU physics
      const cpuStartTime = performance.now();
      this.applyCPUPhysics(cpuParticles, testParams);
      const cpuTime = performance.now() - cpuStartTime;
      cpuTimeTotal += cpuTime;
      
      // Run GPU physics
      const gpuStartTime = performance.now();
      await this.applyGPUPhysics(gpuParticles, testParams);
      const gpuTime = performance.now() - gpuStartTime;
      gpuTimeTotal += gpuTime;
      
      // Compare results
      for (let i = 0; i < particleCount; i++) {
        const cpuParticle = cpuParticles[i];
        const gpuParticle = gpuParticles[i];
        
        // Compare positions
        const posDiff = this.compareVector2D(
          cpuParticle.position,
          gpuParticle.position,
          'position',
          i,
          differences
        );
        maxDifference = Math.max(maxDifference, posDiff);
        totalDifference += posDiff;
        comparisonCount++;
        
        // Compare velocities
        const velDiff = this.compareVector2D(
          cpuParticle.velocity,
          gpuParticle.velocity,
          'velocity',
          i,
          differences
        );
        maxDifference = Math.max(maxDifference, velDiff);
        totalDifference += velDiff;
        comparisonCount++;
        
        // Compare accelerations
        const accDiff = this.compareVector2D(
          cpuParticle.acceleration,
          gpuParticle.acceleration,
          'acceleration',
          i,
          differences
        );
        maxDifference = Math.max(maxDifference, accDiff);
        totalDifference += accDiff;
        comparisonCount++;
      }
    }
    
    const avgDifference = totalDifference / comparisonCount;
    const passed = maxDifference <= this.options.tolerance;
    const avgCpuTime = cpuTimeTotal / this.options.iterations;
    const avgGpuTime = gpuTimeTotal / this.options.iterations;
    const speedup = avgCpuTime / Math.max(avgGpuTime, 0.001); // Avoid division by zero
    
    return {
      passed,
      testName: 'Physics Force Consistency',
      particleCount,
      iterations: this.options.iterations,
      maxDifference,
      avgDifference,
      differences: passed ? undefined : differences.slice(0, 10), // Show first 10 differences
      performance: {
        cpuTimeMs: avgCpuTime,
        gpuTimeMs: avgGpuTime,
        speedup
      }
    };
  }

  /**
   * Create deterministic test particles
   */
  private createTestParticles(count: number): Particle[] {
    const particles: Particle[] = [];
    
    // Use deterministic random number generator for reproducible tests
    let seed = this.options.randomSeed || 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    for (let i = 0; i < count; i++) {
      const particle = new Particle({
        position: new Vector2D(
          random() * 700 + 50,  // Random position within bounds
          random() * 500 + 50
        ),
        velocity: new Vector2D(
          (random() - 0.5) * 100,  // Random velocity
          (random() - 0.5) * 100
        ),
        mass: random() * 2 + 0.5,  // Random mass between 0.5 and 2.5
        size: random() * 10 + 2,   // Random size between 2 and 12
        color: '#ffffff'
      });
      
      particles.push(particle);
    }
    
    return particles;
  }

  /**
   * Apply CPU physics to particles (simplified)
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
      const accelDelta = particle.acceleration.clone().multiply(params.deltaTime);
      particle.velocity.add(accelDelta);
      
      // Apply inertia
      particle.velocity.multiply(params.inertia);
      
      // Update position
      const velDelta = particle.velocity.clone().multiply(params.deltaTime);
      particle.position.add(velDelta);
      
      // Simple boundary handling
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
   * Apply GPU physics to particles
   */
  private async applyGPUPhysics(particles: Particle[], params: any): Promise<void> {
    // Sync particles to GPU
    await this.synchronizer.syncToGPU(particles);
    
    // Apply GPU physics
    const particleBuffer = this.synchronizer.getCurrentGPUBuffer();
    await this.physicsGPU.applyPhysics(particleBuffer, particles.length, params);
    
    // Sync results back to CPU
    const updatedParticles = await this.synchronizer.syncFromGPU();
    
    // Copy results back to input array
    for (let i = 0; i < particles.length; i++) {
      if (i < updatedParticles.length) {
        particles[i] = updatedParticles[i];
      }
    }
  }

  /**
   * Compare two Vector2D objects and record differences
   */
  private compareVector2D(
    cpu: Vector2D,
    gpu: Vector2D,
    property: string,
    particleIndex: number,
    differences: ConsistencyResult['differences']
  ): number {
    const xDiff = Math.abs(cpu.x - gpu.x);
    const yDiff = Math.abs(cpu.y - gpu.y);
    const maxDiff = Math.max(xDiff, yDiff);
    
    if (maxDiff > this.options.tolerance && differences) {
      differences.push({
        particleIndex,
        property,
        cpuValue: [cpu.x, cpu.y],
        gpuValue: [gpu.x, gpu.y],
        difference: maxDiff
      });
    }
    
    return maxDiff;
  }

  /**
   * Generate comprehensive verification report
   */
  private generateReport(results: ConsistencyResult[]): VerificationReport {
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;
    const maxDifferenceFound = Math.max(...results.map(r => r.maxDifference));
    
    let totalSpeedup = 0;
    let speedupCount = 0;
    
    for (const result of results) {
      if (result.performance && result.performance.speedup > 0) {
        totalSpeedup += result.performance.speedup;
        speedupCount++;
      }
    }
    
    const avgSpeedup = speedupCount > 0 ? totalSpeedup / speedupCount : 0;
    
    return {
      overallPassed: failedTests === 0,
      results,
      summary: {
        totalTests: results.length,
        passedTests,
        failedTests,
        maxDifferenceFound,
        avgSpeedup
      },
      config: this.options
    };
  }

  /**
   * Log detailed verification report
   */
  private logReport(report: VerificationReport): void {
    console.log('\n=== CPU/GPU Consistency Verification Report ===');
    console.log(`Overall Result: ${report.overallPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
    console.log(`Max Difference: ${report.summary.maxDifferenceFound.toExponential(3)}`);
    console.log(`Average Speedup: ${report.summary.avgSpeedup.toFixed(2)}x`);
    console.log(`Tolerance: ${report.config.tolerance}`);
    
    console.log('\n--- Individual Test Results ---');
    for (const result of report.results) {
      const status = result.passed ? '✓' : '✗';
      const speedup = result.performance ? ` (${result.performance.speedup.toFixed(1)}x speedup)` : '';
      console.log(`${status} ${result.testName} - ${result.particleCount} particles${speedup}`);
      
      if (!result.passed) {
        console.log(`  Max Difference: ${result.maxDifference.toExponential(3)}`);
        console.log(`  Avg Difference: ${result.avgDifference.toExponential(3)}`);
        
        if (result.differences && result.differences.length > 0) {
          console.log('  Sample Differences:');
          for (const diff of result.differences.slice(0, 3)) {
            console.log(`    Particle ${diff.particleIndex} ${diff.property}: CPU=${diff.cpuValue} GPU=${diff.gpuValue} (diff: ${diff.difference.toExponential(3)})`);
          }
        }
      }
    }
    
    console.log('============================================\n');
  }
}