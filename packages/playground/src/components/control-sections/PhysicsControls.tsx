import { useState, useEffect } from "react";
import { Physics, Collisions, degToRad, radToDeg, DEFAULT_GRAVITY_STRENGTH, DEFAULT_GRAVITY_ANGLE, DEFAULT_INERTIA, DEFAULT_FRICTION } from "@party/core";
import {
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_COLLISIONS_EAT,
} from "@party/core/modules/forces/collisions";

interface PhysicsControlsProps {
  physics: Physics | null;
  collisions: Collisions | null;
}

export function PhysicsControls({ physics, collisions }: PhysicsControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityAngle, setGravityAngle] = useState(radToDeg(DEFAULT_GRAVITY_ANGLE)); // Convert radians to degrees for UI
  const [inertia, setInertia] = useState(DEFAULT_INERTIA);
  const [friction, setFriction] = useState(DEFAULT_FRICTION);
  const [collisionsEnabled, setCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLED
  );
  const [collisionsEat, setCollisionsEat] = useState(DEFAULT_COLLISIONS_EAT);

  useEffect(() => {
    if (physics) {
      setGravityStrength(physics.strength);
      const angle =
        Math.atan2(physics.direction.y, physics.direction.x) * (180 / Math.PI);
      setGravityAngle((angle + 360) % 360);
      setInertia(physics.inertia);
      setFriction(physics.friction);
    }
    if (collisions) {
      setCollisionsEnabled(collisions.enabled);
      setCollisionsEat(collisions.eat);
    }
  }, [physics, collisions]);

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

  const handleCollisionsEnabledChange = (enabled: boolean) => {
    setCollisionsEnabled(enabled);
    if (collisions) {
      collisions.setEnabled(enabled);
    }
  };

  const handleCollisionsEatChange = (eat: boolean) => {
    setCollisionsEat(eat);
    if (collisions) {
      collisions.setEat(eat);
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

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={collisionsEnabled}
            onChange={(e) => handleCollisionsEnabledChange(e.target.checked)}
          />
          Enable Collisions
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={collisionsEat}
            disabled={!collisionsEnabled}
            onChange={(e) => handleCollisionsEatChange(e.target.checked)}
            className={`checkbox ${!collisionsEnabled ? "disabled" : ""}`}
          />
          Eat on Collision
        </label>
      </div>
    </div>
  );
}
