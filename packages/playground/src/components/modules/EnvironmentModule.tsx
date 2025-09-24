import { useState } from "react";
import {
  DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH,
  DEFAULT_ENVIRONMENT_INERTIA,
  DEFAULT_ENVIRONMENT_FRICTION,
  DEFAULT_ENVIRONMENT_DAMPING,
  Environment,
} from "@cazala/party";

export function EnvironmentModule({
  environment,
  enabled = true,
}: {
  environment: Environment | null;
  enabled?: boolean;
}) {
  const [strength, setStrength] = useState(
    DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH
  );
  const [direction, setDirection] = useState<
    "up" | "down" | "left" | "right" | "inwards" | "outwards" | "custom"
  >("down");
  const [angle, setAngle] = useState(90); // degrees, for custom only
  const [inertia, setInertia] = useState(DEFAULT_ENVIRONMENT_INERTIA);
  const [friction, setFriction] = useState(DEFAULT_ENVIRONMENT_FRICTION);
  const [damping, setDamping] = useState(DEFAULT_ENVIRONMENT_DAMPING);

  return (
    <>
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
              environment?.setGravityStrength(v);
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
    </>
  );
}
