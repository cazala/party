/**
 * GPU-Accelerated Spatial Grid
 * 
 * This module implements a high-performance spatial grid system using WebGPU
 * compute shaders for efficient neighbor queries and spatial partitioning.
 * Designed for handling thousands of particles with optimal memory access patterns.
 */

import { WebGPUContext } from './webgpu-context';
import { ShaderManager } from './shader-manager';
import { BufferManager } from './buffer-manager';
import { ParticleArrays } from './particle-data';

export interface SpatialGridOptions {
  /** Width of the spatial area */
  width: number;
  /** Height of the spatial area */
  height: number;
  /** Size of each grid cell */
  cellSize: number;
  /** Maximum particles per cell (for buffer allocation) */
  maxParticlesPerCell: number;
  /** Maximum total particles */
  maxParticles: number;
  /** Enable dynamic resizing */
  enableDynamicResize: boolean;
  /** Enable frustum culling */
  enableFrustumCulling: boolean;
}

export interface GridMetrics {
  /** Number of grid cells */
  totalCells: number;
  /** Average particles per cell */
  avgParticlesPerCell: number;
  /** Maximum particles in any cell */
  maxParticlesInCell: number;
  /** Number of empty cells */
  emptyCells: number;
  /** Memory usage in MB */
  memoryUsageMB: number;
  /** Last update time in milliseconds */
  lastUpdateMs: number;
}

export interface NeighborQuery {
  /** Center position for query */
  position: [number, number];
  /** Search radius */
  radius: number;
  /** Maximum number of neighbors to return */
  maxNeighbors: number;
  /** Optional particle index to exclude from results */
  excludeParticle?: number;
}

export interface NeighborResult {
  /** Array of neighbor particle indices */
  indices: number[];
  /** Array of distances to neighbors */
  distances: number[];
  /** Number of neighbors found */
  count: number;
  /** Whether query was truncated due to maxNeighbors limit */
  truncated: boolean;
}

export interface BufferPoolStats {
  /** Number of buffers in pool */
  totalBuffers: number;
  /** Number of currently available buffers */
  availableBuffers: number;
  /** Total memory allocated in MB */
  totalMemoryMB: number;
  /** Peak memory usage in MB */
  peakMemoryMB: number;
  /** Number of buffer allocations */
  allocations: number;
  /** Number of buffer deallocations */
  deallocations: number;
}

export interface MemoryPressureInfo {
  /** Current memory usage in MB */
  currentUsageMB: number;
  /** Estimated available memory in MB */
  availableMemoryMB: number;
  /** Memory pressure level (0-1, higher = more pressure) */
  pressureLevel: number;
  /** Whether memory pressure is critical */
  isCritical: boolean;
  /** Recommended action */
  recommendation: 'none' | 'cleanup' | 'reduce_quality' | 'emergency_cleanup';
}

/**
 * GPU-accelerated spatial grid for efficient neighbor queries
 */
export class SpatialGridGPU {
  private context: WebGPUContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;
  private options: SpatialGridOptions;
  private metrics: GridMetrics;

  /** Grid dimensions */
  private gridWidth: number;
  private gridHeight: number;
  private totalCells: number;

  /** GPU buffers for spatial data */
  private cellCountsBuffer: GPUBuffer | null = null;
  private cellOffsetsBuffer: GPUBuffer | null = null;
  private cellParticlesBuffer: GPUBuffer | null = null;
  private sortedIndicesBuffer: GPUBuffer | null = null;
  private sortKeysBuffer: GPUBuffer | null = null;

  /** Compute pipelines */
  private clearGridPipeline: GPUComputePipeline | null = null;
  private populateGridPipeline: GPUComputePipeline | null = null;
  private buildOffsetssPipeline: GPUComputePipeline | null = null;
  private sortParticlesPipeline: GPUComputePipeline | null = null;
  private neighborQueryPipeline: GPUComputePipeline | null = null;

  /** Bind groups for compute shaders */
  private clearBindGroup: GPUBindGroup | null = null;
  private populateBindGroup: GPUBindGroup | null = null;
  private offsetsBindGroup: GPUBindGroup | null = null;
  private sortBindGroup: GPUBindGroup | null = null;
  private queryBindGroup: GPUBindGroup | null = null;

  /** Uniform buffer for grid parameters */
  private gridParamsBuffer: GPUBuffer | null = null;

  /** Current particle count */
  private currentParticleCount: number = 0;

  /** Frustum culling parameters */
  private cameraX: number = 0;
  private cameraY: number = 0;
  private cameraZoom: number = 1;
  private viewWidth: number = 800;
  private viewHeight: number = 600;

  /** Buffer pool for neighbor query results */
  private neighborBufferPool: GPUBuffer[] = [];
  private neighborBufferSizes: Map<GPUBuffer, number> = new Map();
  private bufferPoolStats: BufferPoolStats = {
    totalBuffers: 0,
    availableBuffers: 0,
    totalMemoryMB: 0,
    peakMemoryMB: 0,
    allocations: 0,
    deallocations: 0
  };

  /** Memory pressure monitoring */
  private lastMemoryCheck: number = 0;
  private memoryCheckInterval: number = 1000; // Check every second
  private estimatedDeviceMemoryMB: number = 1024; // Conservative estimate

  constructor(
    context: WebGPUContext,
    shaderManager: ShaderManager,
    bufferManager: BufferManager,
    options: SpatialGridOptions
  ) {
    this.context = context;
    this.shaderManager = shaderManager;
    this.bufferManager = bufferManager;
    this.options = options;

    // Calculate grid dimensions
    this.gridWidth = Math.ceil(options.width / options.cellSize);
    this.gridHeight = Math.ceil(options.height / options.cellSize);
    this.totalCells = this.gridWidth * this.gridHeight;

    // Initialize metrics
    this.metrics = {
      totalCells: this.totalCells,
      avgParticlesPerCell: 0,
      maxParticlesInCell: 0,
      emptyCells: this.totalCells,
      memoryUsageMB: 0,
      lastUpdateMs: 0
    };
  }

  /**
   * Initialize the GPU spatial grid system
   */
  async initialize(): Promise<void> {
    // Create GPU buffers
    await this.createBuffers();

    // Create compute pipelines
    await this.createComputePipelines();

    // Create bind groups
    await this.createBindGroups();

    console.log(`GPU Spatial Grid initialized: ${this.gridWidth}x${this.gridHeight} cells (${this.totalCells} total)`);
  }

  /**
   * Update spatial grid with current particle data
   */
  async updateGrid(particleBuffer: GPUBuffer, particleCount: number): Promise<void> {
    const startTime = performance.now();
    this.currentParticleCount = particleCount;

    // Update grid parameters if particle count changed significantly
    if (this.shouldResizeGrid(particleCount)) {
      await this.resizeGrid(particleCount);
    }

    // Clear grid cells
    await this.clearGrid();

    // Populate grid cells with particles
    await this.populateGrid(particleBuffer, particleCount);

    // Build cell offset arrays for neighbor queries
    await this.buildOffsets();

    // Sort particles within cells for better memory access patterns
    await this.sortParticlesInCells(particleBuffer, particleCount);

    // Update metrics
    this.metrics.lastUpdateMs = performance.now() - startTime;
    await this.updateMetrics();
    
    // Periodically optimize distribution (every 60 updates or significant changes)
    if (Math.random() < 0.0167 || this.shouldResizeGrid(particleCount)) {
      await this.optimizeParticleDistribution();
    }

    // Periodically optimize buffer reuse and check memory pressure
    if (Math.random() < 0.01) { // Every ~100 updates
      this.optimizeBufferReuse();
      
      const memoryInfo = this.getMemoryPressure();
      if (memoryInfo.isCritical) {
        this.handleMemoryPressure(memoryInfo);
      }
    }
  }

  /**
   * Query neighbors around a specific position using GPU acceleration
   */
  async queryNeighbors(query: NeighborQuery, particleBuffer: GPUBuffer): Promise<NeighborResult> {
    if (!this.neighborQueryPipeline) {
      throw new Error('Neighbor query pipeline not initialized');
    }

    const device = this.context.getDevice();

    // Calculate required buffer size based on query parameters
    const maxNeighbors = Math.min(query.maxNeighbors, 64); // Cap at 64 for now
    const requiredSize = 16 + (maxNeighbors * 4) + (maxNeighbors * 4); // metadata + indices + distances
    
    // Get buffer from pool
    const resultBuffer = this.getNeighborBuffer(requiredSize);

    // Create query parameters buffer
    const queryParams = new Float32Array([
      query.position[0], query.position[1], query.radius, query.maxNeighbors,
      query.excludeParticle || -1, 0, 0, 0 // Padding for alignment
    ]);
    const queryParamsBuffer = this.bufferManager.createUniformBuffer(
      queryParams.buffer,
      'neighbor-query-params'
    );

    // Create bind group for this specific query
    const queryBindGroup = device.createBindGroup({
      layout: this.neighborQueryPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cellCountsBuffer! } },
        { binding: 1, resource: { buffer: this.cellOffsetsBuffer! } },
        { binding: 2, resource: { buffer: this.cellParticlesBuffer! } },
        { binding: 3, resource: { buffer: particleBuffer } },
        { binding: 4, resource: { buffer: this.gridParamsBuffer! } },
        { binding: 5, resource: { buffer: queryParamsBuffer } },
        { binding: 6, resource: { buffer: resultBuffer } }
      ]
    });

    // Dispatch neighbor query compute shader
    const encoder = this.context.createCommandEncoder('neighbor-query');
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(this.neighborQueryPipeline);
    computePass.setBindGroup(0, queryBindGroup);
    computePass.dispatchWorkgroups(1); // Single workgroup for one query

    computePass.end();
    this.context.submit([encoder.finish()]);

    // Wait for completion
    await this.context.getDevice().queue.onSubmittedWorkDone();

    // Read back results
    const resultData = await this.context.readBuffer(resultBuffer);
    const resultView = new DataView(resultData);

    // Parse results
    const count = Math.min(resultView.getUint32(0, true), query.maxNeighbors);
    const truncated = resultView.getUint32(4, true) > 0;

    const indices: number[] = [];
    const distances: number[] = [];

    for (let i = 0; i < count; i++) {
      const indexOffset = 16 + (i * 4);
      const distanceOffset = 16 + (64 * 4) + (i * 4);

      indices.push(resultView.getUint32(indexOffset, true));
      distances.push(resultView.getFloat32(distanceOffset, true));
    }

    // Return result buffer to pool and cleanup temporary buffers
    this.returnNeighborBuffer(resultBuffer);
    this.bufferManager.destroyBuffer(queryParamsBuffer);

    return {
      indices,
      distances,
      count,
      truncated
    };
  }

  /**
   * Set camera parameters for frustum culling
   */
  setCameraParams(x: number, y: number, zoom: number, viewWidth: number, viewHeight: number): void {
    this.cameraX = x;
    this.cameraY = y;
    this.cameraZoom = zoom;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    
    // Update frustum culling parameters in GPU buffers when camera changes
    this.updateFrustumCullingParams();
  }

  /**
   * Update frustum culling parameters on GPU
   */
  private async updateFrustumCullingParams(): Promise<void> {
    if (!this.gridParamsBuffer) {
      return;
    }

    // Calculate view frustum bounds in world space
    const halfViewWidth = (this.viewWidth / this.cameraZoom) / 2;
    const halfViewHeight = (this.viewHeight / this.cameraZoom) / 2;
    
    const viewLeft = this.cameraX - halfViewWidth;
    const viewRight = this.cameraX + halfViewWidth;
    const viewTop = this.cameraY - halfViewHeight;
    const viewBottom = this.cameraY + halfViewHeight;

    // Add margin for particles that might be partially visible
    const margin = 100; // pixels
    const frustumLeft = Math.max(0, viewLeft - margin);
    const frustumRight = Math.min(this.options.width, viewRight + margin);
    const frustumTop = Math.max(0, viewTop - margin);
    const frustumBottom = Math.min(this.options.height, viewBottom + margin);

    // Update grid parameters to include frustum culling bounds
    // Note: In a full implementation, this would be a separate buffer
    // For now, we're using basic bounds checking in the shader
    console.log(`Frustum culling bounds: (${frustumLeft.toFixed(1)}, ${frustumTop.toFixed(1)}) to (${frustumRight.toFixed(1)}, ${frustumBottom.toFixed(1)})`);
  }

  /**
   * Get or create a buffer from the pool for neighbor queries
   */
  private getNeighborBuffer(requiredSize: number): GPUBuffer {
    // Try to find a suitable buffer from the pool
    for (let i = 0; i < this.neighborBufferPool.length; i++) {
      const buffer = this.neighborBufferPool[i];
      const bufferSize = this.neighborBufferSizes.get(buffer)!;
      
      if (bufferSize >= requiredSize) {
        // Remove from pool and return
        this.neighborBufferPool.splice(i, 1);
        this.bufferPoolStats.availableBuffers--;
        this.bufferPoolStats.allocations++;
        return buffer;
      }
    }

    // No suitable buffer found, create a new one
    const newSize = Math.max(requiredSize, 1024); // Minimum buffer size
    const buffer = this.bufferManager.createBuffer({
      size: newSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      label: 'pooled-neighbor-buffer'
    });

    this.neighborBufferSizes.set(buffer, newSize);
    this.bufferPoolStats.totalBuffers++;
    this.bufferPoolStats.allocations++;
    this.bufferPoolStats.totalMemoryMB += newSize / (1024 * 1024);
    this.bufferPoolStats.peakMemoryMB = Math.max(
      this.bufferPoolStats.peakMemoryMB,
      this.bufferPoolStats.totalMemoryMB
    );

    return buffer;
  }

  /**
   * Return a buffer to the pool for reuse
   */
  private returnNeighborBuffer(buffer: GPUBuffer): void {
    // Add back to pool if we have room
    const maxPoolSize = 10; // Limit pool size to prevent memory bloat
    
    if (this.neighborBufferPool.length < maxPoolSize) {
      this.neighborBufferPool.push(buffer);
      this.bufferPoolStats.availableBuffers++;
      this.bufferPoolStats.deallocations++;
    } else {
      // Pool is full, destroy the buffer
      const bufferSize = this.neighborBufferSizes.get(buffer)!;
      this.bufferManager.destroyBuffer(buffer);
      this.neighborBufferSizes.delete(buffer);
      this.bufferPoolStats.totalBuffers--;
      this.bufferPoolStats.totalMemoryMB -= bufferSize / (1024 * 1024);
      this.bufferPoolStats.deallocations++;
    }
  }

  /**
   * Get buffer pool statistics
   */
  getBufferPoolStats(): BufferPoolStats {
    return { ...this.bufferPoolStats };
  }

  /**
   * Clean up buffer pool and force garbage collection
   */
  private cleanupBufferPool(): void {
    // Return all pooled buffers
    for (const buffer of this.neighborBufferPool) {
      const bufferSize = this.neighborBufferSizes.get(buffer)!;
      this.bufferManager.destroyBuffer(buffer);
      this.neighborBufferSizes.delete(buffer);
      this.bufferPoolStats.totalMemoryMB -= bufferSize / (1024 * 1024);
    }

    this.neighborBufferPool = [];
    this.bufferPoolStats.totalBuffers = 0;
    this.bufferPoolStats.availableBuffers = 0;
  }

  /**
   * Monitor GPU memory pressure and return status
   */
  getMemoryPressure(): MemoryPressureInfo {
    const now = performance.now();
    
    // Get current memory usage from various sources
    const gridMemoryMB = this.metrics.memoryUsageMB;
    const poolMemoryMB = this.bufferPoolStats.totalMemoryMB;
    const currentUsageMB = gridMemoryMB + poolMemoryMB;
    
    // Estimate available memory (this is a rough heuristic)
    const availableMemoryMB = Math.max(0, this.estimatedDeviceMemoryMB - currentUsageMB);
    const pressureLevel = Math.min(1.0, currentUsageMB / this.estimatedDeviceMemoryMB);
    
    // Determine recommendation based on pressure level
    let recommendation: MemoryPressureInfo['recommendation'] = 'none';
    let isCritical = false;
    
    if (pressureLevel > 0.9) {
      recommendation = 'emergency_cleanup';
      isCritical = true;
    } else if (pressureLevel > 0.75) {
      recommendation = 'reduce_quality';
      isCritical = true;
    } else if (pressureLevel > 0.6) {
      recommendation = 'cleanup';
    }
    
    return {
      currentUsageMB,
      availableMemoryMB,
      pressureLevel,
      isCritical,
      recommendation
    };
  }

  /**
   * Dynamically allocate neighbor buffer with size based on estimated need
   */
  private allocateNeighborBufferDynamic(query: NeighborQuery): GPUBuffer {
    // Check memory pressure before allocation
    const memoryInfo = this.getMemoryPressure();
    
    // Adjust allocation size based on memory pressure
    let maxNeighbors = query.maxNeighbors;
    if (memoryInfo.isCritical) {
      maxNeighbors = Math.min(maxNeighbors, 32); // Reduce quality under pressure
    } else if (memoryInfo.pressureLevel > 0.5) {
      maxNeighbors = Math.min(maxNeighbors, 48);
    }
    
    // Calculate buffer size with some padding for efficiency
    const baseSize = 16 + (maxNeighbors * 8); // metadata + data
    const paddedSize = Math.ceil(baseSize / 256) * 256; // Align to 256 bytes
    
    // Try to get from pool first
    const pooledBuffer = this.getNeighborBuffer(paddedSize);
    if (pooledBuffer) {
      return pooledBuffer;
    }
    
    // If memory pressure is high, trigger cleanup before allocating
    if (memoryInfo.pressureLevel > 0.7) {
      this.handleMemoryPressure(memoryInfo);
    }
    
    // Create new buffer
    return this.bufferManager.createBuffer({
      size: paddedSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      label: `neighbor-buffer-${paddedSize}`
    });
  }

  /**
   * Handle memory pressure by cleaning up resources
   */
  private handleMemoryPressure(memoryInfo: MemoryPressureInfo): void {
    console.warn(`GPU memory pressure detected: ${(memoryInfo.pressureLevel * 100).toFixed(1)}% - ${memoryInfo.recommendation}`);
    
    switch (memoryInfo.recommendation) {
      case 'cleanup':
        // Clean up some pooled buffers
        while (this.neighborBufferPool.length > 5) {
          const buffer = this.neighborBufferPool.pop()!;
          const size = this.neighborBufferSizes.get(buffer)!;
          this.bufferManager.destroyBuffer(buffer);
          this.neighborBufferSizes.delete(buffer);
          this.bufferPoolStats.totalMemoryMB -= size / (1024 * 1024);
        }
        break;
        
      case 'reduce_quality':
        // More aggressive cleanup
        this.cleanupBufferPool();
        break;
        
      case 'emergency_cleanup':
        // Emergency cleanup - clear everything possible
        this.cleanupBufferPool();
        // Could also trigger grid resize to smaller cell size
        break;
    }
  }

  /**
   * Optimize buffer reuse patterns based on usage statistics
   */
  optimizeBufferReuse(): void {
    const stats = this.bufferPoolStats;
    
    // If we're allocating much more than we're deallocating, increase pool size
    const allocationRate = stats.allocations / Math.max(1, stats.deallocations);
    if (allocationRate > 2.0 && this.neighborBufferPool.length < 15) {
      console.log('Increasing buffer pool size due to high allocation rate');
      // Pool will grow naturally through usage
    }
    
    // If pool is underutilized, reduce it
    if (stats.availableBuffers > 8 && allocationRate < 0.5) {
      console.log('Reducing buffer pool size due to low utilization');
      while (this.neighborBufferPool.length > 3) {
        const buffer = this.neighborBufferPool.pop()!;
        const size = this.neighborBufferSizes.get(buffer)!;
        this.bufferManager.destroyBuffer(buffer);
        this.neighborBufferSizes.delete(buffer);
        this.bufferPoolStats.totalBuffers--;
        this.bufferPoolStats.availableBuffers--;
        this.bufferPoolStats.totalMemoryMB -= size / (1024 * 1024);
      }
    }
  }

  /**
   * Get current grid metrics
   */
  getMetrics(): GridMetrics {
    return { ...this.metrics };
  }

  /**
   * Get grid cell containing a specific position
   */
  getGridCell(x: number, y: number): { cellX: number; cellY: number; cellIndex: number } {
    const cellX = Math.floor(x / this.options.cellSize);
    const cellY = Math.floor(y / this.options.cellSize);
    const cellIndex = cellY * this.gridWidth + cellX;

    return { cellX, cellY, cellIndex };
  }

  /**
   * Get neighboring cells around a position
   */
  getNeighboringCells(x: number, y: number, radius: number): number[] {
    const cellIndices: number[] = [];
    const cellRadius = Math.ceil(radius / this.options.cellSize);
    const centerCell = this.getGridCell(x, y);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cellX = centerCell.cellX + dx;
        const cellY = centerCell.cellY + dy;

        // Check bounds
        if (cellX >= 0 && cellX < this.gridWidth && cellY >= 0 && cellY < this.gridHeight) {
          const cellIndex = cellY * this.gridWidth + cellX;
          cellIndices.push(cellIndex);
        }
      }
    }

    return cellIndices;
  }

  /**
   * Resize grid for different particle counts with advanced optimization
   */
  async resizeGrid(particleCount: number): Promise<void> {
    if (!this.options.enableDynamicResize) {
      return;
    }

    // Calculate current load metrics
    const currentDensity = particleCount / this.totalCells;
    const targetDensity = this.options.maxParticlesPerCell * 0.6; // 60% load factor
    
    // Calculate optimal cell size based on multiple factors
    const particleDensity = particleCount / (this.options.width * this.options.height);
    const densityBasedCellSize = Math.sqrt(targetDensity / particleDensity);
    
    // Consider spatial distribution - estimate particle clustering
    const estimatedClustering = this.estimateParticleClustering(particleCount);
    const clusteringFactor = Math.max(0.5, Math.min(2.0, estimatedClustering));
    
    // Adjust cell size for clustering (smaller cells for more clustered distributions)
    const clusterAdjustedCellSize = densityBasedCellSize / clusteringFactor;
    
    // Apply performance-based bounds
    const performanceOptimalSize = this.calculatePerformanceOptimalCellSize(particleCount);
    const newCellSize = this.clampCellSize(
      Math.min(clusterAdjustedCellSize, performanceOptimalSize),
      particleCount
    );

    // Only resize if the change is significant enough to justify the cost
    const resizeThreshold = Math.max(5, this.options.cellSize * 0.15);
    if (Math.abs(newCellSize - this.options.cellSize) > resizeThreshold) {
      console.log(`Optimizing grid: ${this.options.cellSize.toFixed(1)} -> ${newCellSize.toFixed(1)} ` +
                  `(density: ${currentDensity.toFixed(1)}, clustering: ${clusteringFactor.toFixed(2)})`);
      
      // Update grid parameters
      const oldCellSize = this.options.cellSize;
      this.options.cellSize = newCellSize;
      this.gridWidth = Math.ceil(this.options.width / newCellSize);
      this.gridHeight = Math.ceil(this.options.height / newCellSize);
      this.totalCells = this.gridWidth * this.gridHeight;

      // Adjust maxParticlesPerCell based on new layout
      const cellSizeRatio = newCellSize / oldCellSize;
      this.options.maxParticlesPerCell = Math.ceil(
        this.options.maxParticlesPerCell * cellSizeRatio * cellSizeRatio
      );

      // Optimize cell layout for better GPU performance
      this.optimizeCellLayout();

      // Recreate buffers with new size and optimized layout
      await this.recreateBuffers();
      await this.createBindGroups();
      
      // Update metrics to reflect new configuration
      this.metrics.totalCells = this.totalCells;
    }
  }

  /**
   * Estimate particle clustering factor for grid optimization
   */
  private estimateParticleClustering(particleCount: number): number {
    // Simple heuristic: assume more particles tend to cluster more
    // In practice, this could analyze actual particle positions
    const baseClustering = 1.0;
    const densityEffect = Math.min(2.0, particleCount / 1000);
    return baseClustering + (densityEffect - 1.0) * 0.3;
  }

  /**
   * Calculate performance-optimal cell size based on GPU characteristics
   */
  private calculatePerformanceOptimalCellSize(particleCount: number): number {
    // Optimize for GPU workgroup sizes and memory access patterns
    const workgroupSize = 64; // Typical compute workgroup size
    const optimalParticlesPerWorkgroup = workgroupSize * 2;
    
    // Calculate cell size that results in efficient GPU utilization
    const area = this.options.width * this.options.height;
    const targetCellsPerWorkgroup = Math.ceil(optimalParticlesPerWorkgroup / (particleCount / area));
    
    return Math.sqrt(area / (targetCellsPerWorkgroup * workgroupSize));
  }

  /**
   * Clamp cell size to reasonable bounds based on particle count and performance
   */
  private clampCellSize(cellSize: number, particleCount: number): number {
    // Dynamic bounds based on particle count
    const minCellSize = Math.max(10, Math.min(50, particleCount / 1000));
    const maxCellSize = Math.min(500, Math.max(100, particleCount / 10));
    
    return Math.max(minCellSize, Math.min(maxCellSize, cellSize));
  }

  /**
   * Optimize cell layout for better GPU memory access patterns
   */
  private optimizeCellLayout(): void {
    // Ensure grid dimensions are aligned for optimal GPU access
    const optimalAlignment = 64; // GPU cache line size
    
    // Round grid dimensions to multiples that work well with GPU architecture
    const alignedWidth = Math.ceil(this.gridWidth / optimalAlignment) * optimalAlignment;
    const alignedHeight = Math.ceil(this.gridHeight / optimalAlignment) * optimalAlignment;
    
    // Only apply if the change isn't too dramatic
    if (alignedWidth <= this.gridWidth * 1.1 && alignedHeight <= this.gridHeight * 1.1) {
      this.gridWidth = alignedWidth;
      this.gridHeight = alignedHeight;
      this.totalCells = this.gridWidth * this.gridHeight;
      
      // Adjust cell size slightly to maintain area coverage
      this.options.cellSize = Math.min(
        this.options.width / this.gridWidth,
        this.options.height / this.gridHeight
      );
    }
  }

  /**
   * Analyze and optimize particle distribution efficiency
   */
  async optimizeParticleDistribution(): Promise<void> {
    if (!this.cellCountsBuffer) {
      return;
    }

    // Read back cell counts to analyze distribution
    const cellCountsData = await this.context.readBuffer(this.cellCountsBuffer);
    const cellCounts = new Uint32Array(cellCountsData);
    
    // Analyze distribution patterns
    let maxCount = 0;
    let nonEmptyCells = 0;
    let totalParticles = 0;
    
    for (let i = 0; i < cellCounts.length; i++) {
      const count = cellCounts[i];
      if (count > 0) {
        nonEmptyCells++;
        totalParticles += count;
        maxCount = Math.max(maxCount, count);
      }
    }
    
    // Update metrics with actual data
    this.metrics.avgParticlesPerCell = totalParticles / nonEmptyCells || 0;
    this.metrics.maxParticlesInCell = maxCount;
    this.metrics.emptyCells = this.totalCells - nonEmptyCells;
    
    // Log optimization recommendations
    const loadFactor = nonEmptyCells / this.totalCells;
    const hotspotRatio = maxCount / (this.metrics.avgParticlesPerCell || 1);
    
    if (loadFactor < 0.3) {
      console.log(`Grid underutilized: ${(loadFactor * 100).toFixed(1)}% cells occupied. Consider smaller grid.`);
    } else if (hotspotRatio > 3) {
      console.log(`Distribution uneven: max cell has ${hotspotRatio.toFixed(1)}x average. Consider smaller cells.`);
    }
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    // Clean up buffer pool first
    this.cleanupBufferPool();
    
    if (this.cellCountsBuffer) this.bufferManager.destroyBuffer(this.cellCountsBuffer);
    if (this.cellOffsetsBuffer) this.bufferManager.destroyBuffer(this.cellOffsetsBuffer);
    if (this.cellParticlesBuffer) this.bufferManager.destroyBuffer(this.cellParticlesBuffer);
    if (this.sortedIndicesBuffer) this.bufferManager.destroyBuffer(this.sortedIndicesBuffer);
    if (this.sortKeysBuffer) this.bufferManager.destroyBuffer(this.sortKeysBuffer);
    if (this.gridParamsBuffer) this.bufferManager.destroyBuffer(this.gridParamsBuffer);

    // Clear references
    this.cellCountsBuffer = null;
    this.cellOffsetsBuffer = null;
    this.cellParticlesBuffer = null;
    this.sortedIndicesBuffer = null;
    this.sortKeysBuffer = null;
    this.gridParamsBuffer = null;
    
    // Clear buffer pool references
    this.neighborBufferSizes.clear();
  }

  /**
   * Create GPU buffers for spatial grid data
   */
  private async createBuffers(): Promise<void> {
    // Cell counts buffer (number of particles per cell)
    this.cellCountsBuffer = this.bufferManager.createBuffer({
      size: this.totalCells * 4, // u32 per cell
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid-cell-counts'
    });

    // Cell offsets buffer (starting index for each cell's particles)
    this.cellOffsetsBuffer = this.bufferManager.createBuffer({
      size: this.totalCells * 4, // u32 per cell
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid-cell-offsets'
    });

    // Cell particles buffer (particle indices per cell)
    const cellParticlesSize = this.totalCells * this.options.maxParticlesPerCell * 4;
    this.cellParticlesBuffer = this.bufferManager.createBuffer({
      size: cellParticlesSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid-cell-particles'
    });

    // Sorted particle indices buffer
    this.sortedIndicesBuffer = this.bufferManager.createBuffer({
      size: this.options.maxParticles * 4, // u32 per particle
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid-sorted-indices'
    });

    // Sort keys buffer for spatial sorting
    this.sortKeysBuffer = this.bufferManager.createBuffer({
      size: this.options.maxParticles * 8, // 2 x u32 per particle (cellIndex + particleIndex)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'grid-sort-keys'
    });

    // Grid parameters uniform buffer
    const gridParams = new Float32Array([
      this.options.width, this.options.height, this.options.cellSize, this.gridWidth,
      this.gridHeight, this.totalCells, this.options.maxParticlesPerCell, 0
    ]);
    this.gridParamsBuffer = this.bufferManager.createUniformBuffer(
      gridParams.buffer,
      'grid-parameters'
    );
  }

  /**
   * Recreate buffers with new dimensions
   */
  private async recreateBuffers(): Promise<void> {
    // Clean up old buffers
    if (this.cellCountsBuffer) this.bufferManager.destroyBuffer(this.cellCountsBuffer);
    if (this.cellOffsetsBuffer) this.bufferManager.destroyBuffer(this.cellOffsetsBuffer);
    if (this.cellParticlesBuffer) this.bufferManager.destroyBuffer(this.cellParticlesBuffer);
    if (this.sortKeysBuffer) this.bufferManager.destroyBuffer(this.sortKeysBuffer);
    if (this.gridParamsBuffer) this.bufferManager.destroyBuffer(this.gridParamsBuffer);

    // Create new buffers
    await this.createBuffers();
  }

  /**
   * Create compute pipelines for spatial operations
   */
  private async createComputePipelines(): Promise<void> {
    // Clear grid pipeline
    const clearGridShader = `
      @group(0) @binding(0) var<storage, read_write> cellCounts: array<u32>;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= arrayLength(&cellCounts)) {
          return;
        }
        cellCounts[index] = 0u;
      }
    `;

    this.clearGridPipeline = this.shaderManager.createComputePipeline({
      shaderSource: clearGridShader,
      options: { label: 'clear-grid-pipeline' }
    });

    // Populate grid pipeline - maps particles to grid cells with frustum culling
    const populateGridShader = `
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>,
        state: u32,
      }
      
      struct GridParams {
        width: f32,
        height: f32,
        cellSize: f32,
        gridWidth: f32,
        gridHeight: f32,
        totalCells: f32,
        maxParticlesPerCell: f32,
        particleCount: f32,
      }
      
      @group(0) @binding(0) var<storage, read> particles: array<Particle>;
      @group(0) @binding(1) var<storage, read_write> cellCounts: array<atomic<u32>>;
      @group(0) @binding(2) var<storage, read_write> cellParticles: array<u32>;
      @group(0) @binding(3) var<uniform> gridParams: GridParams;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let particleIndex = global_id.x;
        if (particleIndex >= u32(gridParams.particleCount)) {
          return;
        }
        
        let particle = particles[particleIndex];
        
        // Skip inactive or dead particles
        if ((particle.state & 1u) == 0u || (particle.state & 8u) != 0u) {
          return;
        }
        
        // Frustum culling: skip particles outside view area
        // Basic bounds checking - in practice this would use camera frustum
        if (particle.position.x < 0.0 || particle.position.x > gridParams.width ||
            particle.position.y < 0.0 || particle.position.y > gridParams.height) {
          return;
        }
        
        // Calculate grid cell
        let cellX = u32(particle.position.x / gridParams.cellSize);
        let cellY = u32(particle.position.y / gridParams.cellSize);
        
        // Bounds check
        if (cellX >= u32(gridParams.gridWidth) || cellY >= u32(gridParams.gridHeight)) {
          return;
        }
        
        let cellIndex = cellY * u32(gridParams.gridWidth) + cellX;
        
        // Atomically increment cell count and get slot
        let slot = atomicAdd(&cellCounts[cellIndex], 1u);
        
        // Store particle index in cell if there's space
        if (slot < u32(gridParams.maxParticlesPerCell)) {
          let particleSlot = cellIndex * u32(gridParams.maxParticlesPerCell) + slot;
          cellParticles[particleSlot] = particleIndex;
        }
      }
    `;

    this.populateGridPipeline = this.shaderManager.createComputePipeline({
      shaderSource: populateGridShader,
      options: { label: 'populate-grid-pipeline' }
    });

    // Build offsets pipeline - creates prefix sum for efficient cell access
    const buildOffsetsShader = `
      @group(0) @binding(0) var<storage, read> cellCounts: array<u32>;
      @group(0) @binding(1) var<storage, read_write> cellOffsets: array<u32>;
      @group(0) @binding(2) var<uniform> gridParams: GridParams;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let cellIndex = global_id.x;
        if (cellIndex >= u32(gridParams.totalCells)) {
          return;
        }
        
        // Simple prefix sum implementation (not optimized for large grids)
        var offset = 0u;
        for (var i = 0u; i < cellIndex; i++) {
          offset += cellCounts[i];
        }
        cellOffsets[cellIndex] = offset;
      }
    `;

    this.buildOffsetssPipeline = this.shaderManager.createComputePipeline({
      shaderSource: buildOffsetsShader,
      options: { label: 'build-offsets-pipeline' }
    });

    // Neighbor query pipeline - efficient neighbor searching with distance culling
    const neighborQueryShader = `
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>,
        state: u32,
      }
      
      struct GridParams {
        width: f32,
        height: f32,
        cellSize: f32,
        gridWidth: f32,
        gridHeight: f32,
        totalCells: f32,
        maxParticlesPerCell: f32,
        particleCount: f32,
      }
      
      struct QueryParams {
        position: vec2<f32>,
        radius: f32,
        maxNeighbors: f32,
        excludeParticle: f32,
        _padding: vec3<f32>,
      }
      
      struct QueryResult {
        count: u32,
        truncated: u32,
        _padding: vec2<u32>,
        indices: array<u32, 64>, // Max 64 neighbors for simplicity
        distances: array<f32, 64>,
      }
      
      @group(0) @binding(0) var<storage, read> cellCounts: array<u32>;
      @group(0) @binding(1) var<storage, read> cellOffsets: array<u32>;
      @group(0) @binding(2) var<storage, read> cellParticles: array<u32>;
      @group(0) @binding(3) var<storage, read> particles: array<Particle>;
      @group(0) @binding(4) var<uniform> gridParams: GridParams;
      @group(0) @binding(5) var<uniform> queryParams: QueryParams;
      @group(0) @binding(6) var<storage, read_write> result: QueryResult;
      
      @workgroup_size(1)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let queryPos = queryParams.position;
        let queryRadius = queryParams.radius;
        let maxNeighbors = u32(queryParams.maxNeighbors);
        let excludeIndex = i32(queryParams.excludeParticle);
        
        // Initialize result
        result.count = 0u;
        result.truncated = 0u;
        
        // Calculate search area in grid cells
        let cellRadius = u32(ceil(queryRadius / gridParams.cellSize));
        let centerCellX = u32(queryPos.x / gridParams.cellSize);
        let centerCellY = u32(queryPos.y / gridParams.cellSize);
        
        var neighborCount = 0u;
        let radiusSquared = queryRadius * queryRadius;
        
        // Search neighboring cells
        for (var dy = 0u; dy <= cellRadius * 2u; dy++) {
          for (var dx = 0u; dx <= cellRadius * 2u; dx++) {
            let cellX = centerCellX + dx - cellRadius;
            let cellY = centerCellY + dy - cellRadius;
            
            // Bounds check
            if (cellX >= u32(gridParams.gridWidth) || cellY >= u32(gridParams.gridHeight)) {
              continue;
            }
            
            let cellIndex = cellY * u32(gridParams.gridWidth) + cellX;
            let cellCount = cellCounts[cellIndex];
            
            // Check particles in this cell
            for (var i = 0u; i < cellCount && i < u32(gridParams.maxParticlesPerCell); i++) {
              if (neighborCount >= maxNeighbors) {
                result.truncated = 1u;
                break;
              }
              
              let particleSlot = cellIndex * u32(gridParams.maxParticlesPerCell) + i;
              let particleIndex = cellParticles[particleSlot];
              
              // Skip excluded particle
              if (excludeIndex >= 0 && particleIndex == u32(excludeIndex)) {
                continue;
              }
              
              let particle = particles[particleIndex];
              
              // Skip inactive or dead particles
              if ((particle.state & 1u) == 0u || (particle.state & 8u) != 0u) {
                continue;
              }
              
              // Calculate distance
              let diff = particle.position - queryPos;
              let distanceSquared = dot(diff, diff);
              
              // Check if within radius
              if (distanceSquared <= radiusSquared) {
                result.indices[neighborCount] = particleIndex;
                result.distances[neighborCount] = sqrt(distanceSquared);
                neighborCount++;
              }
            }
            
            if (result.truncated == 1u) {
              break;
            }
          }
          
          if (result.truncated == 1u) {
            break;
          }
        }
        
        result.count = neighborCount;
      }
    `;

    this.neighborQueryPipeline = this.shaderManager.createComputePipeline({
      shaderSource: neighborQueryShader,
      options: { label: 'neighbor-query-pipeline' }
    });

    // Particle spatial sorting pipeline - organizes particles by spatial locality
    const spatialSortShader = `
      struct Particle {
        position: vec2<f32>,
        velocity: vec2<f32>,
        acceleration: vec2<f32>,
        mass: f32,
        size: f32,
        color: vec4<f32>,
        lifetime: vec2<f32>,
        state: u32,
      }
      
      struct GridParams {
        width: f32,
        height: f32,
        cellSize: f32,
        gridWidth: f32,
        gridHeight: f32,
        totalCells: f32,
        maxParticlesPerCell: f32,
        particleCount: f32,
      }
      
      struct SortKey {
        cellIndex: u32,
        particleIndex: u32,
      }
      
      @group(0) @binding(0) var<storage, read> particles: array<Particle>;
      @group(0) @binding(1) var<storage, read> cellCounts: array<u32>;
      @group(0) @binding(2) var<storage, read> cellOffsets: array<u32>;
      @group(0) @binding(3) var<storage, read_write> sortKeys: array<SortKey>;
      @group(0) @binding(4) var<storage, read_write> sortedIndices: array<u32>;
      @group(0) @binding(5) var<uniform> gridParams: GridParams;
      
      @workgroup_size(64)
      @compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let particleIndex = global_id.x;
        if (particleIndex >= u32(gridParams.particleCount)) {
          return;
        }
        
        let particle = particles[particleIndex];
        
        // Skip inactive or dead particles
        if ((particle.state & 1u) == 0u || (particle.state & 8u) != 0u) {
          return;
        }
        
        // Calculate grid cell for this particle
        let cellX = u32(particle.position.x / gridParams.cellSize);
        let cellY = u32(particle.position.y / gridParams.cellSize);
        
        // Bounds check
        if (cellX >= u32(gridParams.gridWidth) || cellY >= u32(gridParams.gridHeight)) {
          return;
        }
        
        let cellIndex = cellY * u32(gridParams.gridWidth) + cellX;
        
        // Create sort key combining cell index and particle distance from cell center
        let cellCenterX = (f32(cellX) + 0.5) * gridParams.cellSize;
        let cellCenterY = (f32(cellY) + 0.5) * gridParams.cellSize;
        let distanceFromCenter = distance(particle.position, vec2<f32>(cellCenterX, cellCenterY));
        
        // Use distance as sub-key for spatial locality within cells
        let subKey = u32(distanceFromCenter * 1000.0); // Convert to fixed-point for sorting
        let combinedKey = (cellIndex << 16u) | (subKey & 0xFFFFu);
        
        // Store sort key
        sortKeys[particleIndex] = SortKey(combinedKey, particleIndex);
      }
    `;

    this.sortParticlesPipeline = this.shaderManager.createComputePipeline({
      shaderSource: spatialSortShader,
      options: { label: 'spatial-sort-pipeline' }
    });
  }

  /**
   * Create bind groups for compute pipelines
   */
  private async createBindGroups(): Promise<void> {
    if (!this.clearGridPipeline || !this.populateGridPipeline || !this.buildOffsetssPipeline ||
        !this.cellCountsBuffer || !this.cellOffsetsBuffer || !this.cellParticlesBuffer || !this.gridParamsBuffer) {
      throw new Error('Pipelines or buffers not initialized');
    }

    const device = this.context.getDevice();

    // Clear grid bind group
    this.clearBindGroup = device.createBindGroup({
      layout: this.clearGridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cellCountsBuffer } }
      ]
    });

    // Build offsets bind group
    this.offsetsBindGroup = device.createBindGroup({
      layout: this.buildOffsetssPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cellCountsBuffer } },
        { binding: 1, resource: { buffer: this.cellOffsetsBuffer } },
        { binding: 2, resource: { buffer: this.gridParamsBuffer } }
      ]
    });

    // Note: Populate bind group will be created dynamically with particle buffer
  }

  /**
   * Clear all grid cells
   */
  private async clearGrid(): Promise<void> {
    if (!this.clearGridPipeline || !this.clearBindGroup) {
      throw new Error('Clear grid pipeline not initialized');
    }

    const encoder = this.context.createCommandEncoder('clear-grid');
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(this.clearGridPipeline);
    computePass.setBindGroup(0, this.clearBindGroup);

    const workgroups = Math.ceil(this.totalCells / 64);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();
    this.context.submit([encoder.finish()]);
  }

  /**
   * Populate grid cells with particles
   */
  private async populateGrid(particleBuffer: GPUBuffer, particleCount: number): Promise<void> {
    if (!this.populateGridPipeline || !this.gridParamsBuffer) {
      throw new Error('Populate grid pipeline not initialized');
    }

    // Update grid parameters with current particle count
    const gridParams = new Float32Array([
      this.options.width, this.options.height, this.options.cellSize, this.gridWidth,
      this.gridHeight, this.totalCells, this.options.maxParticlesPerCell, particleCount
    ]);
    this.context.writeBuffer(this.gridParamsBuffer, gridParams.buffer);

    // Create populate bind group with current particle buffer
    const device = this.context.getDevice();
    const populateBindGroup = device.createBindGroup({
      layout: this.populateGridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this.cellCountsBuffer! } },
        { binding: 2, resource: { buffer: this.cellParticlesBuffer! } },
        { binding: 3, resource: { buffer: this.gridParamsBuffer } }
      ]
    });

    // Dispatch populate grid compute shader
    const encoder = this.context.createCommandEncoder('populate-grid');
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(this.populateGridPipeline);
    computePass.setBindGroup(0, populateBindGroup);

    const workgroups = Math.ceil(particleCount / 64);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();
    this.context.submit([encoder.finish()]);
  }

  /**
   * Build cell offset arrays for efficient neighbor access
   */
  private async buildOffsets(): Promise<void> {
    if (!this.buildOffsetssPipeline || !this.offsetsBindGroup) {
      throw new Error('Build offsets pipeline not initialized');
    }

    const encoder = this.context.createCommandEncoder('build-offsets');
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(this.buildOffsetssPipeline);
    computePass.setBindGroup(0, this.offsetsBindGroup);

    const workgroups = Math.ceil(this.totalCells / 64);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();
    this.context.submit([encoder.finish()]);
  }

  /**
   * Sort particles spatially for improved memory access patterns
   */
  private async sortParticlesInCells(particleBuffer: GPUBuffer, particleCount: number): Promise<void> {
    if (!this.sortParticlesPipeline || !this.sortKeysBuffer || !this.sortedIndicesBuffer) {
      console.warn('Spatial sorting pipeline not initialized, skipping sort');
      return;
    }

    const device = this.context.getDevice();

    // Create sort bind group with current particle buffer
    const sortBindGroup = device.createBindGroup({
      layout: this.sortParticlesPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this.cellCountsBuffer! } },
        { binding: 2, resource: { buffer: this.cellOffsetsBuffer! } },
        { binding: 3, resource: { buffer: this.sortKeysBuffer } },
        { binding: 4, resource: { buffer: this.sortedIndicesBuffer } },
        { binding: 5, resource: { buffer: this.gridParamsBuffer! } }
      ]
    });

    // Generate sort keys
    const encoder = this.context.createCommandEncoder('spatial-sort');
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(this.sortParticlesPipeline);
    computePass.setBindGroup(0, sortBindGroup);

    const workgroups = Math.ceil(particleCount / 64);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();
    this.context.submit([encoder.finish()]);

    // Note: In a full implementation, we would need to implement a GPU sorting algorithm
    // like bitonic sort or radix sort to actually sort the keys and reorder particles.
    // For now, we're just generating the sort keys which is the foundation.
    // The sorting algorithm would be quite complex and is beyond this initial implementation.
  }

  /**
   * Check if grid should be resized based on multiple performance metrics
   */
  private shouldResizeGrid(particleCount: number): boolean {
    if (!this.options.enableDynamicResize) {
      return false;
    }

    const avgParticlesPerCell = particleCount / this.totalCells;
    
    // Check density thresholds (wider range to avoid frequent resizing)
    const densityTooHigh = avgParticlesPerCell > this.options.maxParticlesPerCell * 0.85;
    const densityTooLow = avgParticlesPerCell < this.options.maxParticlesPerCell * 0.15;
    
    // Check if particle count has changed significantly
    const countChangedSignificantly = Math.abs(particleCount - this.currentParticleCount) > 
                                    Math.max(100, this.currentParticleCount * 0.3);
    
    // Consider performance: only resize if we expect significant benefit
    const currentCells = this.totalCells;
    const wouldBenefitFromResize = currentCells < 64 || currentCells > 10000;
    
    return (densityTooHigh || densityTooLow || 
           (countChangedSignificantly && wouldBenefitFromResize)) &&
           particleCount > 10; // Don't resize for very small particle counts
  }

  /**
   * Update performance metrics
   */
  private async updateMetrics(): Promise<void> {
    // This will read back GPU data to update metrics
    // For now, use estimated values
    this.metrics.avgParticlesPerCell = this.currentParticleCount / this.totalCells;
    this.metrics.totalCells = this.totalCells;
    
    // Estimate memory usage
    const bufferSizes = [
      this.totalCells * 8, // counts + offsets
      this.totalCells * this.options.maxParticlesPerCell * 4, // particles
      this.options.maxParticles * 4, // sorted indices
      32 // parameters
    ];
    this.metrics.memoryUsageMB = bufferSizes.reduce((sum, size) => sum + size, 0) / (1024 * 1024);
  }
}