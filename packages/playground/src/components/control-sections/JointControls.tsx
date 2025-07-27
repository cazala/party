import { useState, useEffect } from "react";
import { Joints, JointType, System } from "@party/core";

interface JointControlsProps {
  joints: Joints | null;
  system: System | null;
}

export function JointControls({ joints, system }: JointControlsProps) {
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

  const handleJoinSequence = () => {
    if (!joints || !system) return;
    
    const particles = system.particles;
    if (particles.length < 2) return;
    
    // Sort particles by ID
    const sortedParticles = [...particles].sort((a, b) => a.id - b.id);
    
    // Create joints between consecutive particles
    for (let i = 0; i < sortedParticles.length - 1; i++) {
      joints.createJoint({
        particleA: sortedParticles[i],
        particleB: sortedParticles[i + 1],
      });
    }
  };

  const handleJoinCircuit = () => {
    if (!joints || !system) return;
    
    const particles = system.particles;
    if (particles.length < 2) return;
    
    // Sort particles by ID
    const sortedParticles = [...particles].sort((a, b) => a.id - b.id);
    
    // Create joints between consecutive particles
    for (let i = 0; i < sortedParticles.length - 1; i++) {
      joints.createJoint({
        particleA: sortedParticles[i],
        particleB: sortedParticles[i + 1],
      });
    }
    
    // Close the circuit by joining last to first
    if (sortedParticles.length > 2) {
      joints.createJoint({
        particleA: sortedParticles[sortedParticles.length - 1],
        particleB: sortedParticles[0],
      });
    }
  };

  const handleJoinAll = () => {
    if (!joints || !system) return;
    
    const particles = system.particles;
    if (particles.length < 2) return;
    
    // Create joints between every pair of particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        joints.createJoint({
          particleA: particles[i],
          particleB: particles[j],
        });
      }
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
            max="50000"
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
              backgroundColor: !enabled || !system || system.particles.length < 2 ? "#666" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !enabled || !system || system.particles.length < 2 ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity: !enabled || !system || system.particles.length < 2 ? 0.5 : 1,
            }}
          >
            Join Sequence
          </button>
          
          <button
            onClick={handleJoinCircuit}
            disabled={!enabled || !system || system.particles.length < 3}
            style={{
              padding: "6px 12px",
              backgroundColor: !enabled || !system || system.particles.length < 3 ? "#666" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !enabled || !system || system.particles.length < 3 ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity: !enabled || !system || system.particles.length < 3 ? 0.5 : 1,
            }}
          >
            Join Circuit
          </button>
          
          <button
            onClick={handleJoinAll}
            disabled={!enabled || !system || system.particles.length < 2}
            style={{
              padding: "6px 12px",
              backgroundColor: !enabled || !system || system.particles.length < 2 ? "#666" : "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !enabled || !system || system.particles.length < 2 ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              opacity: !enabled || !system || system.particles.length < 2 ? 0.5 : 1,
            }}
          >
            Join All
          </button>
        </div>
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
            <li><strong>Sequence:</strong> Connect particles in ID order (chain)</li>
            <li><strong>Circuit:</strong> Sequence + connect last to first (loop)</li>
            <li><strong>All:</strong> Connect every particle to every other</li>
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
