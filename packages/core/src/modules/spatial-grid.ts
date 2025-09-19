import { Particle } from "./particle";
import { Vector } from "./webgpu/vector";

// Generic joint interface for spatial grid operations
interface SpatialJoint {
  id: string;
  particleA: Particle;
  particleB: Particle;
  isValid: boolean;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialGridOptions {
  width: number;
  height: number;
  cellSize: number;
}

export class SpatialGrid {
  private width: number;
  private height: number;
  private cellSize: number;
  private cols!: number;
  private rows!: number;
  private grid!: Particle[][][];
  // Joint spatial grid for optimization
  private jointGrid!: SpatialJoint[][][];
  // Dynamic bounds that match current camera view
  private minX!: number;
  private minY!: number;
  private maxX!: number;
  private maxY!: number;
  // Camera tracking
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;

  // Object pooling for grid cell arrays
  private arrayPool: Particle[][] = [];
  private jointArrayPool: SpatialJoint[][] = [];
  private maxPoolSize: number = 1000; // Limit pool size to prevent excessive memory usage

  // Pool statistics for hit rate monitoring
  private poolStats = {
    totalRequests: 0,
    poolHits: 0,
  };

  // Track particles for incremental updates
  private particlePositions: Map<number, { col: number; row: number }> =
    new Map();

  constructor(options: SpatialGridOptions) {
    this.width = options.width;
    this.height = options.height;
    this.cellSize = options.cellSize;

    // Initialize with default camera view (canvas coordinates)
    this.updateBounds(0, 0, 1);
  }

  private updateBounds(cameraX: number, cameraY: number, zoom: number): void {
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoom = zoom;

    // Calculate visible world bounds
    const worldLeft = -cameraX / zoom;
    const worldTop = -cameraY / zoom;
    const worldRight = (this.width - cameraX) / zoom;
    const worldBottom = (this.height - cameraY) / zoom;

    // Add padding around visible area to catch particles just outside view
    const padding = (Math.max(this.width, this.height) / zoom) * 0.5; // 50% padding
    this.minX = worldLeft - padding;
    this.minY = worldTop - padding;
    this.maxX = worldRight + padding;
    this.maxY = worldBottom + padding;

    // Recalculate grid dimensions
    this.cols = Math.ceil((this.maxX - this.minX) / this.cellSize);
    this.rows = Math.ceil((this.maxY - this.minY) / this.cellSize);

    this.initializeGrid();
  }

  setCamera(cameraX: number, cameraY: number, zoom: number): void {
    // Only update if camera changed significantly to avoid constant grid rebuilding
    const threshold = this.cellSize * 0.5; // Half a cell
    const zoomThreshold = 0.1;

    if (
      Math.abs(this.cameraX - cameraX) > threshold ||
      Math.abs(this.cameraY - cameraY) > threshold ||
      Math.abs(this.zoom - zoom) > zoomThreshold
    ) {
      this.updateBounds(cameraX, cameraY, zoom);
    }
  }

  private initializeGrid(): void {
    this.grid = [];
    this.jointGrid = [];
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      this.jointGrid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = this.getPooledArray();
        this.jointGrid[row][col] = this.getPooledJointArray();
      }
    }
  }

  /**
   * Get a pooled array for particles, or create new one if pool is empty
   */
  private getPooledArray(): Particle[] {
    this.poolStats.totalRequests++;
    if (this.arrayPool.length > 0) {
      this.poolStats.poolHits++;
      return this.arrayPool.pop()!;
    }
    return [];
  }

  /**
   * Get a pooled array for joints, or create new one if pool is empty
   */
  private getPooledJointArray(): SpatialJoint[] {
    this.poolStats.totalRequests++;
    if (this.jointArrayPool.length > 0) {
      this.poolStats.poolHits++;
      return this.jointArrayPool.pop()!;
    }
    return [];
  }

  /**
   * Return an array to the pool for reuse
   */
  private returnArrayToPool(array: Particle[]): void {
    array.length = 0; // Clear the array
    if (this.arrayPool.length < this.maxPoolSize) {
      this.arrayPool.push(array);
    }
  }

  /**
   * Return a joint array to the pool for reuse
   */
  private returnJointArrayToPool(array: SpatialJoint[]): void {
    array.length = 0; // Clear the array
    if (this.jointArrayPool.length < this.maxPoolSize) {
      this.jointArrayPool.push(array);
    }
  }

  clear(): void {
    // Return arrays to pool and get fresh ones
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.returnArrayToPool(this.grid[row][col]);
        this.returnJointArrayToPool(this.jointGrid[row][col]);
        this.grid[row][col] = this.getPooledArray();
        this.jointGrid[row][col] = this.getPooledJointArray();
      }
    }

    // Clear particle position tracking
    this.particlePositions.clear();
  }

  /**
   * Incrementally clear only cells that contained particles
   * Much more efficient than full clear for sparse grids
   */
  clearIncremental(_particles: Particle[]): void {
    // Only clear cells that actually contained particles
    const cellsToClean = new Set<string>();

    // Collect cells that need clearing from previous particle positions
    for (const [, position] of this.particlePositions) {
      const key = `${position.row}-${position.col}`;
      cellsToClean.add(key);
    }

    // Clear only those cells
    for (const key of cellsToClean) {
      const [row, col] = key.split("-").map(Number);
      if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        this.returnArrayToPool(this.grid[row][col]);
        this.returnJointArrayToPool(this.jointGrid[row][col]);
        this.grid[row][col] = this.getPooledArray();
        this.jointGrid[row][col] = this.getPooledJointArray();
      }
    }

    // Clear particle position tracking
    this.particlePositions.clear();
  }

  insert(particle: Particle): void {
    // Convert world coordinates to grid coordinates with offset
    const col = Math.floor((particle.position.x - this.minX) / this.cellSize);
    const row = Math.floor((particle.position.y - this.minY) / this.cellSize);

    // Clamp to grid bounds
    const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.rows - 1));

    // Insert particle into grid
    this.grid[clampedRow][clampedCol].push(particle);

    // Track particle position for incremental updates
    this.particlePositions.set(particle.id, {
      col: clampedCol,
      row: clampedRow,
    });
  }

  getParticles(point: Vector, radius: number): Particle[] {
    const neighbors: Particle[] = [];
    // Convert world coordinates to grid coordinates with offset
    const centerCol = Math.floor((point.x - this.minX) / this.cellSize);
    const centerRow = Math.floor((point.y - this.minY) / this.cellSize);

    // Calculate how many cells to check in each direction
    const cellRadius = Math.ceil(radius / this.cellSize);

    for (
      let row = centerRow - cellRadius;
      row <= centerRow + cellRadius;
      row++
    ) {
      for (
        let col = centerCol - cellRadius;
        col <= centerCol + cellRadius;
        col++
      ) {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          const cellParticles = this.grid[row][col];
          for (const candidate of cellParticles) {
            const distance = point.distance(candidate.position);
            if (distance > 0 && distance < radius) {
              neighbors.push(candidate);
            }
          }
        }
      }
    }

    return neighbors;
  }

  getCellParticleCount(col: number, row: number): number {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.grid[row][col].length;
    }
    return 0;
  }

  getGridDimensions(): { cols: number; rows: number; cellSize: number } {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
    };
  }

  getGridBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    return {
      minX: this.minX,
      minY: this.minY,
      maxX: this.maxX,
      maxY: this.maxY,
    };
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.width,
      height: this.height,
    };
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Update bounds with current camera settings
    this.updateBounds(this.cameraX, this.cameraY, this.zoom);
  }

  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    // Update bounds with new cell size
    this.updateBounds(this.cameraX, this.cameraY, this.zoom);
  }

  getAllParticles(): Particle[] {
    const allParticles: Particle[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        allParticles.push(...this.grid[row][col]);
      }
    }
    return allParticles;
  }

  // Joint spatial optimization methods

  /**
   * Calculate the bounding box of a joint (line segment)
   */
  private getJointBoundingBox(joint: SpatialJoint): BoundingBox {
    const minX = Math.min(
      joint.particleA.position.x,
      joint.particleB.position.x
    );
    const maxX = Math.max(
      joint.particleA.position.x,
      joint.particleB.position.x
    );
    const minY = Math.min(
      joint.particleA.position.y,
      joint.particleB.position.y
    );
    const maxY = Math.max(
      joint.particleA.position.y,
      joint.particleB.position.y
    );

    return { minX, minY, maxX, maxY };
  }

  /**
   * Insert a joint into the spatial grid based on its bounding box
   */
  insertJoint(joint: SpatialJoint): void {
    if (!joint.isValid) return;

    const boundingBox = this.getJointBoundingBox(joint);

    // Convert world coordinates to grid coordinates
    const minCol = Math.max(
      0,
      Math.floor((boundingBox.minX - this.minX) / this.cellSize)
    );
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((boundingBox.maxX - this.minX) / this.cellSize)
    );
    const minRow = Math.max(
      0,
      Math.floor((boundingBox.minY - this.minY) / this.cellSize)
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((boundingBox.maxY - this.minY) / this.cellSize)
    );

    // Insert joint into all cells it overlaps
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        this.jointGrid[row][col].push(joint);
      }
    }
  }

  /**
   * Get all joints that could potentially intersect with the given joint
   * Uses spatial grid to avoid checking all joints
   */
  getNearbyJoints(joint: SpatialJoint): SpatialJoint[] {
    if (!joint.isValid) return [];

    const nearbyJoints = new Set<SpatialJoint>();
    const boundingBox = this.getJointBoundingBox(joint);

    // Convert world coordinates to grid coordinates
    const minCol = Math.max(
      0,
      Math.floor((boundingBox.minX - this.minX) / this.cellSize)
    );
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((boundingBox.maxX - this.minX) / this.cellSize)
    );
    const minRow = Math.max(
      0,
      Math.floor((boundingBox.minY - this.minY) / this.cellSize)
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((boundingBox.maxY - this.minY) / this.cellSize)
    );

    // Collect joints from all overlapping cells
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellJoints = this.jointGrid[row][col];
        for (const candidateJoint of cellJoints) {
          if (candidateJoint !== joint && candidateJoint.isValid) {
            nearbyJoints.add(candidateJoint);
          }
        }
      }
    }

    return Array.from(nearbyJoints);
  }

  /**
   * Get joints within a specific region (bounding box)
   */
  getJointsInRegion(bounds: BoundingBox): SpatialJoint[] {
    const jointsInRegion = new Set<SpatialJoint>();

    // Convert world coordinates to grid coordinates
    const minCol = Math.max(
      0,
      Math.floor((bounds.minX - this.minX) / this.cellSize)
    );
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((bounds.maxX - this.minX) / this.cellSize)
    );
    const minRow = Math.max(
      0,
      Math.floor((bounds.minY - this.minY) / this.cellSize)
    );
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((bounds.maxY - this.minY) / this.cellSize)
    );

    // Collect joints from all cells in the region
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellJoints = this.jointGrid[row][col];
        for (const joint of cellJoints) {
          if (joint.isValid) {
            jointsInRegion.add(joint);
          }
        }
      }
    }

    return Array.from(jointsInRegion);
  }

  /**
   * Clear all joints from the spatial grid (called each frame before re-inserting)
   */
  clearJoints(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.returnJointArrayToPool(this.jointGrid[row][col]);
        this.jointGrid[row][col] = this.getPooledJointArray();
      }
    }
  }

  /**
   * Get particles within the camera frustum (visible area) with optional padding
   */
  getVisibleParticles(particles: Particle[], padding: number = 50): Particle[] {
    const visibleParticles: Particle[] = [];

    // Calculate visible bounds with padding
    const leftBound = this.minX - padding;
    const rightBound = this.maxX + padding;
    const topBound = this.minY - padding;
    const bottomBound = this.maxY + padding;

    for (const particle of particles) {
      // Check if particle is within visible bounds (including its size)
      if (
        particle.position.x + particle.size >= leftBound &&
        particle.position.x - particle.size <= rightBound &&
        particle.position.y + particle.size >= topBound &&
        particle.position.y - particle.size <= bottomBound
      ) {
        visibleParticles.push(particle);
      }
    }

    return visibleParticles;
  }

  /**
   * Check if a particle is within the camera frustum
   */
  isParticleVisible(particle: Particle, padding: number = 50): boolean {
    const leftBound = this.minX - padding;
    const rightBound = this.maxX + padding;
    const topBound = this.minY - padding;
    const bottomBound = this.maxY + padding;

    return (
      particle.position.x + particle.size >= leftBound &&
      particle.position.x - particle.size <= rightBound &&
      particle.position.y + particle.size >= topBound &&
      particle.position.y - particle.size <= bottomBound
    );
  }

  /**
   * Set the maximum pool size for array pooling
   * @param maxSize Maximum number of arrays to keep in pool
   */
  setMaxPoolSize(maxSize: number): void {
    this.maxPoolSize = Math.max(0, maxSize);

    // Trim pools if they exceed new max size
    if (this.arrayPool.length > this.maxPoolSize) {
      this.arrayPool.length = this.maxPoolSize;
    }
    if (this.jointArrayPool.length > this.maxPoolSize) {
      this.jointArrayPool.length = this.maxPoolSize;
    }
  }

  /**
   * Get the current maximum pool size
   * @returns Maximum pool size
   */
  getMaxPoolSize(): number {
    return this.maxPoolSize;
  }

  /**
   * Get current pool statistics for debugging/monitoring
   * @returns Object with pool usage statistics
   */
  getPoolStats(): {
    arrayPool: number;
    jointArrayPool: number;
    maxPoolSize: number;
    hitRate: number;
  } {
    const hitRate =
      this.poolStats.totalRequests > 0
        ? (this.poolStats.poolHits / this.poolStats.totalRequests) * 100
        : 0;

    return {
      arrayPool: this.arrayPool.length,
      jointArrayPool: this.jointArrayPool.length,
      maxPoolSize: this.maxPoolSize,
      hitRate: Math.round(hitRate * 10) / 10, // Round to 1 decimal place
    };
  }

  /**
   * Check if two bounding boxes overlap (for pre-filtering intersection tests)
   */
  private boundingBoxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(
      box1.maxX < box2.minX ||
      box2.maxX < box1.minX ||
      box1.maxY < box2.minY ||
      box2.maxY < box1.minY
    );
  }

  /**
   * Get joints that could intersect with the given joint, pre-filtered by bounding box
   */
  getNearbyJointsWithBoundingBoxFilter(joint: SpatialJoint): SpatialJoint[] {
    const nearbyJoints = this.getNearbyJoints(joint);
    const jointBoundingBox = this.getJointBoundingBox(joint);

    return nearbyJoints.filter((candidateJoint) => {
      const candidateBoundingBox = this.getJointBoundingBox(candidateJoint);
      return this.boundingBoxesOverlap(jointBoundingBox, candidateBoundingBox);
    });
  }
}
