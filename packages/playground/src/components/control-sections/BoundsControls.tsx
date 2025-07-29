import { useState, useEffect } from "react";
import { Bounds, BoundsMode } from "@cazala/party";
import {
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_REPEL_DISTANCE,
  DEFAULT_BOUNDS_REPEL_STRENGTH,
  DEFAULT_BOUNDS_MODE,
} from "@cazala/party/modules/forces/bounds";

interface BoundsControlsProps {
  bounds: Bounds | null;
}

export function BoundsControls({ bounds }: BoundsControlsProps) {
  const [bounce, setBounce] = useState(DEFAULT_BOUNDS_BOUNCE);
  const [repelDistance, setRepelDistance] = useState(
    DEFAULT_BOUNDS_REPEL_DISTANCE
  );
  const [repelStrength, setRepelStrength] = useState(
    DEFAULT_BOUNDS_REPEL_STRENGTH
  );
  const [mode, setMode] = useState<BoundsMode>(DEFAULT_BOUNDS_MODE);

  useEffect(() => {
    if (bounds) {
      setBounce(bounds.bounce);
      setRepelDistance(bounds.repelDistance);
      setRepelStrength(bounds.repelStrength);
      setMode(bounds.mode);
    }
  }, [bounds]);

  const handleBounceChange = (value: number) => {
    setBounce(value);
    if (bounds) {
      bounds.bounce = value;
    }
  };

  const handleRepelDistanceChange = (value: number) => {
    setRepelDistance(value);
    if (bounds) {
      bounds.setRepelDistance(value);
    }
  };

  const handleRepelStrengthChange = (value: number) => {
    setRepelStrength(value);
    if (bounds) {
      bounds.setRepelStrength(value);
    }
  };

  const handleModeChange = (newMode: BoundsMode) => {
    setMode(newMode);
    if (bounds) {
      bounds.setMode(newMode);
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as BoundsMode)}
            className="form-select"
          >
            <option value="bounce">Bounce</option>
            <option value="kill">Kill</option>
            <option value="warp">Warp</option>
          </select>
        </label>
      </div>
      <div className="control-group">
        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {mode === "bounce" && "Particles bounce off boundaries"}
          {mode === "kill" && "Particles are removed at boundaries"}
          {mode === "warp" && "Particles teleport to opposite side"}
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
                onChange={(e) => handleBounceChange(parseFloat(e.target.value))}
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
