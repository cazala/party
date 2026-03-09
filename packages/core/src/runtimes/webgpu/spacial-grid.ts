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
import { GridGeometry } from "../../grid/geometry";

export class SpacialGrid {
  private cols: number = 0;
  private rows: number = 0;
  private cellSize: number;
  private maxPerCell: number = 256;
  private lastView: ViewSnapshot | null = null;
  private geometry: GridGeometry;

  constructor(cellSize: number = 16) {
    this.cellSize = cellSize;
    this.geometry = new GridGeometry(cellSize, { paddingRatio: 0 });
  }

  configure(
    view: ViewSnapshot,
    resources: GPUResources,
    program: Program
  ): void {
    this.geometry.setCellSize(this.cellSize);
    this.geometry.updateFromView(view, { paddingRatio: 0 });
    const bounds = this.geometry.getBounds();
    const dims = this.geometry.getDimensions();
    this.cols = dims.cols;
    this.rows = dims.rows;
    // Recreate storage to match grid dimensions
    resources.createGridStorage(dims.cols * dims.rows, this.maxPerCell);
    // Write grid uniforms
    this.writeUniforms(resources, program, {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      cols: dims.cols,
      rows: dims.rows,
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
    this.geometry.setCellSize(cellSize);
    // Clear last view to force reconfiguration on next resizeIfNeeded/configure call
    this.lastView = null;
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
