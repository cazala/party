import type { ViewSnapshot } from "../view";

export type GridGeometryOptions = {
  paddingRatio?: number;
};

export class GridGeometry {
  private cellSize: number;
  private paddingRatio: number;
  private minX: number = 0;
  private minY: number = 0;
  private maxX: number = 0;
  private maxY: number = 0;
  private cols: number = 1;
  private rows: number = 1;

  constructor(cellSize: number, options: GridGeometryOptions = {}) {
    this.cellSize = Math.max(0.0001, cellSize);
    this.paddingRatio = options.paddingRatio ?? 0;
  }

  setCellSize(cellSize: number): void {
    this.cellSize = Math.max(0.0001, cellSize);
  }

  getCellSize(): number {
    return this.cellSize;
  }

  updateFromView(view: ViewSnapshot, options: GridGeometryOptions = {}): void {
    const paddingRatio =
      options.paddingRatio !== undefined
        ? options.paddingRatio
        : this.paddingRatio;
    const zoom = Math.max(view.zoom, 0.0001);
    const halfW = view.width / (2 * zoom);
    const halfH = view.height / (2 * zoom);
    const padding = (Math.max(view.width, view.height) / zoom) * paddingRatio;

    this.minX = view.cx - halfW - padding;
    this.maxX = view.cx + halfW + padding;
    this.minY = view.cy - halfH - padding;
    this.maxY = view.cy + halfH + padding;

    this.cols = Math.max(1, Math.ceil((this.maxX - this.minX) / this.cellSize));
    this.rows = Math.max(1, Math.ceil((this.maxY - this.minY) / this.cellSize));
  }

  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    return {
      minX: this.minX,
      minY: this.minY,
      maxX: this.maxX,
      maxY: this.maxY,
    };
  }

  getDimensions(): { cols: number; rows: number; cellSize: number } {
    return {
      cols: this.cols,
      rows: this.rows,
      cellSize: this.cellSize,
    };
  }

  worldToCell(
    x: number,
    y: number,
    clamp: boolean = true
  ): { col: number; row: number } {
    const col = Math.floor((x - this.minX) / this.cellSize);
    const row = Math.floor((y - this.minY) / this.cellSize);
    if (!clamp) return { col, row };
    const clampedCol = Math.max(0, Math.min(col, this.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, this.rows - 1));
    return { col: clampedCol, row: clampedRow };
  }

  cellToWorld(
    col: number,
    row: number,
    center: boolean = true
  ): { x: number; y: number } {
    const x = this.minX + col * this.cellSize + (center ? this.cellSize * 0.5 : 0);
    const y = this.minY + row * this.cellSize + (center ? this.cellSize * 0.5 : 0);
    return { x, y };
  }
}
