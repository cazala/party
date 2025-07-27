import { useState, useEffect } from "react";
import { System, DEFAULT_MOMENTUM_PRESERVATION } from "@party/core";

interface SystemSettingsControlsProps {
  system: System | null;
}

export function SystemSettingsControls({ system }: SystemSettingsControlsProps) {
  const [momentumPreservation, setMomentumPreservation] = useState(DEFAULT_MOMENTUM_PRESERVATION);

  useEffect(() => {
    if (system) {
      setMomentumPreservation(system.momentumPreservation);
    }
  }, [system]);

  const handleMomentumPreservationChange = (value: number) => {
    setMomentumPreservation(value);
    if (system) {
      system.setMomentumPreservation(value);
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Momentum Preservation: {momentumPreservation.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={momentumPreservation}
            onChange={(e) => handleMomentumPreservationChange(parseFloat(e.target.value))}
            className="slider"
          />
        </label>
        <div style={{ fontSize: "12px", color: "#aaa", marginTop: "4px" }}>
          Controls how much momentum is preserved when particles are constrained by joints.
          <br />
          0 = No momentum preservation (slow falling)
          <br />
          1 = Full momentum preservation (natural falling)
        </div>
      </div>
    </div>
  );
}