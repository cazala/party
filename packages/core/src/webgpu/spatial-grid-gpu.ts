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

    // Sort particles within cells (optional optimization)
    // await this.sortParticlesInCells(particleBuffer, particleCount);

    // Update metrics
    this.metrics.lastUpdateMs = performance.now() - startTime;
    await this.updateMetrics();
  }

  /**
   * Query neighbors around a specific position
   */
  async queryNeighbors(query: NeighborQuery): Promise<NeighborResult> {
    if (!this.neighborQueryPipeline || !this.queryBindGroup) {
      throw new Error('Neighbor query pipeline not initialized');
    }

    // Create query result buffer
    const resultBuffer = this.bufferManager.createBuffer({
      size: (query.maxNeighbors * 8) + 16, // indices (u32) + distances (f32) + metadata
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      label: 'neighbor-query-result'
    });

    // Create query parameters buffer
    const queryParams = new Float32Array([
      query.position[0], query.position[1], query.radius, query.maxNeighbors,
      query.excludeParticle || -1, 0, 0, 0 // Padding for alignment
    ]);
    const queryParamsBuffer = this.bufferManager.createUniformBuffer(
      queryParams.buffer,
      'neighbor-query-params'
    );

    // Update bind group with query-specific buffers
    const device = this.context.getDevice();
    const queryBindGroup = device.createBindGroup({
      layout: this.neighborQueryPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cellCountsBuffer! } },
        { binding: 1, resource: { buffer: this.cellOffsetsBuffer! } },
        { binding: 2, resource: { buffer: this.cellParticlesBuffer! } },
        { binding: 3, resource: { buffer: this.sortedIndicesBuffer! } },
        { binding: 4, resource: { buffer: queryParamsBuffer } },
        { binding: 5, resource: { buffer: resultBuffer } }
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
      const distanceOffset = 16 + (query.maxNeighbors * 4) + (i * 4);

      indices.push(resultView.getUint32(indexOffset, true));
      distances.push(resultView.getFloat32(distanceOffset, true));
    }

    // Cleanup temporary buffers
    this.bufferManager.destroyBuffer(resultBuffer);
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
   * Resize grid for different particle counts
   */
  async resizeGrid(particleCount: number): Promise<void> {
    if (!this.options.enableDynamicResize) {
      return;
    }

    // Calculate optimal cell size based on particle count
    const particleDensity = particleCount / (this.options.width * this.options.height);
    const optimalCellSize = Math.sqrt(this.options.maxParticlesPerCell / particleDensity);
    
    // Clamp cell size to reasonable bounds
    const newCellSize = Math.max(20, Math.min(200, optimalCellSize));

    if (Math.abs(newCellSize - this.options.cellSize) > 5) {
      console.log(`Resizing grid: ${this.options.cellSize} -> ${newCellSize}`);
      
      this.options.cellSize = newCellSize;
      this.gridWidth = Math.ceil(this.options.width / newCellSize);
      this.gridHeight = Math.ceil(this.options.height / newCellSize);
      this.totalCells = this.gridWidth * this.gridHeight;

      // Recreate buffers with new size
      await this.recreateBuffers();
      await this.createBindGroups();
    }
  }

  /**
   * Clean up GPU resources
   */
  destroy(): void {
    if (this.cellCountsBuffer) this.bufferManager.destroyBuffer(this.cellCountsBuffer);
    if (this.cellOffsetsBuffer) this.bufferManager.destroyBuffer(this.cellOffsetsBuffer);
    if (this.cellParticlesBuffer) this.bufferManager.destroyBuffer(this.cellParticlesBuffer);
    if (this.sortedIndicesBuffer) this.bufferManager.destroyBuffer(this.sortedIndicesBuffer);
    if (this.gridParamsBuffer) this.bufferManager.destroyBuffer(this.gridParamsBuffer);

    // Clear references
    this.cellCountsBuffer = null;
    this.cellOffsetsBuffer = null;
    this.cellParticlesBuffer = null;
    this.sortedIndicesBuffer = null;
    this.gridParamsBuffer = null;
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

    // Populate grid pipeline - maps particles to grid cells
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
   * Check if grid should be resized
   */
  private shouldResizeGrid(particleCount: number): boolean {
    if (!this.options.enableDynamicResize) {
      return false;
    }

    const avgParticlesPerCell = particleCount / this.totalCells;
    return avgParticlesPerCell > this.options.maxParticlesPerCell * 0.8 ||
           avgParticlesPerCell < this.options.maxParticlesPerCell * 0.2;
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