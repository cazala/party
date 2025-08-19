import { useState, useEffect } from "react";
import {
  Environment,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
  radToDeg,
  degToRad,
  DEFAULT_DAMPING,
} from "@cazala/party";

type GravityDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "in"
  | "out"
  | "custom";

interface EnvironmentControlsProps {
  environment: Environment | null;
}

export function EnvironmentControls({ environment }: EnvironmentControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityDirection, setGravityDirection] = useState<GravityDirection>(
    DEFAULT_GRAVITY_DIRECTION
  );
  const [gravityAngle, setGravityAngle] = useState(
    radToDeg(DEFAULT_GRAVITY_ANGLE)
  ); // Convert radians to degrees for UI
  const [inertia, setInertia] = useState(DEFAULT_INERTIA);
  const [friction, setFriction] = useState(DEFAULT_FRICTION);
  const [damping, setDamping] = useState(DEFAULT_DAMPING);

  useEffect(() => {
    if (environment) {
      setGravityStrength(environment.gravity.strength);
      setGravityDirection(environment.gravity.direction);
      setGravityAngle(
        radToDeg(environment.gravity.angle ?? DEFAULT_GRAVITY_ANGLE)
      );
      setInertia(environment.inertia);
      setFriction(environment.friction);
      setDamping(environment.damping);
    }
  }, [environment]);

  const handleGravityStrengthChange = (value: number) => {
    setGravityStrength(value);
    if (environment) {
      environment.setStrength(value);
    }
  };

  const handleGravityDirectionChange = (direction: GravityDirection) => {
    setGravityDirection(direction);
    if (environment) {
      environment.setDirection(direction);
    }
  };

  const handleGravityAngleChange = (angle: number) => {
    setGravityAngle(angle); // Store degrees in UI state
    if (environment) {
      environment.setGravityAngle(degToRad(angle)); // Convert to radians for core library
    }
  };

  const handleInertiaChange = (value: number) => {
    setInertia(value);
    if (environment) {
      environment.setInertia(value);
    }
  };

  const handleFrictionChange = (value: number) => {
    setFriction(value);
    if (environment) {
      environment.setFriction(value);
    }
  };

  const handleDampingChange = (value: number) => {
    setDamping(value);
    if (environment) {
      environment.setDamping(value);
    }
  };

  const getDirectionLabel = (direction: GravityDirection): string => {
    switch (direction) {
      case "up":
        return "Up ↑";
      case "down":
        return "Down ↓";
      case "left":
        return "Left ←";
      case "right":
        return "Right →";
      case "in":
        return "Inwards";
      case "out":
        return "Outwards";
      case "custom":
        return "Custom";
      default:
        return direction;
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Gravity: {gravityStrength}
          <input
            type="range"
            min="0"
            max="5000"
            step="1"
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
          Direction
          <select
            value={gravityDirection}
            onChange={(e) =>
              handleGravityDirectionChange(e.target.value as GravityDirection)
            }
            className="form-select"
          >
            <option value="up">{getDirectionLabel("up")}</option>
            <option value="down">{getDirectionLabel("down")}</option>
            <option value="left">{getDirectionLabel("left")}</option>
            <option value="right">{getDirectionLabel("right")}</option>
            <option value="in">{getDirectionLabel("in")}</option>
            <option value="out">{getDirectionLabel("out")}</option>
            <option value="custom">{getDirectionLabel("custom")}</option>
          </select>
        </label>
      </div>

      {gravityDirection === "custom" && (
        <div className="control-group">
          <label>
            Angle: {gravityAngle.toFixed(0)}°
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
      )}

      <div className="control-group">
        <label>
          Inertia: {inertia.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={inertia}
            onChange={(e) => handleInertiaChange(parseFloat(e.target.value))}
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
            step="0.001"
            value={friction}
            onChange={(e) => handleFrictionChange(parseFloat(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Damping: {damping.toFixed(3)}
          <input
            type="range"
            min="0.8"
            max="1"
            step="0.001"
            value={damping}
            onChange={(e) => handleDampingChange(parseFloat(e.target.value))}
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
