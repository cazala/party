import { useState, useEffect } from "react";
import { Sensors } from "@party/core";
import {
  DEFAULT_TRAIL_ENABLED,
  DEFAULT_TRAIL_DECAY,
  DEFAULT_TRAIL_DIFFUSE,
} from "@party/core/modules/forces/sensors";

interface SensorsControlsProps {
  sensors: Sensors | null;
}

export function SensorsControls({ sensors }: SensorsControlsProps) {
  // Trail state
  const [trailEnabled, setTrailEnabled] = useState(DEFAULT_TRAIL_ENABLED);
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(DEFAULT_TRAIL_DIFFUSE);

  useEffect(() => {
    if (sensors) {
      setTrailEnabled(sensors.enableTrail);
      setTrailDecay(sensors.trailDecay);
      setTrailDiffuse(sensors.trailDiffuse);
    }
  }, [sensors]);

  const handleSensorsChange = (
    property: keyof Sensors,
    value: number | boolean
  ) => {
    if (!sensors) return;

    switch (property) {
      case "enableTrail":
        setTrailEnabled(value as boolean);
        sensors.setEnableTrail(value as boolean);
        break;
      case "trailDecay":
        setTrailDecay(value as number);
        sensors.setTrailDecay(value as number);
        break;
      case "trailDiffuse":
        setTrailDiffuse(value as number);
        sensors.setTrailDiffuse(value as number);
        break;
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={trailEnabled}
            onChange={(e) =>
              handleSensorsChange("enableTrail", e.target.checked)
            }
            className="checkbox"
          />
          Enable Trail
        </label>
      </div>

      <div className="control-group">
        <label>
          Trail Decay: {trailDecay.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={trailDecay}
            disabled={!trailEnabled}
            onChange={(e) =>
              handleSensorsChange("trailDecay", parseFloat(e.target.value))
            }
            className={`slider ${!trailEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Trail Diffuse: {trailDiffuse}px
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={trailDiffuse}
            disabled={!trailEnabled}
            onChange={(e) =>
              handleSensorsChange("trailDiffuse", parseFloat(e.target.value))
            }
            className={`slider ${!trailEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
