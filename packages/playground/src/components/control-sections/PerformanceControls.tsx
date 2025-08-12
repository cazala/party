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
    enableFrustumCulling: boolean;
    maxPoolSize: number;
  };
  setState: (state: Partial<{
    cellSize: number;
    showSpatialGrid: boolean;
    enableFrustumCulling: boolean;
    maxPoolSize: number;
  }>) => void;
}

export const PerformanceControls = forwardRef<PerformanceControlsRef, PerformanceControlsProps>(({
  system,
  spatialGrid,
  renderer,
}, ref) => {
  const [cellSize, setCellSize] = useState(DEFAULT_SPATIAL_GRID_CELL_SIZE);
  const [showSpatialGrid, setShowSpatialGrid] = useState(false);
  const [enableFrustumCulling, setEnableFrustumCulling] = useState(false);
  const [maxPoolSize, setMaxPoolSize] = useState(1000);
  const [fps, setFps] = useState(0);
  const [particleCount, setParticleCount] = useState(0);

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getState: () => ({
      cellSize,
      showSpatialGrid,
      enableFrustumCulling,
      maxPoolSize,
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
      if (state.enableFrustumCulling !== undefined) {
        setEnableFrustumCulling(state.enableFrustumCulling);
        if (system) {
          system.setFrustumCulling(state.enableFrustumCulling);
        }
      }
      if (state.maxPoolSize !== undefined) {
        setMaxPoolSize(state.maxPoolSize);
        if (system) {
          system.setMaxPoolSize(state.maxPoolSize);
        }
      }
    },
  }), [cellSize, showSpatialGrid, enableFrustumCulling, maxPoolSize, spatialGrid, renderer, system]);

  useEffect(() => {
    if (renderer) {
      setShowSpatialGrid(renderer.showSpatialGrid);
    }
    if (spatialGrid) {
      const { cellSize: gridCellSize } = spatialGrid.getGridDimensions();
      setCellSize(gridCellSize);
      // Initialize max pool size from spatial grid
      setMaxPoolSize(spatialGrid.getMaxPoolSize());
    }
    if (system) {
      setEnableFrustumCulling(system.getFrustumCulling());
    }
  }, [renderer, spatialGrid, system]);

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

  const handleFrustumCullingChange = (enabled: boolean) => {
    setEnableFrustumCulling(enabled);
    if (system) {
      system.setFrustumCulling(enabled);
    }
  };

  const handleMaxPoolSizeChange = (size: number) => {
    setMaxPoolSize(size);
    if (system) {
      system.setMaxPoolSize(size);
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

      {/* Performance Optimization Controls */}
      <div className="control-group">
        <label>
          Max Pool Size: {maxPoolSize}
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            value={maxPoolSize}
            onChange={(e) => handleMaxPoolSizeChange(parseInt(e.target.value))}
            className="slider"
          />
        </label>
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            marginTop: "2px",
            fontStyle: "italic"
          }}
        >
          Memory pooling for grid arrays
        </div>
      </div>

      {/* Pool Statistics */}
      {spatialGrid && (
        <div className="control-group">
          <div
            style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
          >
            Pool hit rate: {spatialGrid.getPoolStats().hitRate}%
          </div>
        </div>
      )}

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enableFrustumCulling}
            onChange={(e) => handleFrustumCullingChange(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          Enable Frustum Culling
        </label>
        <div
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            marginTop: "2px",
            fontStyle: "italic"
          }}
        >
          Skip forces for off-screen particles
        </div>
      </div>
    </div>
  );
});
