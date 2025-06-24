import { useState, useEffect } from "react";
import {
  Gravity,
  Flock,
  Bounds,
  Collisions,
  Canvas2DRenderer,
  SpatialGrid,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
} from "../../../core/src";
import {
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
} from "../../../core/src/modules/forces/gravity.js";
import {
  DEFAULT_FLOCK_MAX_SPEED,
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
} from "../../../core/src/modules/forces/flock.js";
import {
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
} from "../../../core/src/modules/forces/bounds.js";
import { DEFAULT_COLLISIONS_ENABLED } from "../../../core/src/modules/forces/collisions.js";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
} from "../../../core/src/modules/render.js";

const DEFAULT_SPAWN_NUM_PARTICLES = 100;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_DRAG_THRESHOLD = 5;

interface ControlsProps {
  gravity: Gravity | null;
  flock: Flock | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random",
    spacing: number,
    particleSize: number,
    dragThreshold: number
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
  };
}

export function Controls({
  gravity,
  flock,
  bounds,
  collisions,
  renderer,
  spatialGrid,
  onSpawnParticles,
  onGetSpawnConfig,
}: ControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityAngle, setGravityAngle] = useState(DEFAULT_GRAVITY_ANGLE);
  const [cohesionWeight, setCohesionWeight] = useState(
    DEFAULT_FLOCK_COHESION_WEIGHT
  );
  const [alignmentWeight, setAlignmentWeight] = useState(
    DEFAULT_FLOCK_ALIGNMENT_WEIGHT
  );
  const [separationWeight, setSeparationWeight] = useState(
    DEFAULT_FLOCK_SEPARATION_WEIGHT
  );
  const [maxSpeed, setMaxSpeed] = useState(DEFAULT_FLOCK_MAX_SPEED);
  const [separationRange, setSeparationRange] = useState(
    DEFAULT_FLOCK_SEPARATION_RANGE
  );
  const [neighborRadius, setNeighborRadius] = useState(
    DEFAULT_FLOCK_NEIGHBOR_RADIUS
  );
  const [bounce, setBounce] = useState(DEFAULT_BOUNDS_BOUNCE);
  const [boundsFriction, setBoundsFriction] = useState(DEFAULT_BOUNDS_FRICTION);
  const [collisionsEnabled, setCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLED
  );

  // Spawn state
  const [numParticles, setNumParticles] = useState(DEFAULT_SPAWN_NUM_PARTICLES);
  const [spawnShape, setSpawnShape] = useState<"grid" | "random">(
    DEFAULT_SPAWN_SHAPE
  );
  const [spacing, setSpacing] = useState(DEFAULT_SPAWN_SPACING);
  const [particleSize, setParticleSize] = useState(DEFAULT_SPAWN_PARTICLE_SIZE);
  const [dragThreshold, setDragThreshold] = useState(DEFAULT_DRAG_THRESHOLD);

  // Performance state
  const [cellSize, setCellSize] = useState(DEFAULT_SPATIAL_GRID_CELL_SIZE);
  const [showSpatialGrid, setShowSpatialGrid] = useState(false);

  // Render state
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);

  // Initialize state from current values
  useEffect(() => {
    if (gravity) {
      setGravityStrength(gravity.strength);
      // Calculate angle from direction vector
      const angle =
        Math.atan2(gravity.direction.y, gravity.direction.x) * (180 / Math.PI);
      setGravityAngle((angle + 360) % 360);
    }
    if (flock) {
      setCohesionWeight(flock.cohesionWeight);
      setAlignmentWeight(flock.alignmentWeight);
      setSeparationWeight(flock.separationWeight);
      setMaxSpeed(flock.maxSpeed);
      setSeparationRange(flock.separationRange);
      setNeighborRadius(flock.neighborRadius);
    }
    if (bounds) {
      setBounce(bounds.bounce);
      setBoundsFriction(bounds.friction);
    }
    if (collisions) {
      setCollisionsEnabled(collisions.enabled);
    }
    if (renderer) {
      setColorMode(renderer.colorMode);
      setCustomColor(renderer.customColor);
      setShowSpatialGrid(renderer.showSpatialGrid);
    }
    if (spatialGrid) {
      const { cellSize: gridCellSize } = spatialGrid.getGridDimensions();
      setCellSize(gridCellSize);
    }
  }, [gravity, flock, bounds, collisions, renderer, spatialGrid]);

  // Initialize spawn on component mount
  useEffect(() => {
    if (onSpawnParticles) {
      onSpawnParticles(
        numParticles,
        spawnShape,
        spacing,
        particleSize,
        dragThreshold
      );
    }
  }, [
    onSpawnParticles,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
  ]);

  // Expose spawn config getter
  useEffect(() => {
    if (onGetSpawnConfig) {
      const getConfig = () => ({
        numParticles,
        shape: spawnShape,
        spacing,
        particleSize,
        dragThreshold,
      });
      (window as any).__getSpawnConfig = getConfig;
    }
  }, [
    onGetSpawnConfig,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
  ]);

  const handleGravityStrengthChange = (value: number) => {
    setGravityStrength(value);
    if (gravity) {
      gravity.setStrength(value);
    }
  };

  const handleGravityAngleChange = (angle: number) => {
    setGravityAngle(angle);
    if (gravity) {
      gravity.setDirectionFromAngle(angle * (Math.PI / 180)); // Convert to radians
    }
  };

  const handleBounceChange = (value: number) => {
    setBounce(value);
    if (bounds) {
      bounds.bounce = value;
    }
    handleBoundsFrictionChange(DEFAULT_BOUNDS_FRICTION);
  };

  const handleBoundsFrictionChange = (frictionValue: number) => {
    setBoundsFriction(frictionValue);
    if (bounds) {
      bounds.setFriction(frictionValue);
    }
  };

  const handleCollisionsEnabledChange = (enabled: boolean) => {
    setCollisionsEnabled(enabled);
    if (collisions) {
      collisions.setEnabled(enabled);
    }
  };

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as "particle" | "custom" | "velocity");
    if (renderer) {
      renderer.setColorMode(mode as "particle" | "custom" | "velocity");
      if (mode === "velocity" && flock) {
        renderer.setMaxSpeed(flock.maxSpeed);
      }
    }
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (renderer) {
      renderer.setCustomColor(color);
    }
  };

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

  const handleFlockingChange = (property: keyof Flock, value: number) => {
    if (!flock) return;

    switch (property) {
      case "cohesionWeight":
        setCohesionWeight(value);
        flock.cohesionWeight = value;
        break;
      case "alignmentWeight":
        setAlignmentWeight(value);
        flock.alignmentWeight = value;
        break;
      case "separationWeight":
        setSeparationWeight(value);
        flock.separationWeight = value;
        break;
      case "maxSpeed":
        setMaxSpeed(value);
        flock.maxSpeed = value;
        if (renderer && renderer.colorMode === "velocity") {
          renderer.setMaxSpeed(value);
        }
        break;
      case "separationRange":
        setSeparationRange(value);
        flock.separationRange = value;
        break;
      case "neighborRadius":
        setNeighborRadius(value);
        flock.neighborRadius = value;
        break;
    }
  };

  // Spawn handlers
  const handleSpawnChange = (
    newNumParticles?: number,
    newShape?: "grid" | "random",
    newSpacing?: number,
    newParticleSize?: number,
    newDragThreshold?: number
  ) => {
    const particles = newNumParticles ?? numParticles;
    const shape = newShape ?? spawnShape;
    const size = newParticleSize ?? particleSize;
    const threshold = newDragThreshold ?? dragThreshold;
    // Ensure spacing is at least particle diameter to prevent touching
    const space = Math.max(newSpacing ?? spacing, size * 2);

    if (newNumParticles !== undefined) setNumParticles(newNumParticles);
    if (newShape !== undefined) setSpawnShape(newShape);
    if (newSpacing !== undefined) setSpacing(space); // Update with corrected spacing
    if (newParticleSize !== undefined) setParticleSize(newParticleSize);
    if (newDragThreshold !== undefined) setDragThreshold(newDragThreshold);

    if (onSpawnParticles) {
      onSpawnParticles(particles, shape, space, size, threshold);
    }
  };

  const resetToDefaults = () => {
    handleGravityStrengthChange(DEFAULT_GRAVITY_STRENGTH);
    handleGravityAngleChange(DEFAULT_GRAVITY_ANGLE);
    handleBounceChange(DEFAULT_BOUNDS_BOUNCE);
    handleCollisionsEnabledChange(DEFAULT_COLLISIONS_ENABLED);
    handleFlockingChange("cohesionWeight", DEFAULT_FLOCK_COHESION_WEIGHT);
    handleFlockingChange("alignmentWeight", DEFAULT_FLOCK_ALIGNMENT_WEIGHT);
    handleFlockingChange("separationWeight", DEFAULT_FLOCK_SEPARATION_WEIGHT);
    handleFlockingChange("maxSpeed", DEFAULT_FLOCK_MAX_SPEED);
    handleFlockingChange("separationRange", DEFAULT_FLOCK_SEPARATION_RANGE);
    handleFlockingChange("neighborRadius", DEFAULT_FLOCK_NEIGHBOR_RADIUS);
    handleColorModeChange(DEFAULT_RENDER_COLOR_MODE);
    handleCustomColorChange(DEFAULT_RENDER_CUSTOM_COLOR);

    // Reset spawn settings
    setNumParticles(DEFAULT_SPAWN_NUM_PARTICLES);
    setSpawnShape(DEFAULT_SPAWN_SHAPE);
    setSpacing(DEFAULT_SPAWN_SPACING);
    setParticleSize(DEFAULT_SPAWN_PARTICLE_SIZE);
    setDragThreshold(DEFAULT_DRAG_THRESHOLD);
    if (onSpawnParticles) {
      onSpawnParticles(
        DEFAULT_SPAWN_NUM_PARTICLES,
        DEFAULT_SPAWN_SHAPE,
        DEFAULT_SPAWN_SPACING,
        DEFAULT_SPAWN_PARTICLE_SIZE,
        DEFAULT_DRAG_THRESHOLD
      );
    }
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Controls</h3>
        <button onClick={resetToDefaults} className="reset-button">
          Reset
        </button>
      </div>

      {/* Physics Controls */}
      <div className="control-section">
        <h4>Physics</h4>

        <div className="control-group">
          <label>
            Gravity: {gravityStrength.toFixed(3)}
            <input
              type="range"
              min="0"
              max="1000"
              step="0.01"
              value={gravityStrength}
              onChange={(e) =>
                handleGravityStrengthChange(parseFloat(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Direction: {gravityAngle.toFixed(0)}°
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={gravityAngle}
              onChange={(e) =>
                handleGravityAngleChange(parseInt(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Bounce: {bounce.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={bounce}
              onChange={(e) => handleBounceChange(parseFloat(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Friction: {boundsFriction.toFixed(2)}
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={boundsFriction}
              onChange={(e) =>
                handleBoundsFrictionChange(parseFloat(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={collisionsEnabled}
              onChange={(e) => handleCollisionsEnabledChange(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Enable Collisions
          </label>
        </div>
      </div>

      {/* Spawn Controls */}
      <div className="control-section">
        <h4>Spawn</h4>

        <div className="control-group">
          <label>
            Number of Particles: {numParticles}
            <input
              type="range"
              min="1"
              max="1500"
              step="1"
              value={numParticles}
              onChange={(e) => handleSpawnChange(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Particle Size: {particleSize}
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={particleSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value);
                // Ensure spacing is at least particle diameter when size changes
                const newSpacing = Math.max(spacing, newSize * 2);
                handleSpawnChange(
                  undefined,
                  undefined,
                  newSpacing !== spacing ? newSpacing : undefined,
                  newSize
                );
              }}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Shape
            <select
              value={spawnShape}
              onChange={(e) =>
                handleSpawnChange(
                  undefined,
                  e.target.value as "grid" | "random"
                )
              }
              className="form-select"
            >
              <option value="grid">Grid</option>
              <option value="random">Random</option>
            </select>
          </label>
        </div>

        {spawnShape === "grid" && (
          <div className="control-group">
            <label>
              Spacing: {spacing}
              <input
                type="range"
                min={particleSize * 2 + 2} // Dynamic minimum based on particle size
                max="150"
                step="5"
                value={spacing}
                onChange={(e) =>
                  handleSpawnChange(
                    undefined,
                    undefined,
                    parseInt(e.target.value)
                  )
                }
                className="slider"
              />
            </label>
          </div>
        )}
      </div>

      {/* Behavior Controls */}
      <div className="control-section">
        <h4>Behavior</h4>

        <div className="control-group">
          <label>
            Cohesion: {cohesionWeight.toFixed(1)}
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={cohesionWeight}
              onChange={(e) =>
                handleFlockingChange(
                  "cohesionWeight",
                  parseFloat(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Alignment: {alignmentWeight.toFixed(1)}
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={alignmentWeight}
              onChange={(e) =>
                handleFlockingChange(
                  "alignmentWeight",
                  parseFloat(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Separation: {separationWeight.toFixed(1)}
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={separationWeight}
              onChange={(e) =>
                handleFlockingChange(
                  "separationWeight",
                  parseFloat(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Separation Range: {separationRange.toFixed(0)}
            <input
              type="range"
              min="0"
              max="150"
              step="1"
              value={separationRange}
              onChange={(e) =>
                handleFlockingChange(
                  "separationRange",
                  parseFloat(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Neighbor Radius: {neighborRadius.toFixed(0)}
            <input
              type="range"
              min="0"
              max="500"
              step="1"
              value={neighborRadius}
              onChange={(e) =>
                handleFlockingChange(
                  "neighborRadius",
                  parseFloat(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>
      </div>

      {/* Render Controls */}
      <div className="control-section">
        <h4>Render</h4>

        <div className="control-group">
          <label>
            Color Mode
            <select
              value={colorMode}
              onChange={(e) => handleColorModeChange(e.target.value)}
              className="form-select"
            >
              <option value="particle">Use Particle Color</option>
              <option value="custom">Custom Color</option>
              <option value="velocity">Velocity</option>
            </select>
          </label>
        </div>

        {colorMode === "custom" && (
          <div className="control-group">
            <label>
              Custom Color
              <input
                type="color"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="color-picker"
              />
            </label>
          </div>
        )}
      </div>

      {/* Performance Controls */}
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
    </div>
  );
}
