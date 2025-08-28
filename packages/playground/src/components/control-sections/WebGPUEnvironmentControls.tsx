import { useEffect, useState } from "react";

interface WebGPUEnvironmentLike {
  setStrength: (value: number) => void;
  setDirection?: (x: number, y: number) => void;
  setInertia?: (value: number) => void;
  setFriction?: (value: number) => void;
  setDamping?: (value: number) => void;
  setEnabled?: (value: boolean) => void;
}

export function WebGPUEnvironmentControls({
  environment,
}: {
  environment: WebGPUEnvironmentLike | null;
}) {
  const [strength, setStrength] = useState(0);
  const [angle, setAngle] = useState(90); // degrees, default down
  const [inertia, setInertia] = useState(0);
  const [friction, setFriction] = useState(0);
  const [damping, setDamping] = useState(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // no-op: could hydrate from module if it exposed getters
  }, [environment]);

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              environment?.setEnabled?.(e.target.checked);
            }}
          />
          Enabled
        </label>
      </div>
      <div className="control-group">
        <label>
          Gravity: {strength}
          <input
            type="range"
            min="0"
            max="2000"
            step="1"
            value={strength}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setStrength(v);
              environment?.setStrength(v);
            }}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Direction Angle: {angle}°
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
              const x = Math.cos(rad);
              const y = Math.sin(rad);
              environment?.setDirection?.(x, y);
            }}
            className="slider"
          />
        </label>
      </div>

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
            max="10"
            step="0.01"
            value={friction}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setFriction(v);
              environment?.setFriction?.(v);
            }}
            className="slider"
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
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
