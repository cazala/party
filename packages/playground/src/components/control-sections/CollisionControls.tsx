import { useState, useEffect } from "react";
import {
  Collisions,
  Joints,
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_COLLISIONS_EAT,
  DEFAULT_COLLISIONS_RESTITUTION,
  DEFAULT_JOINT_COLLISIONS_ENABLED,
  DEFAULT_MOMENTUM_PRESERVATION,
} from "@cazala/party";

interface CollisionControlsProps {
  collisions: Collisions | null;
  joints: Joints | null;
}

export function CollisionControls({
  collisions,
  joints,
}: CollisionControlsProps) {
  // Collision states
  const [particleCollisionsEnabled, setParticleCollisionsEnabled] = useState(
    DEFAULT_COLLISIONS_ENABLED
  );
  const [jointCollisionsEnabled, setJointCollisionsEnabled] = useState(
    DEFAULT_JOINT_COLLISIONS_ENABLED
  );
  const [restitution, setRestitution] = useState(
    DEFAULT_COLLISIONS_RESTITUTION
  );
  const [momentum, setMomentumState] = useState(DEFAULT_MOMENTUM_PRESERVATION);
  const [collisionsEat, setCollisionsEat] = useState(DEFAULT_COLLISIONS_EAT);

  // Update states when modules change
  useEffect(() => {
    if (collisions) {
      setParticleCollisionsEnabled(collisions.enabled);
      setCollisionsEat(collisions.eat);
      setRestitution(collisions.restitution);
      setMomentumState(collisions.momentum || DEFAULT_MOMENTUM_PRESERVATION);
    }
  }, [collisions]);

  useEffect(() => {
    if (joints) {
      setJointCollisionsEnabled(joints.enableCollisions);
    }
  }, [joints]);

  // Collision handlers
  const handleParticleCollisionsEnabledChange = (enabled: boolean) => {
    setParticleCollisionsEnabled(enabled);
    if (collisions) {
      collisions.setEnabled(enabled);
    }
  };

  const handleJointCollisionsEnabledChange = (enabled: boolean) => {
    setJointCollisionsEnabled(enabled);
    if (joints) {
      joints.setEnableCollisions(enabled);
    }
  };

  const handleRestitutionChange = (value: number) => {
    setRestitution(value);
    if (collisions) {
      collisions.setRestitution(value);
    }
  };

  const handleMomentumChange = (value: number) => {
    setMomentumState(value);
    if (collisions) {
      collisions.setMomentum(value);
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
          <input
            type="checkbox"
            checked={particleCollisionsEnabled}
            onChange={(e) =>
              handleParticleCollisionsEnabledChange(e.target.checked)
            }
          />
          Enable Particles
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
          Enable Joints
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
          Momentum: {momentum.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={momentum}
            onChange={(e) => handleMomentumChange(parseFloat(e.target.value))}
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
          Eat on Collision
        </label>
      </div>
    </div>
  );
}
