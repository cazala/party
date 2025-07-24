import { useState, useEffect } from "react";
import { Sensors, degToRad, radToDeg } from "@party/core";
import {
  DEFAULT_TRAIL_ENABLED,
  DEFAULT_TRAIL_DECAY,
  DEFAULT_TRAIL_DIFFUSE,
  DEFAULT_SENSORS_ENABLED,
  DEFAULT_SENSOR_DISTANCE,
  DEFAULT_SENSOR_ANGLE,
  DEFAULT_SENSOR_RADIUS,
  DEFAULT_SENSOR_THRESHOLD,
  DEFAULT_SENSOR_STRENGTH,
} from "@party/core/modules/forces/sensors";

interface SensorsControlsProps {
  sensors: Sensors | null;
}

export function SensorsControls({ sensors }: SensorsControlsProps) {
  // Trail state
  const [trailEnabled, setTrailEnabled] = useState(DEFAULT_TRAIL_ENABLED);
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(DEFAULT_TRAIL_DIFFUSE);

  // Sensor state
  const [sensorsEnabled, setSensorsEnabled] = useState(DEFAULT_SENSORS_ENABLED);
  const [sensorDistance, setSensorDistance] = useState(DEFAULT_SENSOR_DISTANCE);
  const [sensorAngle, setSensorAngle] = useState(
    radToDeg(DEFAULT_SENSOR_ANGLE)
  ); // Convert radians to degrees for UI
  const [sensorRadius, setSensorRadius] = useState(DEFAULT_SENSOR_RADIUS);
  const [sensorThreshold, setSensorThreshold] = useState(
    DEFAULT_SENSOR_THRESHOLD
  );
  const [sensorStrength, setSensorStrength] = useState(DEFAULT_SENSOR_STRENGTH);

  useEffect(() => {
    if (sensors) {
      setTrailEnabled(sensors.enableTrail);
      setTrailDecay(sensors.trailDecay);
      setTrailDiffuse(sensors.trailDiffuse);
      setSensorsEnabled(sensors.enableSensors);
      setSensorDistance(sensors.sensorDistance);
      setSensorAngle(radToDeg(sensors.sensorAngle)); // Convert radians to degrees for UI
      setSensorRadius(sensors.sensorRadius);
      setSensorThreshold(sensors.sensorThreshold);
      setSensorStrength(sensors.sensorStrength);
    }
  }, [sensors]);

  useEffect(() => {
    if (!trailEnabled && sensorsEnabled) {
      handleSensorsChange("enableSensors", false);
    }
  }, [trailEnabled, sensorsEnabled]);

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
      case "enableSensors":
        setSensorsEnabled(value as boolean);
        sensors.setEnableSensors(value as boolean);
        break;
      case "sensorDistance":
        setSensorDistance(value as number);
        sensors.setSensorDistance(value as number);
        break;
      case "sensorAngle":
        setSensorAngle(value as number); // Store degrees in UI state
        sensors.setSensorAngle(degToRad(value as number)); // Convert to radians for core library
        break;
      case "sensorRadius":
        setSensorRadius(value as number);
        sensors.setSensorRadius(value as number);
        break;
      case "sensorThreshold":
        setSensorThreshold(value as number);
        sensors.setSensorThreshold(value as number);
        break;
      case "sensorStrength":
        setSensorStrength(value as number);
        sensors.setSensorStrength(value as number);
        break;
    }
  };

  return (
    <div className="control-section">
      {/* Trail Section */}
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
          Trail Decay: {trailDecay.toFixed(3)}
          <input
            type="range"
            min="0.05"
            max="2"
            step="0.001"
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
            max="3"
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

      {/* Sensors Section */}
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={sensorsEnabled}
            disabled={!trailEnabled}
            onChange={(e) =>
              handleSensorsChange("enableSensors", e.target.checked)
            }
            className="checkbox"
          />
          Enable Sensors
        </label>
      </div>

      <div className="control-group">
        <label>
          Sensor Distance: {sensorDistance}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sensorDistance}
            disabled={!sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorDistance", parseFloat(e.target.value))
            }
            className={`slider ${!sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Sensor Angle: {Math.round(sensorAngle)}°
          <input
            type="range"
            min="0"
            max="90"
            step="1"
            value={sensorAngle}
            disabled={!sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorAngle", parseFloat(e.target.value))
            }
            className={`slider ${!sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Sensor Radius: {sensorRadius}px
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={sensorRadius}
            disabled={!sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorRadius", parseFloat(e.target.value))
            }
            className={`slider ${!sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Sensor Threshold: {sensorThreshold.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sensorThreshold}
            disabled={!sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorThreshold", parseFloat(e.target.value))
            }
            className={`slider ${!sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Sensor Strength: {sensorStrength}
          <input
            type="range"
            min="0"
            max="2000"
            step="0.1"
            value={sensorStrength}
            disabled={!sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorStrength", parseFloat(e.target.value))
            }
            className={`slider ${!sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
