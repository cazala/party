import { useState, useEffect } from "react";
import {
  Joints,
  getIdCounter,
  DEFAULT_MOMENTUM_PRESERVATION,
} from "@cazala/party/legacy";
import { UseUndoRedoReturn } from "../../hooks/useUndoRedo";

interface JointControlsProps {
  joints: Joints | null;
  undoRedo: UseUndoRedoReturn | null;
}

export function JointControls({ joints, undoRedo }: JointControlsProps) {
  const [enabled, setEnabled] = useState(true);
  const [jointCount, setJointCount] = useState(0);
  const [tolerance, setTolerance] = useState(1.0);
  const [maxIterations, setMaxIterations] = useState(10);
  const [momentum, setMomentum] = useState(DEFAULT_MOMENTUM_PRESERVATION);

  // Update local state when joints changes
  useEffect(() => {
    if (joints) {
      setEnabled(joints.enabled);
      setJointCount(joints.getJointCount());
      setTolerance(joints.getGlobalTolerance());
      setMaxIterations(joints.maxIterations);
      setMomentum(joints.momentum);
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

  const handleToleranceChange = (value: number) => {
    setTolerance(value);
    if (joints) {
      joints.setGlobalTolerance(value);
    }
  };

  const handleMaxIterationsChange = (value: number) => {
    setMaxIterations(value);
    if (joints) {
      joints.setMaxIterations(value);
    }
  };

  const handleMomentumChange = (value: number) => {
    setMomentum(value);
    if (joints) {
      joints.setMomentum(value);
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
        <label>Tolerance: {tolerance.toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={tolerance}
          onChange={(e) => handleToleranceChange(parseFloat(e.target.value))}
          className="slider"
          disabled={!enabled}
          style={{
            width: "100%",
            marginTop: "4px",
          }}
        />
      </div>

      <div className="control-group">
        <label>Max Iterations: {maxIterations}</label>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={maxIterations}
          onChange={(e) => handleMaxIterationsChange(parseInt(e.target.value))}
          className="slider"
          disabled={!enabled}
          style={{
            width: "100%",
            marginTop: "4px",
          }}
        />
        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
          Higher values = more rigid joints, but lower performance
        </div>
      </div>

      <div className="control-group">
        <label>Momentum: {momentum.toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={momentum}
          onChange={(e) => handleMomentumChange(parseFloat(e.target.value))}
          className="slider"
          disabled={!enabled}
          style={{
            width: "100%",
            marginTop: "4px",
          }}
        />
        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
          Momentum preservation for joint particles (0 = no preservation, 1 =
          full preservation)
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
          Clear All Joints ({jointCount})
        </button>
      </div>
    </div>
  );
}
