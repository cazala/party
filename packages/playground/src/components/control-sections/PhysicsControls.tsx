import { useState, useEffect } from "react";
import { Gravity, Bounds, Collisions } from "@party/core";
import {
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
} from "@party/core/modules/forces/gravity";
import {
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
} from "@party/core/modules/forces/bounds";
import { DEFAULT_COLLISIONS_ENABLED } from "@party/core/modules/forces/collisions";

interface PhysicsControlsProps {
  gravity: Gravity | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
}

export function PhysicsControls({
  gravity,
  bounds,
  collisions,
}: PhysicsControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityAngle, setGravityAngle] = useState(DEFAULT_GRAVITY_ANGLE);
  const [bounce, setBounce] = useState(DEFAULT_BOUNDS_BOUNCE);
  const [boundsFriction, setBoundsFriction] = useState(DEFAULT_BOUNDS_FRICTION);
  const [collisionsEnabled, setCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLED
  );

  useEffect(() => {
    if (gravity) {
      setGravityStrength(gravity.strength);
      const angle =
        Math.atan2(gravity.direction.y, gravity.direction.x) * (180 / Math.PI);
      setGravityAngle((angle + 360) % 360);
    }
    if (bounds) {
      setBounce(bounds.bounce);
      setBoundsFriction(bounds.friction);
    }
    if (collisions) {
      setCollisionsEnabled(collisions.enabled);
    }
  }, [gravity, bounds, collisions]);

  const handleGravityStrengthChange = (value: number) => {
    setGravityStrength(value);
    if (gravity) {
      gravity.setStrength(value);
    }
  };

  const handleGravityAngleChange = (angle: number) => {
    setGravityAngle(angle);
    if (gravity) {
      gravity.setDirectionFromAngle(angle * (Math.PI / 180));
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

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Gravity: {gravityStrength.toFixed(3)}
          <input
            type="range"
            min="0"
            max="2000"
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
          />
          Enable Collisions
        </label>
      </div>
    </div>
  );
}
