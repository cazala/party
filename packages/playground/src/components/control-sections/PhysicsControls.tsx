import { useState, useEffect } from "react";
import { Gravity, Bounds, Collisions, Fluid } from "@party/core";
import {
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
} from "@party/core/modules/forces/gravity";
import {
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
} from "@party/core/modules/forces/bounds";
import { DEFAULT_COLLISIONS_ENABLED, DEFAULT_COLLISIONS_EAT } from "@party/core/modules/forces/collisions";
import {
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_WOBBLE_FACTOR,
} from "@party/core/modules/forces/fluid";

interface PhysicsControlsProps {
  gravity: Gravity | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
  fluid: Fluid | null;
}

export function PhysicsControls({
  gravity,
  bounds,
  collisions,
  fluid,
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
  const [collisionsEat, setCollisionsEat] = useState(
    DEFAULT_COLLISIONS_EAT
  );
  
  // Fluid state
  const [fluidEnabled, setFluidEnabled] = useState(false); // Playground default: off
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(DEFAULT_TARGET_DENSITY);
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_PRESSURE_MULTIPLIER
  );
  const [wobbleFactor, setWobbleFactor] = useState(DEFAULT_WOBBLE_FACTOR);

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
      setCollisionsEat(collisions.eat);
    }
    if (fluid) {
      setFluidEnabled(fluid.enabled);
      setInfluenceRadius(fluid.influenceRadius);
      setTargetDensity(fluid.targetDensity);
      setPressureMultiplier(fluid.pressureMultiplier);
      setWobbleFactor(fluid.wobbleFactor);
    }
  }, [gravity, bounds, collisions, fluid]);

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

  const handleCollisionsEatChange = (eat: boolean) => {
    setCollisionsEat(eat);
    if (collisions) {
      collisions.setEat(eat);
    }
  };

  const handleFluidChange = (
    property: keyof Fluid,
    value: number | boolean
  ) => {
    if (!fluid) return;

    switch (property) {
      case "enabled":
        setFluidEnabled(value as boolean);
        fluid.setEnabled(value as boolean);
        break;
      case "influenceRadius":
        setInfluenceRadius(value as number);
        fluid.influenceRadius = value as number;
        break;
      case "targetDensity":
        setTargetDensity(value as number);
        fluid.targetDensity = value as number;
        break;
      case "pressureMultiplier":
        setPressureMultiplier(value as number);
        fluid.pressureMultiplier = value as number;
        break;
      case "wobbleFactor":
        setWobbleFactor(value as number);
        fluid.wobbleFactor = value as number;
        break;
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

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={fluidEnabled}
            onChange={(e) => handleFluidChange("enabled", e.target.checked)}
            className="checkbox"
          />
          Enable Fluids
        </label>
      </div>

      <div className="control-group">
        <label>
          Density: {targetDensity.toFixed(2)}
          <input
            type="range"
            min="0.001"
            max="1"
            step="0.0001"
            value={targetDensity}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("targetDensity", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Pressure: {pressureMultiplier.toFixed(1)}
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={pressureMultiplier}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange(
                "pressureMultiplier",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Wobble: {wobbleFactor.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={wobbleFactor}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("wobbleFactor", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Influence: {influenceRadius.toFixed(1)}
          <input
            type="range"
            min="5"
            max="500"
            step="1"
            value={influenceRadius}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("influenceRadius", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
