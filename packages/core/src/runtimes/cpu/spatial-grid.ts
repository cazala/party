import { Particle } from "../../particle";
import { Vector } from "../../vector";
import { GridGeometry } from "../../grid/geometry";

export interface SpatialGridOptions {
  width: number;
  height: number;
  cellSize: number;
}

export class SpatialGrid {
  private width: number;
  private height: number;
  private cols!: number;
  private rows!: number;
  private grid!: Particle[][][];
  private geometry: GridGeometry;
  private paddingRatio: number = 0.5;

  // Dynamic bounds that match current camera view
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
    this.geometry = new GridGeometry(options.cellSize, {
      paddingRatio: this.paddingRatio,
    });

    // Initialize with default camera view (canvas coordinates)
    this.updateBounds(0, 0, 1);
  }

  private updateBounds(cameraX: number, cameraY: number, zoom: number): void {
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoom = zoom;

    this.geometry.updateFromView(
      {
        width: this.width,
        height: this.height,
        cx: this.cameraX,
        cy: this.cameraY,
        zoom: this.zoom,
      },
      { paddingRatio: this.paddingRatio }
    );
    const dims = this.geometry.getDimensions();
    this.cols = dims.cols;
    this.rows = dims.rows;

    this.initializeGrid();
  }

  setCamera(cameraX: number, cameraY: number, zoom: number): void {
    // Only update if camera changed significantly to avoid constant grid rebuilding
    const threshold = this.geometry.getCellSize() * 0.5; // Half a cell
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
    const { col, row } = this.geometry.worldToCell(
      particle.position.x,
      particle.position.y,
      true
    );

    // Clamp to grid bounds
    const clampedCol = col;
    const clampedRow = row;

    // Insert particle into grid
    // Safety: ensure row/col arrays exist (defensive against any transient zero-dimension states)
    if (!this.grid[clampedRow]) this.grid[clampedRow] = [];
    if (!this.grid[clampedRow][clampedCol])
      this.grid[clampedRow][clampedCol] = [];
    this.grid[clampedRow][clampedCol].push(particle);

    // Track particle position for incremental updates
    this.particlePositions.set(particle.id, {
      col: clampedCol,
      row: clampedRow,
    });
  }

  getParticles(
    point: Vector,
    radius: number,
    maxNeighbors?: number
  ): Particle[] {
    const neighbors: Particle[] = [];
    // Convert world coordinates to grid coordinates with offset
    const center = this.geometry.worldToCell(point.x, point.y, true);
    const centerCol = center.col;
    const centerRow = center.row;

    // Calculate how many cells to check in each direction
    const cellRadius = Math.ceil(radius / this.geometry.getCellSize());

    for (
      let row = centerRow - cellRadius;
      row <= centerRow + cellRadius;
      row++
    ) {
      if (maxNeighbors !== undefined && neighbors.length >= maxNeighbors) {
        return neighbors;
      }
      for (
        let col = centerCol - cellRadius;
        col <= centerCol + cellRadius;
        col++
      ) {
        if (maxNeighbors !== undefined && neighbors.length >= maxNeighbors) {
          return neighbors;
        }
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          const cellParticles = this.grid[row][col];
          for (const candidate of cellParticles) {
            const distance = point.distance(candidate.position);
            if (distance < radius) {
              neighbors.push(candidate);
              if (
                maxNeighbors !== undefined &&
                neighbors.length >= maxNeighbors
              ) {
                return neighbors;
              }
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
    return this.geometry.getDimensions();
  }

  getGridBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    return this.geometry.getBounds();
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
    return this.geometry.getCellSize();
  }

  setCellSize(cellSize: number): void {
    this.geometry.setCellSize(cellSize);
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
