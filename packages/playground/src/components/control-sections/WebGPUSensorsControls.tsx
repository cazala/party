import { useEffect, useState } from "react";
import {
  DEFAULT_SENSORS_SENSOR_DISTANCE,
  DEFAULT_SENSORS_SENSOR_ANGLE,
  DEFAULT_SENSORS_SENSOR_RADIUS,
  DEFAULT_SENSORS_SENSOR_THRESHOLD,
  DEFAULT_SENSORS_SENSOR_STRENGTH,
  DEFAULT_SENSORS_FOLLOW_BEHAVIOR,
  DEFAULT_SENSORS_FLEE_BEHAVIOR,
  Sensors,
  type SensorBehavior,
} from "@cazala/party/modules/webgpu/modules/sensors";

// removed behavior/color controls

// Helper functions
const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export function WebGPUSensorsControls({
  sensors,
  hideEnabled = false,
  enabled = true,
}: {
  sensors: Sensors | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(true);

  // Sensor state
  // Using only the top-level Enabled
  const [sensorDistance, setSensorDistance] = useState(
    DEFAULT_SENSORS_SENSOR_DISTANCE
  );
  const [sensorAngle, setSensorAngle] = useState(
    radToDeg(DEFAULT_SENSORS_SENSOR_ANGLE)
  );
  const [sensorRadius, setSensorRadius] = useState(
    DEFAULT_SENSORS_SENSOR_RADIUS
  );
  const [sensorThreshold, setSensorThreshold] = useState(
    DEFAULT_SENSORS_SENSOR_THRESHOLD
  );
  const [sensorStrength, setSensorStrength] = useState(
    DEFAULT_SENSORS_SENSOR_STRENGTH
  );

  // Particle color control removed; particle color is inherent per particle

  useEffect(() => {
    // Could hydrate from module if getters existed
  }, [sensors]);

  // no dependency between trails and sensors now

  const handleSensorsChange = (
    property: string,
    value: number | boolean | string
  ) => {
    if (!sensors || !enabled) return;

    switch (property) {
      // no inner enable toggle
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
      case "colorSimilarityThreshold":
        sensors.setColorSimilarityThreshold?.(value as number);
        break;
      case "followBehavior":
        sensors.setFollowBehavior?.(value as SensorBehavior);
        break;
      case "fleeBehavior":
        sensors.setFleeBehavior?.(value as SensorBehavior);
        break;
      case "fleeAngle":
        sensors.setFleeAngle?.(degToRad(value as number));
        break;
      // No particleColor case; color sampling happens in shader
    }
  };

  // Visibility helpers for conditional controls
  const [followValue, setFollowValue] = useState<string>(
    DEFAULT_SENSORS_FOLLOW_BEHAVIOR
  );
  const [fleeValue, setFleeValue] = useState<string>(
    DEFAULT_SENSORS_FLEE_BEHAVIOR
  );
  const showColorSimilarity =
    followValue === "same" ||
    followValue === "different" ||
    fleeValue === "same" ||
    fleeValue === "different";
  const showFleeAngle = fleeValue !== "none";

  return (
    <div className="control-section">
      {!hideEnabled && (
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={internalEnabled}
              onChange={(e) => {
                setInternalEnabled(e.target.checked);
                sensors?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}

      {/* No inner Enabled checkbox; only top-level */}

      <div className="control-group">
        <label>
          Distance: {sensorDistance}
          <input
            type="range"
            min="5"
            max="100"
            step="1"
            value={sensorDistance}
            disabled={!enabled}
            onChange={(e) =>
              handleSensorsChange("sensorDistance", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Angle: {Math.round(sensorAngle)}°
          <input
            type="range"
            min="0"
            max="90"
            step="1"
            value={sensorAngle}
            disabled={!enabled}
            onChange={(e) =>
              handleSensorsChange("sensorAngle", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Radius: {sensorRadius}px
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={sensorRadius}
            disabled={!enabled}
            onChange={(e) =>
              handleSensorsChange("sensorRadius", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Threshold: {sensorThreshold.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sensorThreshold}
            disabled={!enabled}
            onChange={(e) =>
              handleSensorsChange("sensorThreshold", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Strength: {sensorStrength.toFixed(0)}
          <input
            type="range"
            min="0"
            max="5000"
            step="10"
            value={sensorStrength}
            disabled={!enabled}
            onChange={(e) =>
              handleSensorsChange("sensorStrength", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      {/* Behavior controls (same/different) */}
      <div className="control-group">
        <label>
          Follow:
          <select
            disabled={!enabled}
            value={followValue}
            onChange={(e) => {
              setFollowValue(e.target.value);
              handleSensorsChange("followBehavior", e.target.value);
            }}
            className={`form-select ${!enabled ? "disabled" : ""}`}
          >
            <option value="none">None</option>
            <option value="any">Any</option>
            <option value="same">Same</option>
            <option value="different">Different</option>
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          Flee:
          <select
            disabled={!enabled}
            value={fleeValue}
            onChange={(e) => {
              setFleeValue(e.target.value);
              handleSensorsChange("fleeBehavior", e.target.value);
            }}
            className={`form-select ${!enabled ? "disabled" : ""}`}
          >
            <option value="none">None</option>
            <option value="any">Any</option>
            <option value="same">Same</option>
            <option value="different">Different</option>
          </select>
        </label>
      </div>

      {showColorSimilarity && (
        <div className="control-group">
          <label>
            Color Similarity:
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!enabled}
              onChange={(e) =>
                handleSensorsChange(
                  "colorSimilarityThreshold",
                  parseFloat(e.target.value)
                )
              }
              className={`slider ${!enabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}

      {showFleeAngle && (
        <div className="control-group">
          <label>
            Flee Angle:
            <input
              type="range"
              min="0"
              max="180"
              step="1"
              disabled={!enabled}
              onChange={(e) =>
                handleSensorsChange("fleeAngle", parseFloat(e.target.value))
              }
              className={`slider ${!enabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
