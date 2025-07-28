import { useState, useEffect } from "react";
import {
  Joints,
  System,
  DEFAULT_JOINT_RESTITUTION,
  DEFAULT_JOINT_COLLISIONS_ENABLED,
  DEFAULT_JOINT_FRICTION,
  getIdCounter,
} from "@party/core";
import { UseUndoRedoReturn } from "../../hooks/useUndoRedo";

interface JointControlsProps {
  joints: Joints | null;
  system: System | null;
  undoRedo: UseUndoRedoReturn | null;
}

export function JointControls({ joints, system, undoRedo }: JointControlsProps) {
  const [enabled, setEnabled] = useState(true);
  const [jointCount, setJointCount] = useState(0);
  const [restitution, setRestitution] = useState(DEFAULT_JOINT_RESTITUTION);
  const [enableCollisions, setEnableCollisions] = useState(
    DEFAULT_JOINT_COLLISIONS_ENABLED
  );
  const [friction, setFriction] = useState(DEFAULT_JOINT_FRICTION);

  // Update local state when joints changes
  useEffect(() => {
    if (joints) {
      setEnabled(joints.enabled);
      setJointCount(joints.getJointCount());
      setRestitution(joints.restitution);
      setEnableCollisions(joints.enableCollisions);
      setFriction(joints.friction);
    }
  }, [joints]);

  // Update joint count periodically
  useEffect(() => {
    if (!joints) return;

    const interval = setInterval(() => {
      setJointCount(joints.getJointCount());
    }, 100);

    return () => clearInterval(interval);
  }, [joints]);

  const handleEnabledChange = (value: boolean) => {
    setEnabled(value);
    if (joints) {
      joints.setEnabled(value);
    }
  };

  const handleRestitutionChange = (value: number) => {
    setRestitution(value);
    if (joints) {
      joints.setRestitution(value);
    }
  };

  const handleEnableCollisionsChange = (value: boolean) => {
    setEnableCollisions(value);
    if (joints) {
      joints.setEnableCollisions(value);
    }
  };

  const handleFrictionChange = (value: number) => {
    setFriction(value);
    if (joints) {
      joints.setFriction(value);
    }
  };

  const handleClearAllJoints = () => {
    if (joints && undoRedo) {
      // Get all existing joints before clearing
      const existingJoints = joints.getAllJoints();
      
      // Clear all joints
      joints.clear();
      setJointCount(0);
      
      // Record the clear operation for undo (for each joint removal)
      existingJoints.forEach((joint) => {
        undoRedo.recordJointRemove(joint, getIdCounter());
      });
    }
  };

  const handleJoinSequence = () => {
    if (!joints || !system || !undoRedo) return;

    const particles = system.particles;
    if (particles.length < 2) return;

    // Sort particles by ID
    const sortedParticles = [...particles].sort((a, b) => a.id - b.id);

    // Create joints between consecutive particles
    const createdJoints = [];
    for (let i = 0; i < sortedParticles.length - 1; i++) {
      const joint = joints.createJoint({
        particleA: sortedParticles[i],
        particleB: sortedParticles[i + 1],
      });
      createdJoints.push(joint);
    }
    
    // Record all created joints for undo
    createdJoints.forEach((joint) => {
      undoRedo.recordJointCreate(joint, getIdCounter());
    });
  };

  const handleJoinCircuit = () => {
    if (!joints || !system || !undoRedo) return;

    const particles = system.particles;
    if (particles.length < 2) return;

    // Sort particles by ID
    const sortedParticles = [...particles].sort((a, b) => a.id - b.id);

    // Create joints between consecutive particles
    const createdJoints = [];
    for (let i = 0; i < sortedParticles.length - 1; i++) {
      const joint = joints.createJoint({
        particleA: sortedParticles[i],
        particleB: sortedParticles[i + 1],
      });
      createdJoints.push(joint);
    }

    // Close the circuit by joining last to first
    if (sortedParticles.length > 2) {
      const circuitJoint = joints.createJoint({
        particleA: sortedParticles[sortedParticles.length - 1],
        particleB: sortedParticles[0],
      });
      createdJoints.push(circuitJoint);
    }
    
    // Record all created joints for undo
    createdJoints.forEach((joint) => {
      undoRedo.recordJointCreate(joint, getIdCounter());
    });
  };

  const handleJoinAll = () => {
    if (!joints || !system || !undoRedo) return;

    const particles = system.particles;
    if (particles.length < 2) return;

    // Create joints between every pair of particles
    const createdJoints = [];
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const joint = joints.createJoint({
          particleA: particles[i],
          particleB: particles[j],
        });
        createdJoints.push(joint);
      }
    }
    
    // Record all created joints for undo
    createdJoints.forEach((joint) => {
      undoRedo.recordJointCreate(joint, getIdCounter());
    });
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
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
            step="0.01"
            value={restitution}
            onChange={(e) =>
              handleRestitutionChange(parseFloat(e.target.value))
            }
            className="slider"
            disabled={!enabled}
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
            step="0.01"
            value={friction}
            onChange={(e) => handleFrictionChange(parseFloat(e.target.value))}
            className="slider"
            disabled={!enabled}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enableCollisions}
            onChange={(e) => handleEnableCollisionsChange(e.target.checked)}
            className="checkbox"
          />
          Enable Collisions
        </label>
      </div>

      <div className="control-group">
        <div className="joint-info">
          <span>Active Joints: {jointCount}</span>
        </div>
      </div>

      <div className="control-group">
        <button
          onClick={handleClearAllJoints}
          className="clear-joints-button"
          disabled={!enabled || jointCount === 0}
          style={{
            padding: "8px 16px",
            backgroundColor: jointCount === 0 ? "#666" : "#ff4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: jointCount === 0 ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
            opacity: jointCount === 0 ? 0.5 : 1,
            width: "100%",
            marginBottom: "8px",
          }}
        >
          Clear All Joints
        </button>
      </div>

      <div className="control-group">
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            onClick={handleJoinSequence}
            disabled={!enabled || !system || system.particles.length < 2}
            style={{
              padding: "6px 12px",
              backgroundColor:
                !enabled || !system || system.particles.length < 2
                  ? "#666"
                  : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !enabled || !system || system.particles.length < 2
                  ? "not-allowed"
                  : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity:
                !enabled || !system || system.particles.length < 2 ? 0.5 : 1,
            }}
          >
            Join Sequence
          </button>

          <button
            onClick={handleJoinCircuit}
            disabled={!enabled || !system || system.particles.length < 3}
            style={{
              padding: "6px 12px",
              backgroundColor:
                !enabled || !system || system.particles.length < 3
                  ? "#666"
                  : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !enabled || !system || system.particles.length < 3
                  ? "not-allowed"
                  : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity:
                !enabled || !system || system.particles.length < 3 ? 0.5 : 1,
            }}
          >
            Join Circuit
          </button>

          <button
            onClick={handleJoinAll}
            disabled={!enabled || !system || system.particles.length < 2}
            style={{
              padding: "6px 12px",
              backgroundColor:
                !enabled || !system || system.particles.length < 2
                  ? "#666"
                  : "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !enabled || !system || system.particles.length < 2
                  ? "not-allowed"
                  : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity:
                !enabled || !system || system.particles.length < 2 ? 0.5 : 1,
            }}
          >
            Join All
          </button>
        </div>
      </div>

      <div className="control-group">
        <div className="joint-instructions">
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ccc" }}>
            Pin Joints:
          </h4>
          <ul
            style={{
              margin: "0 0 12px 0",
              paddingLeft: "16px",
              fontSize: "12px",
              color: "#aaa",
            }}
          >
            <li>
              <strong>Pin joints:</strong> Rigid constraints that maintain exact
              distance between particles
            </li>
          </ul>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ccc" }}>
            Quick Join Options:
          </h4>
          <ul
            style={{
              margin: "0 0 12px 0",
              paddingLeft: "16px",
              fontSize: "12px",
              color: "#aaa",
            }}
          >
            <li>
              <strong>Sequence:</strong> Connect particles in ID order (chain)
            </li>
            <li>
              <strong>Circuit:</strong> Sequence + connect last to first (loop)
            </li>
            <li>
              <strong>All:</strong> Connect every particle to every other
            </li>
          </ul>

          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ccc" }}>
            Manual Instructions:
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "12px",
              color: "#aaa",
            }}
          >
            <li>Select "Joint" tool from the top bar</li>
            <li>Click first particle to select it</li>
            <li>Click second particle to create joint</li>
            <li>Click empty space to deselect</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
