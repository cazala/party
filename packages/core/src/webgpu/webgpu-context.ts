/**
 * WebGPU Context - Core WebGPU device initialization and resource management
 * 
 * This class handles:
 * - WebGPU device initialization with proper error handling
 * - GPU resource lifecycle management
 * - Compute pipeline creation and management
 * - Buffer allocation and cleanup
 * - Performance monitoring
 */

export interface WebGPUCapabilities {
  /** Whether WebGPU is supported in this browser */
  supported: boolean;
  /** Maximum buffer size supported by the device */
  maxBufferSize: number;
  /** Maximum number of compute workgroups in each dimension */
  maxComputeWorkgroupsPerDimension: number;
  /** Maximum compute workgroup size */
  maxComputeWorkgroupSize: number;
  /** Available memory on the device (if supported) */
  deviceMemory?: number;
  /** Device vendor information */
  vendor?: string;
}

export interface WebGPUContextOptions {
  /** Enable debug mode for development */
  debug?: boolean;
  /** Preferred power preference */
  powerPreference?: GPUPowerPreference;
  /** Required features */
  requiredFeatures?: GPUFeatureName[];
  /** Required limits */
  requiredLimits?: Record<string, number>;
}

/**
 * WebGPUContext manages the WebGPU device lifecycle and provides
 * high-level APIs for compute pipeline management and resource allocation.
 */
export class WebGPUContext {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private isInitialized: boolean = false;
  private capabilities: WebGPUCapabilities | null = null;
  
  /** Map of compute pipelines for reuse */
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  
  /** Map of shader modules for reuse */
  private shaderModules: Map<string, GPUShaderModule> = new Map();
  
  /** Active GPU buffers for cleanup tracking */
  private activeBuffers: Set<GPUBuffer> = new Set();
  
  /** Configuration options */
  private options: WebGPUContextOptions;

  constructor(options: WebGPUContextOptions = {}) {
    this.options = {
      debug: false,
      powerPreference: 'high-performance',
      requiredFeatures: [],
      requiredLimits: {},
      ...options
    };
  }

  /**
   * Initialize the WebGPU context
   * @returns Promise that resolves to true if initialization succeeded
   */
  async initialize(): Promise<boolean> {
    try {
      // Check for WebGPU support
      if (!navigator.gpu) {
        console.warn('WebGPU not supported in this browser');
        return false;
      }

      // Request adapter
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.options.powerPreference
      });

      if (!this.adapter) {
        console.warn('Failed to get WebGPU adapter');
        return false;
      }

      // Request device with required features and limits
      this.device = await this.adapter.requestDevice({
        requiredFeatures: this.options.requiredFeatures,
        requiredLimits: this.options.requiredLimits
      });

      if (!this.device) {
        console.warn('Failed to get WebGPU device');
        return false;
      }

      // Set up error handling
      this.device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU uncaptured error:', event.error);
      });

      // Detect device capabilities
      this.capabilities = await this.detectCapabilities();
      
      this.isInitialized = true;

      if (this.options.debug) {
        console.log('WebGPU initialized successfully');
        console.log('Device capabilities:', this.capabilities);
      }

      return true;

    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  /**
   * Check if WebGPU is available and initialized
   */
  isAvailable(): boolean {
    return this.isInitialized && this.device !== null;
  }

  /**
   * Get device capabilities
   */
  getCapabilities(): WebGPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get the WebGPU device (throws if not initialized)
   */
  getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error('WebGPU device not initialized. Call initialize() first.');
    }
    return this.device;
  }

  /**
   * Get the WebGPU adapter (throws if not initialized)
   */
  getAdapter(): GPUAdapter {
    if (!this.adapter) {
      throw new Error('WebGPU adapter not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  /**
   * Create or get cached shader module
   */
  createShaderModule(code: string, label?: string): GPUShaderModule {
    const device = this.getDevice();
    
    // Use code hash as cache key
    const cacheKey = this.hashString(code);
    
    if (this.shaderModules.has(cacheKey)) {
      return this.shaderModules.get(cacheKey)!;
    }

    const shaderModule = device.createShaderModule({
      label,
      code
    });

    this.shaderModules.set(cacheKey, shaderModule);
    return shaderModule;
  }

  /**
   * Create or get cached compute pipeline
   */
  createComputePipeline(
    shaderCode: string, 
    entryPoint: string = 'main',
    label?: string
  ): GPUComputePipeline {
    const device = this.getDevice();
    
    // Create cache key from shader code and entry point
    const cacheKey = `${this.hashString(shaderCode)}-${entryPoint}`;
    
    if (this.computePipelines.has(cacheKey)) {
      return this.computePipelines.get(cacheKey)!;
    }

    const shaderModule = this.createShaderModule(shaderCode, label);
    
    const pipeline = device.createComputePipeline({
      label,
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint
      }
    });

    this.computePipelines.set(cacheKey, pipeline);
    return pipeline;
  }

  /**
   * Create a GPU buffer and track it for cleanup
   */
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
    const device = this.getDevice();
    const buffer = device.createBuffer(descriptor);
    this.activeBuffers.add(buffer);
    return buffer;
  }

  /**
   * Destroy a GPU buffer and remove from tracking
   */
  destroyBuffer(buffer: GPUBuffer): void {
    buffer.destroy();
    this.activeBuffers.delete(buffer);
  }

  /**
   * Create a command encoder
   */
  createCommandEncoder(label?: string): GPUCommandEncoder {
    const device = this.getDevice();
    return device.createCommandEncoder({ label });
  }

  /**
   * Submit commands to the GPU queue
   */
  submit(commandBuffers: GPUCommandBuffer[]): void {
    const device = this.getDevice();
    device.queue.submit(commandBuffers);
  }

  /**
   * Write data to a buffer
   */
  writeBuffer(buffer: GPUBuffer, data: BufferSource, bufferOffset?: number): void {
    const device = this.getDevice();
    device.queue.writeBuffer(buffer, bufferOffset ?? 0, data);
  }

  /**
   * Read data from a buffer (async operation)
   */
  async readBuffer(buffer: GPUBuffer): Promise<ArrayBuffer> {
    const device = this.getDevice();
    
    // Create a staging buffer for reading
    const stagingBuffer = this.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      label: 'staging-buffer'
    });

    // Copy from source to staging buffer
    const encoder = this.createCommandEncoder('read-buffer-encoder');
    encoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, buffer.size);
    this.submit([encoder.finish()]);

    // Wait for GPU operations to complete
    await device.queue.onSubmittedWorkDone();

    // Map and read the staging buffer
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const result = stagingBuffer.getMappedRange().slice(0);
    stagingBuffer.unmap();

    // Clean up staging buffer
    this.destroyBuffer(stagingBuffer);

    return result;
  }

  /**
   * Clean up all resources and destroy the context
   */
  destroy(): void {
    // Destroy all tracked buffers
    for (const buffer of this.activeBuffers) {
      buffer.destroy();
    }
    this.activeBuffers.clear();

    // Clear caches
    this.computePipelines.clear();
    this.shaderModules.clear();

    // Destroy device
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.adapter = null;
    this.isInitialized = false;
    this.capabilities = null;

    if (this.options.debug) {
      console.log('WebGPU context destroyed');
    }
  }

  /**
   * Detect device capabilities
   */
  private async detectCapabilities(): Promise<WebGPUCapabilities> {
    if (!this.adapter || !this.device) {
      return { supported: false, maxBufferSize: 0, maxComputeWorkgroupsPerDimension: 0, maxComputeWorkgroupSize: 0 };
    }

    const limits = this.device.limits;
    const adapterInfo = await this.adapter.requestAdapterInfo();

    return {
      supported: true,
      maxBufferSize: limits.maxBufferSize,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      maxComputeWorkgroupSize: limits.maxComputeWorkgroupSizeX,
      vendor: adapterInfo.vendor || 'unknown'
    };
  }

  /**
   * Simple string hashing for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}