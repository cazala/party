import { useState, useEffect } from "react";
import { Joints, System, getIdCounter } from "@party/core";
import { UseUndoRedoReturn } from "../../hooks/useUndoRedo";

interface JointControlsProps {
  joints: Joints | null;
  system: System | null;
  undoRedo: UseUndoRedoReturn | null;
}

export function JointControls({
  joints,
  system,
  undoRedo,
}: JointControlsProps) {
  const [enabled, setEnabled] = useState(true);
  const [jointCount, setJointCount] = useState(0);

  // Update local state when joints changes
  useEffect(() => {
    if (joints) {
      setEnabled(joints.enabled);
      setJointCount(joints.getJointCount());
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
          Clear All Joints ({jointCount})
        </button>
      </div>
    </div>
  );
}
