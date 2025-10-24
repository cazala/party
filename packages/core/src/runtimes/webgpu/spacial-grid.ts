/**
 * GridSystem
 *
 * Maintains a world-aligned uniform grid based on the current view snapshot.
 * Allocates GPU storage for per-cell counts/indices and writes grid uniforms
 * into the `grid` system module's uniform buffer. Exposes resizeIfNeeded to
 * keep grid state synchronized with camera/zoom/size changes.
 */
import type { Program } from "./builders/program";
import type { GPUResources } from "./gpu-resources";
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

  configure(
    view: ViewSnapshot,
    resources: GPUResources,
    program: Program
  ): void {
    const { minX, minY, maxX, maxY, cols, rows } = this.computeGrid(view);
    this.cols = cols;
    this.rows = rows;
    // Recreate storage to match grid dimensions
    resources.createGridStorage(cols * rows, this.maxPerCell);
    // Write grid uniforms
    this.writeUniforms(resources, program, {
      minX,
      minY,
      maxX,
      maxY,
      cols,
      rows,
      cellSize: this.cellSize,
      maxPerCell: this.maxPerCell,
    });
    this.lastView = { ...view };
  }

  resizeIfNeeded(
    view: ViewSnapshot,
    resources: GPUResources,
    program: Program
  ): void {
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
    this.configure(view, resources, program);
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

  private writeUniforms(
    resources: GPUResources,
    program: Program,
    grid: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      cols: number;
      rows: number;
      cellSize: number;
      maxPerCell: number;
    }
  ): void {
    const gridIdx = program.layouts.findIndex((l) => l.moduleName === "grid");
    if (gridIdx === -1) return;
    const layout = program.layouts[gridIdx];
    const values = new Float32Array(layout.vec4Count * 4);
    const mapping = layout.mapping as Record<string, { flatIndex: number }>;
    values[mapping.minX.flatIndex] = grid.minX;
    values[mapping.minY.flatIndex] = grid.minY;
    values[mapping.maxX.flatIndex] = grid.maxX;
    values[mapping.maxY.flatIndex] = grid.maxY;
    values[mapping.cols.flatIndex] = grid.cols;
    values[mapping.rows.flatIndex] = grid.rows;
    values[mapping.cellSize.flatIndex] = grid.cellSize;
    values[mapping.maxPerCell.flatIndex] = grid.maxPerCell;
    resources.writeModuleUniform(gridIdx, values);
  }
}
