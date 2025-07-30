import { useState, useEffect } from "react";
import { Joints, getIdCounter } from "@cazala/party";
import { UseUndoRedoReturn } from "../../hooks/useUndoRedo";

interface JointControlsProps {
  joints: Joints | null;
  undoRedo: UseUndoRedoReturn | null;
}

export function JointControls({ joints, undoRedo }: JointControlsProps) {
  const [enabled, setEnabled] = useState(true);
  const [jointCount, setJointCount] = useState(0);
  const [stiffness, setStiffness] = useState(1.0);

  // Update local state when joints changes
  useEffect(() => {
    if (joints) {
      setEnabled(joints.enabled);
      setJointCount(joints.getJointCount());
      setStiffness(joints.getGlobalStiffness());
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

  const handleStiffnessChange = (value: number) => {
    setStiffness(value);
    if (joints) {
      joints.setGlobalStiffness(value);
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
        <label>Stiffness: {stiffness.toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={stiffness}
          onChange={(e) => handleStiffnessChange(parseFloat(e.target.value))}
          className="slider"
          disabled={!enabled}
          style={{
            width: "100%",
            marginTop: "4px",
          }}
        />
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
