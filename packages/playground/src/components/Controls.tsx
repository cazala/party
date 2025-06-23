import { useState, useEffect } from "react";
import { Gravity, Flock, Bounds, Canvas2DRenderer } from "../../../core/src";
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
} from "../../../core/src/modules/forces/bounds.js";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
} from "../../../core/src/modules/render.js";

interface ControlsProps {
  gravity: Gravity | null;
  flock: Flock | null;
  bounds: Bounds | null;
  renderer: Canvas2DRenderer | null;
  onSpawnParticles?: (numParticles: number, shape: 'grid' | 'random', spacing: number) => void;
  onGetSpawnConfig?: () => { numParticles: number; shape: 'grid' | 'random'; spacing: number };
}

export function Controls({ gravity, flock, bounds, renderer, onSpawnParticles, onGetSpawnConfig }: ControlsProps) {
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
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);
  
  // Spawn state
  const [numParticles, setNumParticles] = useState(100);
  const [spawnShape, setSpawnShape] = useState<'grid' | 'random'>('grid');
  const [spacing, setSpacing] = useState(50);

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
    }
    if (renderer) {
      setColorMode(renderer.colorMode);
      setCustomColor(renderer.customColor);
    }
  }, [gravity, flock, bounds, renderer]);

  // Initialize spawn on component mount
  useEffect(() => {
    if (onSpawnParticles) {
      onSpawnParticles(numParticles, spawnShape, spacing);
    }
  }, [onSpawnParticles, numParticles, spawnShape, spacing]);

  // Expose spawn config getter
  useEffect(() => {
    if (onGetSpawnConfig) {
      const getConfig = () => ({ numParticles, shape: spawnShape, spacing });
      (window as any).__getSpawnConfig = getConfig;
    }
  }, [onGetSpawnConfig, numParticles, spawnShape, spacing]);

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
  };

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as 'particle' | 'custom' | 'velocity');
    if (renderer) {
      renderer.setColorMode(mode as 'particle' | 'custom' | 'velocity');
      if (mode === 'velocity' && flock) {
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

  const handleGravityPreset = (
    direction: "up" | "down" | "left" | "right" | "zero"
  ) => {
    const presets = {
      up: { angle: 270, strength: gravityStrength },
      down: { angle: 90, strength: gravityStrength },
      left: { angle: 180, strength: gravityStrength },
      right: { angle: 0, strength: gravityStrength },
      zero: { angle: gravityAngle, strength: 0 },
    };

    const preset = presets[direction];
    setGravityAngle(preset.angle);
    setGravityStrength(preset.strength);

    if (gravity) {
      gravity.setStrength(preset.strength);
      gravity.setDirectionFromAngle(preset.angle * (Math.PI / 180));
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
        if (renderer && renderer.colorMode === 'velocity') {
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
  const handleSpawnChange = (newNumParticles?: number, newShape?: 'grid' | 'random', newSpacing?: number) => {
    const particles = newNumParticles ?? numParticles;
    const shape = newShape ?? spawnShape;
    const space = newSpacing ?? spacing;
    
    if (newNumParticles !== undefined) setNumParticles(newNumParticles);
    if (newShape !== undefined) setSpawnShape(newShape);
    if (newSpacing !== undefined) setSpacing(newSpacing);
    
    if (onSpawnParticles) {
      onSpawnParticles(particles, shape, space);
    }
  };

  const resetToDefaults = () => {
    handleGravityStrengthChange(DEFAULT_GRAVITY_STRENGTH);
    handleGravityAngleChange(DEFAULT_GRAVITY_ANGLE);
    handleBounceChange(DEFAULT_BOUNDS_BOUNCE);
    handleFlockingChange("cohesionWeight", DEFAULT_FLOCK_COHESION_WEIGHT);
    handleFlockingChange("alignmentWeight", DEFAULT_FLOCK_ALIGNMENT_WEIGHT);
    handleFlockingChange("separationWeight", DEFAULT_FLOCK_SEPARATION_WEIGHT);
    handleFlockingChange("maxSpeed", DEFAULT_FLOCK_MAX_SPEED);
    handleFlockingChange("separationRange", DEFAULT_FLOCK_SEPARATION_RANGE);
    handleFlockingChange("neighborRadius", DEFAULT_FLOCK_NEIGHBOR_RADIUS);
    handleColorModeChange(DEFAULT_RENDER_COLOR_MODE);
    handleCustomColorChange(DEFAULT_RENDER_CUSTOM_COLOR);
    
    // Reset spawn settings
    setNumParticles(100);
    setSpawnShape('grid');
    setSpacing(50);
    if (onSpawnParticles) {
      onSpawnParticles(100, 'grid', 50);
    }
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Physics Controls</h3>
        <button onClick={resetToDefaults} className="reset-button">
          Reset
        </button>
      </div>

      {/* Gravity Controls */}
      <div className="control-section">
        <h4>Gravity</h4>

        <div className="control-group">
          <label>
            Strength: {gravityStrength.toFixed(3)}
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

        <div className="preset-buttons">
          <button onClick={() => handleGravityPreset("up")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h6v8h4v-8h6z" />
            </svg>
          </button>
          <button onClick={() => handleGravityPreset("down")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 20l8-8h-6V4h-4v8H4z" />
            </svg>
          </button>
          <button onClick={() => handleGravityPreset("left")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 12l8-8v6h8v4h-8v6z" />
            </svg>
          </button>
          <button onClick={() => handleGravityPreset("right")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 12l-8 8v-6H4v-4h8V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Flocking Controls */}
      <div className="control-section">
        <h4>Flocking Behavior</h4>

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
            Max Speed: {maxSpeed.toFixed(1)}
            <input
              type="range"
              min="0"
              max="3000"
              step="1"
              value={maxSpeed}
              onChange={(e) =>
                handleFlockingChange("maxSpeed", parseFloat(e.target.value))
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
              min="10"
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
              min="50"
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

        {colorMode === 'custom' && (
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

      {/* Spawn Controls */}
      <div className="control-section">
        <h4>Spawn</h4>

        <div className="control-group">
          <label>
            Number of Particles: {numParticles}
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={numParticles}
              onChange={(e) => handleSpawnChange(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Shape
            <select 
              value={spawnShape} 
              onChange={(e) => handleSpawnChange(undefined, e.target.value as 'grid' | 'random')}
              className="form-select"
            >
              <option value="grid">Grid</option>
              <option value="random">Random</option>
            </select>
          </label>
        </div>

        {spawnShape === 'grid' && (
          <div className="control-group">
            <label>
              Spacing: {spacing}
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={spacing}
                onChange={(e) => handleSpawnChange(undefined, undefined, parseInt(e.target.value))}
                className="slider"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
