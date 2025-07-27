import { useState, useEffect } from "react";
import { Joints, JointType } from "@party/core";

interface JointControlsProps {
  joints: Joints | null;
}

export function JointControls({ joints }: JointControlsProps) {
  const [enabled, setEnabled] = useState(true);
  const [defaultStiffness, setDefaultStiffness] = useState(0.5);
  const [defaultDamping, setDefaultDamping] = useState(0.1);
  const [defaultMaxForce, setDefaultMaxForce] = useState(1000);
  const [defaultType, setDefaultType] = useState<JointType>("pin");
  const [jointCount, setJointCount] = useState(0);

  // Update local state when joints changes
  useEffect(() => {
    if (joints) {
      setEnabled(joints.enabled);
      setDefaultStiffness(joints.defaultStiffness);
      setDefaultDamping(joints.defaultDamping);
      setDefaultMaxForce(joints.defaultMaxForce);
      setDefaultType(joints.defaultType);
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

  const handleStiffnessChange = (value: number) => {
    setDefaultStiffness(value);
    if (joints) {
      joints.setDefaultStiffness(value);
    }
  };

  const handleDampingChange = (value: number) => {
    setDefaultDamping(value);
    if (joints) {
      joints.setDefaultDamping(value);
    }
  };

  const handleMaxForceChange = (value: number) => {
    setDefaultMaxForce(value);
    if (joints) {
      joints.setDefaultMaxForce(value);
    }
  };

  const handleTypeChange = (type: JointType) => {
    setDefaultType(type);
    if (joints) {
      joints.setDefaultType(type);
    }
  };

  const handleClearAllJoints = () => {
    if (joints) {
      joints.clear();
      setJointCount(0);
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
        <label>
          Joint Type
          <select
            value={defaultType}
            onChange={(e) => handleTypeChange(e.target.value as JointType)}
            className="form-select"
            disabled={!enabled}
          >
            <option value="distance">Distance</option>
            <option value="spring">Spring</option>
            <option value="pin">Pin</option>
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          Default Stiffness: {defaultStiffness.toFixed(2)}
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={defaultStiffness}
            onChange={(e) => handleStiffnessChange(parseFloat(e.target.value))}
            className="slider"
            disabled={!enabled}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Default Damping: {defaultDamping.toFixed(3)}
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.001"
            value={defaultDamping}
            onChange={(e) => handleDampingChange(parseFloat(e.target.value))}
            className="slider"
            disabled={!enabled}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Max Force: {defaultMaxForce.toLocaleString()}
          <input
            type="range"
            min="100"
            max="5000"
            step="50"
            value={defaultMaxForce}
            onChange={(e) => handleMaxForceChange(parseFloat(e.target.value))}
            className="slider"
            disabled={!enabled}
          />
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
          }}
        >
          Clear All Joints
        </button>
      </div>

      <div className="control-group">
        <div className="joint-instructions">
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ccc" }}>
            Joint Types:
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
              <strong>Spring:</strong> Maintains distance with spring-like
              behavior
            </li>
            <li>
              <strong>Pin:</strong> Rigid constraint that enforces exact
              distance
            </li>
          </ul>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#ccc" }}>
            Usage Instructions:
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
