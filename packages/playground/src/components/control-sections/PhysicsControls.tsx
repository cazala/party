import { useState, useEffect } from "react";
import {
  Physics,
  degToRad,
  radToDeg,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
} from "@party/core";

interface PhysicsControlsProps {
  physics: Physics | null;
}

export function PhysicsControls({ physics }: PhysicsControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityAngle, setGravityAngle] = useState(
    radToDeg(DEFAULT_GRAVITY_ANGLE)
  ); // Convert radians to degrees for UI
  const [inertia, setInertia] = useState(DEFAULT_INERTIA);
  const [friction, setFriction] = useState(DEFAULT_FRICTION);

  useEffect(() => {
    if (physics) {
      setGravityStrength(physics.strength);
      const angle =
        Math.atan2(physics.direction.y, physics.direction.x) * (180 / Math.PI);
      setGravityAngle((angle + 360) % 360);
      setInertia(physics.inertia);
      setFriction(physics.friction);
    }
  }, [physics]);

  const handleGravityStrengthChange = (value: number) => {
    setGravityStrength(value);
    if (physics) {
      physics.setStrength(value);
    }
  };

  const handleGravityAngleChange = (angle: number) => {
    setGravityAngle(angle); // Store degrees in UI state
    if (physics) {
      physics.setDirectionFromAngle(degToRad(angle)); // Convert to radians for core library
    }
  };

  const handleInertiaChange = (value: number) => {
    setInertia(value);
    if (physics) {
      physics.setInertia(value);
    }
  };

  const handleFrictionChange = (value: number) => {
    setFriction(value);
    if (physics) {
      physics.setFriction(value);
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
          Direction: {gravityAngle.toFixed(0)}°
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={gravityAngle}
            onChange={(e) => handleGravityAngleChange(parseInt(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Inertia: {inertia.toFixed(3)}
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
          Friction: {friction.toFixed(3)}
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
    </div>
  );
}
