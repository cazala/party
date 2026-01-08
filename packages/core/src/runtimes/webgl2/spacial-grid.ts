/**
 * SpacialGrid for WebGL2
 *
 * Maintains a world-aligned uniform grid based on the current view snapshot.
 * Allocates GPU textures for grid data and provides resize/configuration.
 * Similar to WebGPU version but uses textures instead of storage buffers.
 */
import type { GL2Resources } from "./gl2-resources";
import type { ViewSnapshot } from "../../view";

export class SpacialGrid {
  private cols: number = 0;
  private rows: number = 0;
  private cellSize: number;
  private maxPerCell: number = 256;
  private lastView: ViewSnapshot | null = null;

  constructor(cellSize: number = 16) {
    this.cellSize = cellSize;
  }

  configure(view: ViewSnapshot, resources: GL2Resources): void {
    const { cols, rows } = this.computeGrid(view);
    this.cols = cols;
    this.rows = rows;

    // Create grid textures for neighbor queries
    resources.createGridTextures(cols * rows, this.maxPerCell);

    this.lastView = { ...view };
  }

  resizeIfNeeded(view: ViewSnapshot, resources: GL2Resources): void {
    if (
      this.lastView &&
      this.lastView.width === view.width &&
      this.lastView.height === view.height &&
      this.lastView.cx === view.cx &&
      this.lastView.cy === view.cy &&
      this.lastView.zoom === view.zoom
    ) {
      return;
    }
    this.configure(view, resources);
  }

  getCellCount(): number {
    return this.cols * this.rows;
  }

  getCellSize(): number {
    return this.cellSize;
  }

  setCellSize(cellSize: number): void {
    if (cellSize <= 0) {
      throw new Error("Cell size must be greater than 0");
    }
    this.cellSize = cellSize;
    // Clear last view to force reconfiguration on next resizeIfNeeded/configure call
    this.lastView = null;
  }

  getCols(): number {
    return this.cols;
  }

  getRows(): number {
    return this.rows;
  }

  getMaxPerCell(): number {
    return this.maxPerCell;
  }

  getGridBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    if (!this.lastView) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    const view = this.lastView;
    const zoom = Math.max(view.zoom, 0.0001);
    const halfW = view.width / (2 * zoom);
    const halfH = view.height / (2 * zoom);
    return {
      minX: view.cx - halfW,
      maxX: view.cx + halfW,
      minY: view.cy - halfH,
      maxY: view.cy + halfH,
    };
  }

  private computeGrid(view: ViewSnapshot): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    cols: number;
    rows: number;
  } {
    const zoom = Math.max(view.zoom, 0.0001);
    const halfW = view.width / (2 * zoom);
    const halfH = view.height / (2 * zoom);
    const minX = view.cx - halfW;
    const maxX = view.cx + halfW;
    const minY = view.cy - halfH;
    const maxY = view.cy + halfH;
    const cols = Math.max(1, Math.ceil((maxX - minX) / this.cellSize));
    const rows = Math.max(1, Math.ceil((maxY - minY) / this.cellSize));
    return { minX, minY, maxX, maxY, cols, rows };
  }
}
