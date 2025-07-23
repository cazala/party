import { useState, useEffect } from "react";
import { Gravity, Collisions } from "@party/core";
import {
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
} from "@party/core/modules/forces/gravity";
import {
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_COLLISIONS_EAT,
} from "@party/core/modules/forces/collisions";

interface PhysicsControlsProps {
  gravity: Gravity | null;
  collisions: Collisions | null;
}

export function PhysicsControls({ gravity, collisions }: PhysicsControlsProps) {
  const [gravityStrength, setGravityStrength] = useState(
    DEFAULT_GRAVITY_STRENGTH
  );
  const [gravityAngle, setGravityAngle] = useState(DEFAULT_GRAVITY_ANGLE);
  const [collisionsEnabled, setCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLED
  );
  const [collisionsEat, setCollisionsEat] = useState(DEFAULT_COLLISIONS_EAT);

  useEffect(() => {
    if (gravity) {
      setGravityStrength(gravity.strength);
      const angle =
        Math.atan2(gravity.direction.y, gravity.direction.x) * (180 / Math.PI);
      setGravityAngle((angle + 360) % 360);
    }
    if (collisions) {
      setCollisionsEnabled(collisions.enabled);
      setCollisionsEat(collisions.eat);
    }
  }, [gravity, collisions]);

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
