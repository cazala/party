import { useState, useEffect } from "react";
import {
  SpatialGrid,
  Canvas2DRenderer,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
} from "@party/core";

interface PerformanceControlsProps {
  spatialGrid: SpatialGrid | null;
  renderer: Canvas2DRenderer | null;
}

export function PerformanceControls({
  spatialGrid,
  renderer,
}: PerformanceControlsProps) {
  const [cellSize, setCellSize] = useState(DEFAULT_SPATIAL_GRID_CELL_SIZE);
  const [showSpatialGrid, setShowSpatialGrid] = useState(false);

  useEffect(() => {
    if (renderer) {
      setShowSpatialGrid(renderer.showSpatialGrid);
    }
    if (spatialGrid) {
      const { cellSize: gridCellSize } = spatialGrid.getGridDimensions();
      setCellSize(gridCellSize);
    }
  }, [renderer, spatialGrid]);

  const handleCellSizeChange = (size: number) => {
    setCellSize(size);
    if (spatialGrid) {
      spatialGrid.setCellSize(size);
    }
  };

  const handleShowSpatialGridChange = (show: boolean) => {
    setShowSpatialGrid(show);
    if (renderer) {
      renderer.setShowSpatialGrid(show);
    }
  };

  return (
    <div className="control-section">
      <h4>Performance</h4>

      <div className="control-group">
        <label>
          Spatial Grid Cell Size: {cellSize}px
          <input
            type="range"
            min="20"
            max="200"
            step="10"
            value={cellSize}
            onChange={(e) => handleCellSizeChange(parseInt(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={showSpatialGrid}
            onChange={(e) => handleShowSpatialGridChange(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          Show Spatial Grid
        </label>
      </div>

      {spatialGrid && (
        <div className="control-group">
          <div
            style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
          >
            Grid: {spatialGrid.getGridDimensions().cols}×
            {spatialGrid.getGridDimensions().rows} cells
          </div>
        </div>
      )}
    </div>
  );
}
