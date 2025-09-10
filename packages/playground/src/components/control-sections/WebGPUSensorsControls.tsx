import { useEffect, useState } from "react";

export type SensorBehavior = "any" | "same" | "different" | "none";

interface WebGPUSensorsLike {
  setEnableTrail: (v: boolean) => void;
  setTrailDecay: (v: number) => void;
  setTrailDiffuse: (v: number) => void;
  setEnableSensors: (v: boolean) => void;
  setSensorDistance: (v: number) => void;
  setSensorAngle: (v: number) => void;
  setSensorRadius: (v: number) => void;
  setSensorThreshold: (v: number) => void;
  setSensorStrength: (v: number) => void;
  setColorSimilarityThreshold: (v: number) => void;
  setFollowBehavior: (v: SensorBehavior) => void;
  setFleeBehavior: (v: SensorBehavior) => void;
  setFleeAngle: (v: number) => void;
  setParticleColor: (v: string) => void;
  setEnabled?: (v: boolean) => void;
}

// Default constants matching the WebGPU sensors implementation
const DEFAULT_TRAIL_ENABLED = false;
const DEFAULT_TRAIL_DECAY = 0.1;
const DEFAULT_TRAIL_DIFFUSE = 1;
const DEFAULT_SENSORS_ENABLED = false;
const DEFAULT_SENSOR_DISTANCE = 30;
const DEFAULT_SENSOR_ANGLE = Math.PI / 6; // 30 degrees in radians
const DEFAULT_SENSOR_RADIUS = 3;
const DEFAULT_SENSOR_THRESHOLD = 0.1;
const DEFAULT_SENSOR_STRENGTH = 1000;
const DEFAULT_COLOR_SIMILARITY_THRESHOLD = 0.4;
const DEFAULT_FOLLOW_BEHAVIOR: SensorBehavior = "any";
const DEFAULT_FLEE_BEHAVIOR: SensorBehavior = "none";
const DEFAULT_FLEE_ANGLE = Math.PI / 2; // 90 degrees in radians

// Helper functions
const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
const degToRad = (deg: number): number => (deg * Math.PI) / 180;

export function WebGPUSensorsControls({
  sensors,
  hideEnabled = false,
  enabled = true,
}: {
  sensors: WebGPUSensorsLike | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(true);
  
  // Trail state
  const [trailEnabled, setTrailEnabled] = useState(DEFAULT_TRAIL_ENABLED);
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(DEFAULT_TRAIL_DIFFUSE);

  // Sensor state
  const [sensorsEnabled, setSensorsEnabled] = useState(DEFAULT_SENSORS_ENABLED);
  const [sensorDistance, setSensorDistance] = useState(DEFAULT_SENSOR_DISTANCE);
  const [sensorAngle, setSensorAngle] = useState(radToDeg(DEFAULT_SENSOR_ANGLE));
  const [sensorRadius, setSensorRadius] = useState(DEFAULT_SENSOR_RADIUS);
  const [sensorThreshold, setSensorThreshold] = useState(DEFAULT_SENSOR_THRESHOLD);
  const [sensorStrength, setSensorStrength] = useState(DEFAULT_SENSOR_STRENGTH);
  const [colorSimilarityThreshold, setColorSimilarityThreshold] = useState(DEFAULT_COLOR_SIMILARITY_THRESHOLD);
  const [fleeAngle, setFleeAngle] = useState(radToDeg(DEFAULT_FLEE_ANGLE));

  // Behavior state
  const [followBehavior, setFollowBehavior] = useState<SensorBehavior>(DEFAULT_FOLLOW_BEHAVIOR);
  const [fleeBehavior, setFleeBehavior] = useState<SensorBehavior>(DEFAULT_FLEE_BEHAVIOR);
  
  // Particle color
  const [particleColor, setParticleColor] = useState("#ffffff");

  useEffect(() => {
    // Could hydrate from module if getters existed
  }, [sensors]);

  useEffect(() => {
    if (!trailEnabled && sensorsEnabled) {
      handleSensorsChange("enableSensors", false);
    }
  }, [trailEnabled, sensorsEnabled]);

  const handleSensorsChange = (
    property: string,
    value: number | boolean | SensorBehavior | string
  ) => {
    if (!sensors || !enabled) return;

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
      case "colorSimilarityThreshold":
        setColorSimilarityThreshold(value as number);
        sensors.setColorSimilarityThreshold(value as number);
        break;
      case "fleeAngle":
        setFleeAngle(value as number); // Store degrees in UI state
        sensors.setFleeAngle(degToRad(value as number)); // Convert to radians for core library
        break;
      case "followBehavior":
        setFollowBehavior(value as SensorBehavior);
        sensors.setFollowBehavior(value as SensorBehavior);
        break;
      case "fleeBehavior":
        setFleeBehavior(value as SensorBehavior);
        sensors.setFleeBehavior(value as SensorBehavior);
        break;
      case "particleColor":
        setParticleColor(value as string);
        sensors.setParticleColor(value as string);
        break;
    }
  };

  const behaviorOptions: SensorBehavior[] = [
    "none",
    "any",
    "same",
    "different",
  ];

  // Helper functions for conditional visibility
  const showColorSimilarity =
    followBehavior === "same" ||
    followBehavior === "different" ||
    fleeBehavior === "same" ||
    fleeBehavior === "different";
  const showFleeAngle = fleeBehavior !== "none";
  const showParticleColor = showColorSimilarity;

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

      {/* Trail Section */}
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={trailEnabled}
            disabled={!enabled}
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
            min="0.001"
            max="2"
            step="0.001"
            value={trailDecay}
            disabled={!enabled || !trailEnabled}
            onChange={(e) =>
              handleSensorsChange("trailDecay", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !trailEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Trail Diffuse: {trailDiffuse}px
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={trailDiffuse}
            disabled={!enabled || !trailEnabled}
            onChange={(e) =>
              handleSensorsChange("trailDiffuse", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !trailEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      {/* Sensors Section */}
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={sensorsEnabled}
            disabled={!enabled || !trailEnabled}
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
          Distance: {sensorDistance}
          <input
            type="range"
            min="5"
            max="100"
            step="1"
            value={sensorDistance}
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorDistance", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
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
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorAngle", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
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
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorRadius", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
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
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorThreshold", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
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
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("sensorStrength", parseFloat(e.target.value))
            }
            className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      {/* Behavior Controls */}
      <div className="control-group">
        <label>
          Follow:
          <select
            value={followBehavior}
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("followBehavior", e.target.value as SensorBehavior)
            }
            className={`form-select ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
          >
            {behaviorOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          Flee:
          <select
            value={fleeBehavior}
            disabled={!enabled || !sensorsEnabled}
            onChange={(e) =>
              handleSensorsChange("fleeBehavior", e.target.value as SensorBehavior)
            }
            className={`form-select ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
          >
            {behaviorOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Conditional Controls */}
      {showColorSimilarity && (
        <div className="control-group">
          <label>
            Color Similarity: {colorSimilarityThreshold.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={colorSimilarityThreshold}
              disabled={!enabled || !sensorsEnabled}
              onChange={(e) =>
                handleSensorsChange("colorSimilarityThreshold", parseFloat(e.target.value))
              }
              className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}

      {showParticleColor && (
        <div className="control-group">
          <label>
            Particle Color:
            <input
              type="color"
              value={particleColor}
              disabled={!enabled || !sensorsEnabled}
              onChange={(e) =>
                handleSensorsChange("particleColor", e.target.value)
              }
              className={`form-control ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}

      {showFleeAngle && (
        <div className="control-group">
          <label>
            Flee Angle: {Math.round(fleeAngle)}°
            <input
              type="range"
              min="0"
              max="180"
              step="1"
              value={fleeAngle}
              disabled={!enabled || !sensorsEnabled}
              onChange={(e) =>
                handleSensorsChange("fleeAngle", parseFloat(e.target.value))
              }
              className={`slider ${!enabled || !sensorsEnabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}
    </div>
  );
}