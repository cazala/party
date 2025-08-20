import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  Collisions,
  Joints,
  DEFAULT_COLLISIONS_ENABLE_PARTICLES,
  DEFAULT_COLLISIONS_EAT,
  DEFAULT_COLLISIONS_RESTITUTION,
  DEFAULT_COLLISIONS_FRICTION,
  DEFAULT_JOINT_COLLISIONS_ENABLED,
  DEFAULT_JOINT_CROSSING_RESOLUTION,
} from "@cazala/party";
import { Tooltip } from "../Tooltip";

interface CollisionControlsProps {
  collisions: Collisions | null;
  joints: Joints | null;
}

export interface CollisionControlsRef {
  getState: () => {
    particleCollisionsEnabled: boolean;
    jointCollisionsEnabled: boolean;
    jointCrossingResolutionEnabled: boolean;
    restitution: number;
    friction: number;
    collisionsEat: boolean;
  };
  setState: (state: Partial<{
    particleCollisionsEnabled: boolean;
    jointCollisionsEnabled: boolean;
    jointCrossingResolutionEnabled: boolean;
    restitution: number;
    friction: number;
    collisionsEat: boolean;
  }>) => void;
}

export const CollisionControls = forwardRef<CollisionControlsRef, CollisionControlsProps>(({
  collisions,
  joints,
}, ref) => {
  // Collision states
  const [particleCollisionsEnabled, setParticleCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLE_PARTICLES
  );
  const [jointCollisionsEnabled, setJointCollisionsEnabled] = useState(
    DEFAULT_JOINT_COLLISIONS_ENABLED
  );
  const [jointCrossingResolutionEnabled, setJointCrossingResolutionEnabled] = useState(
    DEFAULT_JOINT_CROSSING_RESOLUTION
  );
  const [restitution, setRestitution] = useState(
    DEFAULT_COLLISIONS_RESTITUTION
  );
  const [friction, setFriction] = useState(DEFAULT_COLLISIONS_FRICTION);
  const [collisionsEat, setCollisionsEat] = useState(DEFAULT_COLLISIONS_EAT);

  // Update states when modules change
  useEffect(() => {
    if (collisions) {
      setParticleCollisionsEnabled(collisions.enableParticles);
      setCollisionsEat(collisions.eat);
      setRestitution(collisions.restitution);
      setFriction(collisions.friction);
    }
  }, [collisions]);

  useEffect(() => {
    if (joints) {
      setJointCollisionsEnabled(joints.enableCollisions);
      setJointCrossingResolutionEnabled(joints.enableCrossingResolution);
    }
  }, [joints]);

  // Collision handlers
  const handleParticleCollisionsEnabledChange = (enabled: boolean) => {
    setParticleCollisionsEnabled(enabled);
    if (collisions) {
      collisions.setEnableParticles(enabled);
    }
  };

  const handleJointCollisionsEnabledChange = (enabled: boolean) => {
    setJointCollisionsEnabled(enabled);
    if (joints) {
      joints.setEnableCollisions(enabled);
    }
  };

  const handleJointCrossingResolutionEnabledChange = (enabled: boolean) => {
    setJointCrossingResolutionEnabled(enabled);
    if (joints) {
      joints.setEnableCrossingResolution(enabled);
    }
  };

  const handleRestitutionChange = (value: number) => {
    setRestitution(value);
    if (collisions) {
      collisions.setRestitution(value);
    }
  };

  const handleFrictionChange = (value: number) => {
    setFriction(value);
    if (collisions) {
      collisions.setFriction(value);
    }
  };

  const handleCollisionsEatChange = (eat: boolean) => {
    setCollisionsEat(eat);
    if (collisions) {
      collisions.setEat(eat);
    }
  };

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getState: () => ({
      particleCollisionsEnabled,
      jointCollisionsEnabled,
      jointCrossingResolutionEnabled,
      restitution,
      friction,
      collisionsEat,
    }),
    setState: (state) => {
      if (state.particleCollisionsEnabled !== undefined) {
        setParticleCollisionsEnabled(state.particleCollisionsEnabled);
      }
      if (state.jointCollisionsEnabled !== undefined) {
        setJointCollisionsEnabled(state.jointCollisionsEnabled);
      }
      if (state.jointCrossingResolutionEnabled !== undefined) {
        setJointCrossingResolutionEnabled(state.jointCrossingResolutionEnabled);
      }
      if (state.restitution !== undefined) {
        setRestitution(state.restitution);
      }
      if (state.friction !== undefined) {
        setFriction(state.friction);
      }
      if (state.collisionsEat !== undefined) {
        setCollisionsEat(state.collisionsEat);
      }
    },
  }), [particleCollisionsEnabled, jointCollisionsEnabled, jointCrossingResolutionEnabled, restitution, friction, collisionsEat]);

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={particleCollisionsEnabled}
            onChange={(e) =>
              handleParticleCollisionsEnabledChange(e.target.checked)
            }
          />
          Particle vs Particle
          <Tooltip content="Enable collisions between particles" />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={jointCollisionsEnabled}
            onChange={(e) =>
              handleJointCollisionsEnabledChange(e.target.checked)
            }
            className="checkbox"
          />
          Particle vs Joint
          <Tooltip content="Enable collisions between particles and joints" />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={jointCrossingResolutionEnabled}
            onChange={(e) =>
              handleJointCrossingResolutionEnabledChange(e.target.checked)
            }
            className="checkbox"
          />
          Joint vs Joint
          <Tooltip content="Enable crossing resolution between joints to prevent structural overlaps" />
        </label>
      </div>

      <div className="control-group">
        <label>
          Restitution: {restitution.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={restitution}
            onChange={(e) =>
              handleRestitutionChange(parseFloat(e.target.value))
            }
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
          <input
            type="checkbox"
            checked={collisionsEat}
            disabled={!particleCollisionsEnabled}
            onChange={(e) => handleCollisionsEatChange(e.target.checked)}
            className={`checkbox ${
              !particleCollisionsEnabled ? "disabled" : ""
            }`}
          />
          Enable Eat
          <Tooltip content="When enabled, when two particles hit, the one with less mass is removed" />
        </label>
      </div>
    </div>
  );
});
