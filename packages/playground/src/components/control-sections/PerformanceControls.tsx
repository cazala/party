import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  SpatialGrid,
  Canvas2DRenderer,
  System,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
} from "@cazala/party";

interface PerformanceControlsProps {
  system: System | null;
  spatialGrid: SpatialGrid | null;
  renderer: Canvas2DRenderer | null;
}

export interface PerformanceControlsRef {
  getState: () => {
    cellSize: number;
    showSpatialGrid: boolean;
  };
  setState: (state: Partial<{
    cellSize: number;
    showSpatialGrid: boolean;
  }>) => void;
}

export const PerformanceControls = forwardRef<PerformanceControlsRef, PerformanceControlsProps>(({
  system,
  spatialGrid,
  renderer,
}, ref) => {
  const [cellSize, setCellSize] = useState(DEFAULT_SPATIAL_GRID_CELL_SIZE);
  const [showSpatialGrid, setShowSpatialGrid] = useState(false);
  const [fps, setFps] = useState(0);
  const [particleCount, setParticleCount] = useState(0);

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getState: () => ({
      cellSize,
      showSpatialGrid,
    }),
    setState: (state) => {
      if (state.cellSize !== undefined) {
        setCellSize(state.cellSize);
        if (spatialGrid) {
          spatialGrid.setCellSize(state.cellSize);
        }
      }
      if (state.showSpatialGrid !== undefined) {
        setShowSpatialGrid(state.showSpatialGrid);
        if (renderer) {
          renderer.setShowSpatialGrid(state.showSpatialGrid);
        }
      }
    },
  }), [cellSize, showSpatialGrid, spatialGrid, renderer]);

  useEffect(() => {
    if (renderer) {
      setShowSpatialGrid(renderer.showSpatialGrid);
    }
    if (spatialGrid) {
      const { cellSize: gridCellSize } = spatialGrid.getGridDimensions();
      setCellSize(gridCellSize);
    }
  }, [renderer, spatialGrid]);

  // Update FPS and particle count periodically
  useEffect(() => {
    if (!system) return;

    const updatePerformanceMetrics = () => {
      setFps(system.getFPS());
      setParticleCount(system.getParticleCount());
    };

    // Update immediately
    updatePerformanceMetrics();

    // Update every 100ms for smooth display
    const interval = setInterval(updatePerformanceMetrics, 100);

    return () => clearInterval(interval);
  }, [system]);

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
      {/* Performance Metrics - Top Priority */}
      <div className="control-group">
        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          Particles: {particleCount}
        </div>
      </div>

      <div className="control-group">
        <div
          style={{
            fontSize: "12px",
            color: fps < 30 ? "#ff9f43" : "var(--color-text-secondary)",
          }}
        >
          FPS: {fps.toFixed(1)}
        </div>
      </div>

      {/* Spatial Grid Controls */}
      <div className="control-group">
        <label>
          Spatial Grid Cell Size: {cellSize}px
          <input
            type="range"
            min="20"
            max="1000"
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
});
