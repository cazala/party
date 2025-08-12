/**
 * WebGPU Device Detection and Fallback Handling
 * 
 * This module provides comprehensive WebGPU availability detection,
 * device capability assessment, and fallback strategy management.
 */

export interface WebGPUDetectionResult {
  /** Whether WebGPU is available and functional */
  available: boolean;
  /** Reason why WebGPU is not available (if applicable) */
  unavailableReason?: string;
  /** Detected device capabilities */
  capabilities?: WebGPUCapabilities;
  /** Recommended backend based on performance expectations */
  recommendedBackend: 'webgpu' | 'cpu';
  /** Performance score (0-100, higher is better) */
  performanceScore: number;
}

export interface WebGPUCapabilities {
  /** Maximum buffer size in bytes */
  maxBufferSize: number;
  /** Maximum compute workgroups per dimension */
  maxComputeWorkgroupsPerDimension: number;
  /** Maximum compute workgroup size */
  maxComputeWorkgroupSize: number;
  /** Device memory estimate in MB (if available) */
  deviceMemoryMB?: number;
  /** Device vendor (nvidia, amd, intel, etc.) */
  vendor?: string;
  /** Device architecture info */
  architecture?: string;
  /** Supported features */
  supportedFeatures: string[];
}

export interface FallbackStrategy {
  /** Whether to automatically fall back to CPU */
  autoFallback: boolean;
  /** Performance threshold below which to use CPU (0-100) */
  performanceThreshold: number;
  /** Particle count threshold above which WebGPU is preferred */
  particleCountThreshold: number;
  /** Memory usage threshold in MB above which to use WebGPU */
  memoryThreshold: number;
}

/**
 * WebGPU Detector handles device detection, capability assessment,
 * and fallback strategy recommendations.
 */
export class WebGPUDetector {
  private detectionCache: WebGPUDetectionResult | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Detect WebGPU availability and capabilities
   * @param force Force new detection, ignoring cache
   */
  async detect(force: boolean = false): Promise<WebGPUDetectionResult> {
    // Return cached result if available and fresh
    const now = Date.now();
    if (!force && this.detectionCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.detectionCache;
    }

    const result = await this.performDetection();
    
    // Cache the result
    this.detectionCache = result;
    this.cacheTimestamp = now;
    
    return result;
  }

  /**
   * Get recommended backend based on system capabilities and usage
   */
  getRecommendedBackend(
    particleCount: number,
    strategy: Partial<FallbackStrategy> = {}
  ): Promise<'webgpu' | 'cpu'> {
    return this.detect().then(result => {
      const defaultStrategy: FallbackStrategy = {
        autoFallback: true,
        performanceThreshold: 30,
        particleCountThreshold: 1000,
        memoryThreshold: 50,
        ...strategy
      };

      // If WebGPU is not available, use CPU
      if (!result.available) {
        return 'cpu';
      }

      // If performance score is below threshold, use CPU
      if (result.performanceScore < defaultStrategy.performanceThreshold) {
        return 'cpu';
      }

      // If particle count is above threshold and WebGPU performs well, use WebGPU
      if (particleCount >= defaultStrategy.particleCountThreshold && 
          result.performanceScore > 50) {
        return 'webgpu';
      }

      // For smaller particle counts, CPU might be more efficient
      if (particleCount < defaultStrategy.particleCountThreshold) {
        return result.performanceScore > 70 ? 'webgpu' : 'cpu';
      }

      return result.recommendedBackend;
    });
  }

  /**
   * Check if WebGPU is suitable for a specific use case
   */
  async isSuitableForUseCase(
    particleCount: number,
    forceTypes: string[] = [],
    memoryRequirementMB: number = 0
  ): Promise<boolean> {
    const result = await this.detect();
    
    if (!result.available || !result.capabilities) {
      return false;
    }

    const caps = result.capabilities;

    // Check if we can handle the required number of particles
    const particleDataSize = particleCount * 64; // Estimate 64 bytes per particle
    if (particleDataSize > caps.maxBufferSize) {
      return false;
    }

    // Check memory requirements
    if (memoryRequirementMB > 0 && caps.deviceMemoryMB && 
        memoryRequirementMB > caps.deviceMemoryMB * 0.8) { // Leave 20% headroom
      return false;
    }

    // Check for compute-intensive forces that benefit from GPU
    const computeIntensiveForces = ['fluid', 'collisions', 'behavior'];
    const hasComputeIntensiveForces = forceTypes.some(force => 
      computeIntensiveForces.includes(force.toLowerCase())
    );

    // If we have compute-intensive forces and good GPU, recommend WebGPU
    if (hasComputeIntensiveForces && result.performanceScore > 60) {
      return true;
    }

    // For large particle counts, WebGPU is generally better
    return particleCount >= 1000 && result.performanceScore > 40;
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Perform the actual WebGPU detection
   */
  private async performDetection(): Promise<WebGPUDetectionResult> {
    // Basic browser support check
    if (!navigator.gpu) {
      return {
        available: false,
        unavailableReason: 'WebGPU not supported by browser',
        recommendedBackend: 'cpu',
        performanceScore: 0
      };
    }

    try {
      // Try to get an adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        return {
          available: false,
          unavailableReason: 'No WebGPU adapter available',
          recommendedBackend: 'cpu',
          performanceScore: 0
        };
      }

      // Try to get a device
      const device = await adapter.requestDevice();
      
      if (!device) {
        return {
          available: false,
          unavailableReason: 'Failed to create WebGPU device',
          recommendedBackend: 'cpu',
          performanceScore: 0
        };
      }

      // Get adapter info and device capabilities
      const adapterInfo = await adapter.requestAdapterInfo();
      const capabilities = this.extractCapabilities(device, adapterInfo);
      const performanceScore = this.calculatePerformanceScore(capabilities, adapterInfo);
      
      // Clean up test device
      device.destroy();

      return {
        available: true,
        capabilities,
        recommendedBackend: performanceScore > 50 ? 'webgpu' : 'cpu',
        performanceScore
      };

    } catch (error) {
      return {
        available: false,
        unavailableReason: `WebGPU initialization failed: ${error}`,
        recommendedBackend: 'cpu',
        performanceScore: 0
      };
    }
  }

  /**
   * Extract capabilities from device and adapter info
   */
  private extractCapabilities(device: GPUDevice, adapterInfo: GPUAdapterInfo): WebGPUCapabilities {
    const limits = device.limits;
    const features = Array.from(device.features);

    return {
      maxBufferSize: limits.maxBufferSize,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      maxComputeWorkgroupSize: limits.maxComputeWorkgroupSizeX,
      vendor: adapterInfo.vendor || 'unknown',
      architecture: adapterInfo.architecture || 'unknown',
      supportedFeatures: features
    };
  }

  /**
   * Calculate performance score based on device capabilities
   */
  private calculatePerformanceScore(capabilities: WebGPUCapabilities, adapterInfo: GPUAdapterInfo): number {
    let score = 50; // Base score

    // Vendor-based scoring
    const vendor = capabilities.vendor?.toLowerCase() || '';
    if (vendor.includes('nvidia')) {
      score += 25;
    } else if (vendor.includes('amd')) {
      score += 20;
    } else if (vendor.includes('intel')) {
      if (vendor.includes('arc')) {
        score += 20; // Intel Arc GPUs
      } else {
        score += 10; // Integrated Intel graphics
      }
    }

    // Buffer size scoring (larger buffers = better performance for large datasets)
    const bufferSizeMB = capabilities.maxBufferSize / (1024 * 1024);
    if (bufferSizeMB > 256) {
      score += 15;
    } else if (bufferSizeMB > 128) {
      score += 10;
    } else if (bufferSizeMB > 64) {
      score += 5;
    }

    // Workgroup size scoring
    if (capabilities.maxComputeWorkgroupSize > 1024) {
      score += 10;
    } else if (capabilities.maxComputeWorkgroupSize > 512) {
      score += 5;
    }

    // Architecture bonus
    const architecture = adapterInfo.architecture?.toLowerCase() || '';
    if (architecture.includes('discrete')) {
      score += 15;
    } else if (architecture.includes('integrated')) {
      score += 5;
    }

    // Feature support bonus
    const importantFeatures = ['timestamp-query', 'texture-compression-bc', 'texture-compression-etc2'];
    const supportedImportantFeatures = capabilities.supportedFeatures.filter(feature => 
      importantFeatures.includes(feature)
    );
    score += supportedImportantFeatures.length * 2;

    // Clamp score to 0-100 range
    return Math.max(0, Math.min(100, score));
  }
}