import { useState, useEffect } from "react";
import { Boundary, BoundaryMode } from "@cazala/party";
import {
  DEFAULT_BOUNDARY_BOUNCE,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_BOUNDARY_FRICTION,
} from "@cazala/party/modules/forces/boundary";

interface BoundaryControlsProps {
  boundary: Boundary | null;
}

export function BoundaryControls({ boundary }: BoundaryControlsProps) {
  const [bounce, setBounce] = useState(DEFAULT_BOUNDARY_BOUNCE);
  const [repelDistance, setRepelDistance] = useState(
    DEFAULT_BOUNDARY_REPEL_DISTANCE
  );
  const [repelStrength, setRepelStrength] = useState(
    DEFAULT_BOUNDARY_REPEL_STRENGTH
  );
  const [mode, setMode] = useState<BoundaryMode>(DEFAULT_BOUNDARY_MODE);
  const [friction, setFriction] = useState(DEFAULT_BOUNDARY_FRICTION);

  useEffect(() => {
    if (boundary) {
      setBounce(boundary.bounce);
      setRepelDistance(boundary.repelDistance);
      setRepelStrength(boundary.repelStrength);
      setMode(boundary.mode);
      setFriction(boundary.friction);
    }
  }, [boundary]);

  const handleBounceChange = (value: number) => {
    setBounce(value);
    if (boundary) {
      boundary.bounce = value;
    }
  };

  const handleRepelDistanceChange = (value: number) => {
    setRepelDistance(value);
    if (boundary) {
      boundary.setRepelDistance(value);
    }
  };

  const handleRepelStrengthChange = (value: number) => {
    setRepelStrength(value);
    if (boundary) {
      boundary.setRepelStrength(value);
    }
  };

  const handleModeChange = (newMode: BoundaryMode) => {
    setMode(newMode);
    if (boundary) {
      boundary.setMode(newMode);
    }
  };

  const handleFrictionChange = (value: number) => {
    setFriction(value);
    if (boundary) {
      boundary.setFriction(value);
    }
  };


  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) =>
              handleModeChange(e.target.value as BoundaryMode)
            }
            className="form-select"
          >
            <option value="bounce">Bounce</option>
            <option value="kill">Kill</option>
            <option value="warp">Warp</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>
      
      <div className="control-group">
        <div
          style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
        >
          {mode === "bounce" && "Particles bounce off boundaries"}
          {mode === "kill" && "Particles are removed at boundaries"}
          {mode === "warp" && "Particles teleport to opposite side"}
          {mode === "none" && "Particles can move freely outside viewport"}
        </div>
      </div>

      {mode === "bounce" && (
        <>
          <div className="control-group">
            <label>
              Bounce: {bounce.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bounce}
                onChange={(e) =>
                  handleBounceChange(parseFloat(e.target.value))
                }
                className="slider"
              />
            </label>
          </div>
          
          <div className="control-group">
            <label>
              Friction: {friction.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={friction}
                onChange={(e) =>
                  handleFrictionChange(parseFloat(e.target.value))
                }
                className="slider"
              />
            </label>
          </div>
        </>
      )}

      <div className="control-group">
        <label>
          Repel Distance: {repelDistance.toFixed(0)}px
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={repelDistance}
            onChange={(e) =>
              handleRepelDistanceChange(parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Repel Strength: {repelStrength.toFixed(0)}
          <input
            type="range"
            min="0"
            max="5000"
            step="5"
            value={repelStrength}
            onChange={(e) =>
              handleRepelStrengthChange(parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
