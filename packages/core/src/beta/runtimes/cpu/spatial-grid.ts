import { Particle } from "../../particle";
import { Vector } from "../../vector";

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

  // Dynamic bounds that match current camera view
  private minX!: number;
  private minY!: number;
  private maxX!: number;
  private maxY!: number;
  // Camera tracking
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;

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
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = [];
      }
    }
  }

  clear(): void {
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = [];
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
        this.grid[row][col] = [];
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

  getCellSize(): number {
    return this.cellSize;
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
}
