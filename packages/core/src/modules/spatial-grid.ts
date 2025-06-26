import { Particle } from "./particle";
import { Vector2D } from "./vector";

export interface SpatialGridOptions {
  width: number;
  height: number;
  cellSize: number;
}

export class SpatialGrid {
  private width: number;
  private height: number;
  private cellSize: number;
  private cols: number;
  private rows: number;
  private grid: Particle[][][];

  constructor(options: SpatialGridOptions) {
    this.width = options.width;
    this.height = options.height;
    this.cellSize = options.cellSize;
    this.cols = Math.ceil(this.width / this.cellSize);
    this.rows = Math.ceil(this.height / this.cellSize);
    this.grid = [];
    this.initializeGrid();
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
      for (let col = 0; col < this.cols; col++) {
        this.grid[row][col] = [];
      }
    }
  }

  insert(particle: Particle): void {
    const col = Math.floor(particle.position.x / this.cellSize);
    const row = Math.floor(particle.position.y / this.cellSize);

    // Clamp to grid bounds
    const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.rows - 1));

    this.grid[clampedRow][clampedCol].push(particle);
  }

  getParticles(point: Vector2D, radius: number): Particle[] {
    const neighbors: Particle[] = [];
    const centerCol = Math.floor(point.x / this.cellSize);
    const centerRow = Math.floor(point.y / this.cellSize);

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

  getSize(): { width: number; height: number } {
    return {
      width: this.width,
      height: this.height,
    };
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(this.width / this.cellSize);
    this.rows = Math.ceil(this.height / this.cellSize);
    this.initializeGrid();
  }

  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    this.cols = Math.ceil(this.width / this.cellSize);
    this.rows = Math.ceil(this.height / this.cellSize);
    this.initializeGrid();
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
