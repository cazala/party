/**
 * WebGPU Fallback Management System
 * 
 * This module provides intelligent fallback strategies when WebGPU
 * is unavailable, fails to initialize, or encounters runtime errors.
 * It ensures seamless operation regardless of WebGPU support.
 */

import { ComputeBackend, CPUComputeBackend, WebGPUComputeBackend } from './compute-backend';
import { WebGPUDetector } from './webgpu-detector';

export interface FallbackEvent {
  /** Event type */
  type: 'initialization' | 'runtime' | 'performance' | 'memory';
  /** Reason for fallback */
  reason: string;
  /** Original backend that failed */
  from: 'webgpu' | 'cpu';
  /** Target fallback backend */
  to: 'webgpu' | 'cpu';
  /** Timestamp of the event */
  timestamp: number;
  /** Additional context data */
  context?: Record<string, any>;
}

export interface FallbackStrategy {
  /** Whether automatic fallback is enabled */
  enabled: boolean;
  /** Performance threshold for fallback (frame time in ms) */
  performanceThreshold: number;
  /** Memory usage threshold for fallback (MB) */
  memoryThreshold: number;
  /** Number of consecutive failures before fallback */
  failureThreshold: number;
  /** Retry attempts before permanent fallback */
  retryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
}

export interface FallbackState {
  /** Current active backend type */
  currentBackend: 'cpu' | 'webgpu';
  /** Whether fallback has been triggered */
  fallbackActive: boolean;
  /** Number of fallback events */
  fallbackCount: number;
  /** Recent failure count */
  recentFailures: number;
  /** Last fallback timestamp */
  lastFallbackTime: number;
  /** Whether system is in retry mode */
  retrying: boolean;
}

/**
 * Manages WebGPU fallback strategies and automatic backend switching
 */
export class FallbackManager {
  private detector: WebGPUDetector;
  private strategy: FallbackStrategy;
  private state: FallbackState;
  private eventHistory: FallbackEvent[] = [];
  private listeners: ((event: FallbackEvent) => void)[] = [];
  
  /** Performance monitoring for fallback decisions */
  private performanceHistory: { timestamp: number; frameTime: number }[] = [];
  private readonly PERFORMANCE_HISTORY_SIZE = 60; // 1 second at 60fps
  
  /** Memory usage tracking */
  private memoryHistory: { timestamp: number; usage: number }[] = [];
  private readonly MEMORY_HISTORY_SIZE = 30; // 30 samples
  
  /** Retry state tracking */
  private retryState: {
    attempts: number;
    nextRetryTime: number;
    originalPreference: 'webgpu' | 'cpu';
  } | null = null;

  constructor(
    detector: WebGPUDetector,
    strategy: Partial<FallbackStrategy> = {}
  ) {
    this.detector = detector;
    this.strategy = {
      enabled: true,
      performanceThreshold: 25, // 40fps equivalent
      memoryThreshold: 1024, // 1GB
      failureThreshold: 3,
      retryAttempts: 2,
      retryDelayMs: 5000, // 5 seconds
      ...strategy
    };
    
    this.state = {
      currentBackend: 'cpu',
      fallbackActive: false,
      fallbackCount: 0,
      recentFailures: 0,
      lastFallbackTime: 0,
      retrying: false
    };
  }

  /**
   * Initialize backend with fallback support
   */
  async initializeWithFallback(
    preferredBackend: 'webgpu' | 'cpu' | 'auto'
  ): Promise<{ backend: ComputeBackend; fallbackTriggered: boolean }> {
    if (!this.strategy.enabled) {
      // Fallback disabled, try preferred backend only
      return await this.initializeSingleBackend(preferredBackend === 'auto' ? 'webgpu' : preferredBackend);
    }

    // Auto-detection for 'auto' preference
    if (preferredBackend === 'auto') {
      const detection = await this.detector.detect();
      preferredBackend = detection.recommendedBackend;
    }

    // Try preferred backend first
    if (preferredBackend === 'webgpu') {
      const result = await this.tryWebGPUInitialization();
      if (result.success) {
        this.state.currentBackend = 'webgpu';
        return { backend: result.backend!, fallbackTriggered: false };
      } else {
        // WebGPU failed, fall back to CPU
        const cpuResult = await this.initializeCPUFallback('initialization', result.error || 'WebGPU initialization failed');
        return { backend: cpuResult, fallbackTriggered: true };
      }
    } else {
      // CPU preferred
      const backend = new CPUComputeBackend();
      await backend.initialize();
      this.state.currentBackend = 'cpu';
      return { backend, fallbackTriggered: false };
    }
  }

  /**
   * Monitor backend performance and trigger fallback if needed
   */
  monitorPerformance(frameTime: number, memoryUsage: number): void {
    const now = Date.now();
    
    // Record performance data
    this.performanceHistory.push({ timestamp: now, frameTime });
    if (this.performanceHistory.length > this.PERFORMANCE_HISTORY_SIZE) {
      this.performanceHistory.shift();
    }
    
    // Record memory data
    this.memoryHistory.push({ timestamp: now, usage: memoryUsage });
    if (this.memoryHistory.length > this.MEMORY_HISTORY_SIZE) {
      this.memoryHistory.shift();
    }
    
    // Check for performance-based fallback
    if (this.strategy.enabled && this.shouldTriggerPerformanceFallback()) {
      this.triggerFallback('performance', 'Performance below threshold');
    }
    
    // Check for memory-based fallback
    if (this.strategy.enabled && this.shouldTriggerMemoryFallback()) {
      this.triggerFallback('memory', 'Memory usage exceeded threshold');
    }
  }

  /**
   * Handle runtime errors and trigger fallback if needed
   */
  handleRuntimeError(error: Error): boolean {
    this.state.recentFailures++;
    
    const event: FallbackEvent = {
      type: 'runtime',
      reason: `Runtime error: ${error.message}`,
      from: this.state.currentBackend,
      to: this.state.currentBackend === 'webgpu' ? 'cpu' : 'webgpu',
      timestamp: Date.now(),
      context: { error: error.message }
    };
    
    this.recordEvent(event);
    
    // Trigger fallback if failure threshold exceeded
    if (this.strategy.enabled && this.state.recentFailures >= this.strategy.failureThreshold) {
      this.triggerFallback('runtime', `${this.state.recentFailures} consecutive failures`);
      return true;
    }
    
    return false;
  }

  /**
   * Attempt to recover WebGPU backend after fallback
   */
  async attemptRecovery(): Promise<boolean> {
    if (!this.strategy.enabled || this.state.currentBackend === 'webgpu') {
      return false;
    }
    
    // Check if retry is possible
    if (this.retryState && this.retryState.attempts >= this.strategy.retryAttempts) {
      return false; // Max retries exceeded
    }
    
    // Check retry timing
    const now = Date.now();
    if (this.retryState && now < this.retryState.nextRetryTime) {
      return false; // Too soon to retry
    }
    
    console.log('Attempting WebGPU recovery...');
    this.state.retrying = true;
    
    try {
      const result = await this.tryWebGPUInitialization();
      if (result.success) {
        // Recovery successful
        this.state.currentBackend = 'webgpu';
        this.state.fallbackActive = false;
        this.state.recentFailures = 0;
        this.state.retrying = false;
        this.retryState = null;
        
        const event: FallbackEvent = {
          type: 'initialization',
          reason: 'WebGPU recovery successful',
          from: 'cpu',
          to: 'webgpu',
          timestamp: now
        };
        
        this.recordEvent(event);
        return true;
      } else {
        // Recovery failed, update retry state
        if (!this.retryState) {
          this.retryState = {
            attempts: 0,
            nextRetryTime: 0,
            originalPreference: 'webgpu'
          };
        }
        
        this.retryState.attempts++;
        this.retryState.nextRetryTime = now + this.strategy.retryDelayMs;
        this.state.retrying = false;
        
        console.log(`WebGPU recovery failed (attempt ${this.retryState.attempts}/${this.strategy.retryAttempts})`);
        return false;
      }
    } catch (error) {
      this.state.retrying = false;
      console.error('WebGPU recovery error:', error);
      return false;
    }
  }

  /**
   * Get current fallback state
   */
  getState(): FallbackState {
    return { ...this.state };
  }

  /**
   * Get fallback strategy configuration
   */
  getStrategy(): FallbackStrategy {
    return { ...this.strategy };
  }

  /**
   * Update fallback strategy
   */
  updateStrategy(newStrategy: Partial<FallbackStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  /**
   * Get fallback event history
   */
  getEventHistory(): FallbackEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Add event listener for fallback events
   */
  addEventListener(listener: (event: FallbackEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: FallbackEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Clear all history and reset state
   */
  reset(): void {
    this.eventHistory = [];
    this.performanceHistory = [];
    this.memoryHistory = [];
    this.retryState = null;
    this.state = {
      currentBackend: 'cpu',
      fallbackActive: false,
      fallbackCount: 0,
      recentFailures: 0,
      lastFallbackTime: 0,
      retrying: false
    };
  }

  /**
   * Try WebGPU initialization
   */
  private async tryWebGPUInitialization(): Promise<{ success: boolean; backend?: ComputeBackend; error?: string }> {
    try {
      const backend = new WebGPUComputeBackend();
      const success = await backend.initialize();
      
      if (success) {
        return { success: true, backend };
      } else {
        backend.destroy();
        return { success: false, error: 'WebGPU initialization returned false' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown WebGPU error'
      };
    }
  }

  /**
   * Initialize single backend without fallback
   */
  private async initializeSingleBackend(
    backend: 'webgpu' | 'cpu'
  ): Promise<{ backend: ComputeBackend; fallbackTriggered: boolean }> {
    if (backend === 'webgpu') {
      const result = await this.tryWebGPUInitialization();
      if (result.success) {
        this.state.currentBackend = 'webgpu';
        return { backend: result.backend!, fallbackTriggered: false };
      } else {
        throw new Error(`WebGPU initialization failed: ${result.error}`);
      }
    } else {
      const cpuBackend = new CPUComputeBackend();
      await cpuBackend.initialize();
      this.state.currentBackend = 'cpu';
      return { backend: cpuBackend, fallbackTriggered: false };
    }
  }

  /**
   * Initialize CPU fallback backend
   */
  private async initializeCPUFallback(
    eventType: FallbackEvent['type'],
    reason: string
  ): Promise<ComputeBackend> {
    const backend = new CPUComputeBackend();
    await backend.initialize();
    
    this.state.currentBackend = 'cpu';
    this.state.fallbackActive = true;
    this.state.fallbackCount++;
    this.state.lastFallbackTime = Date.now();
    
    const event: FallbackEvent = {
      type: eventType,
      reason,
      from: 'webgpu',
      to: 'cpu',
      timestamp: this.state.lastFallbackTime
    };
    
    this.recordEvent(event);
    return backend;
  }

  /**
   * Trigger fallback to alternative backend
   */
  private triggerFallback(type: FallbackEvent['type'], reason: string): void {
    const from = this.state.currentBackend;
    const to = from === 'webgpu' ? 'cpu' : 'webgpu';
    
    this.state.fallbackActive = true;
    this.state.fallbackCount++;
    this.state.lastFallbackTime = Date.now();
    this.state.currentBackend = to;
    
    const event: FallbackEvent = {
      type,
      reason,
      from,
      to,
      timestamp: this.state.lastFallbackTime
    };
    
    this.recordEvent(event);
  }

  /**
   * Check if performance-based fallback should be triggered
   */
  private shouldTriggerPerformanceFallback(): boolean {
    if (this.performanceHistory.length < 30) return false; // Need enough data
    
    const recentFrames = this.performanceHistory.slice(-30);
    const avgFrameTime = recentFrames.reduce((sum, frame) => sum + frame.frameTime, 0) / recentFrames.length;
    
    return avgFrameTime > this.strategy.performanceThreshold;
  }

  /**
   * Check if memory-based fallback should be triggered
   */
  private shouldTriggerMemoryFallback(): boolean {
    if (this.memoryHistory.length < 10) return false; // Need enough data
    
    const recentMemory = this.memoryHistory.slice(-10);
    const avgMemoryUsage = recentMemory.reduce((sum, sample) => sum + sample.usage, 0) / recentMemory.length;
    
    return avgMemoryUsage > this.strategy.memoryThreshold;
  }

  /**
   * Record fallback event and notify listeners
   */
  private recordEvent(event: FallbackEvent): void {
    this.eventHistory.push(event);
    
    // Limit event history size
    if (this.eventHistory.length > 100) {
      this.eventHistory.shift();
    }
    
    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Fallback event listener error:', error);
      }
    }
    
    // Reset recent failures on successful fallback
    if (event.type === 'initialization' && event.reason.includes('successful')) {
      this.state.recentFailures = 0;
    }
  }
}