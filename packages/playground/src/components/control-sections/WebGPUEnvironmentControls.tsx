import { useEffect, useState } from "react";

interface WebGPUEnvironmentLike {
  setStrength: (value: number) => void;
  setDirection?: (x: number, y: number) => void;
  setInertia?: (value: number) => void;
  setFriction?: (value: number) => void;
  setDamping?: (value: number) => void;
  setEnabled?: (value: boolean) => void;
  setGravityDirection?: (
    dir: "up" | "down" | "left" | "right" | "inwards" | "outwards" | "custom"
  ) => void;
  setGravityAngle?: (radians: number) => void;
}

export function WebGPUEnvironmentControls({
  environment,
  hideEnabled = false,
  enabled = true,
}: {
  environment: WebGPUEnvironmentLike | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [strength, setStrength] = useState(0);
  const [direction, setDirection] = useState<
    "up" | "down" | "left" | "right" | "inwards" | "outwards" | "custom"
  >("down");
  const [angle, setAngle] = useState(90); // degrees, for custom only
  const [inertia, setInertia] = useState(0);
  const [friction, setFriction] = useState(0);
  const [damping, setDamping] = useState(0);
  const [internalEnabled, setInternalEnabled] = useState(true);

  useEffect(() => {
    // no-op: could hydrate from module if it exposed getters
  }, [environment]);

  return (
    <div className="control-section">
      {!hideEnabled && (
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={internalEnabled}
              onChange={(e) => {
                setInternalEnabled(e.target.checked);
                environment?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}
      <div className="control-group">
        <label>
          Gravity Strength: {strength}
          <input
            type="range"
            min="0"
            max="3000"
            step="1"
            value={strength}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setStrength(v);
              environment?.setStrength(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Gravity Direction
          <select
            value={direction}
            onChange={(e) => {
              const dir = e.target.value as typeof direction;
              setDirection(dir);
              environment?.setGravityDirection?.(dir);
            }}
            disabled={!enabled}
            className="form-select"
          >
            <option value="down">Down</option>
            <option value="up">Up</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="inwards">Inwards</option>
            <option value="outwards">Outwards</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>
      {direction === "custom" && (
        <div className="control-group">
          <label>
            Gravity Angle: {angle}°
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={angle}
              onChange={(e) => {
                const deg = parseInt(e.target.value);
                setAngle(deg);
                const rad = (deg * Math.PI) / 180;
                environment?.setGravityAngle?.(rad);
              }}
              disabled={!enabled}
              className={`slider ${!enabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}

      <div className="control-group">
        <label>
          Inertia: {inertia.toFixed(2)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.01"
            value={inertia}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setInertia(v);
              environment?.setInertia?.(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Friction: {friction.toFixed(2)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.01"
            value={friction}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setFriction(v);
              environment?.setFriction?.(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Damping: {damping.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={damping}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setDamping(v);
              environment?.setDamping?.(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
