import { useState } from "react";
import {
  DEFAULT_SENSORS_SENSOR_DISTANCE,
  DEFAULT_SENSORS_SENSOR_ANGLE,
  DEFAULT_SENSORS_SENSOR_RADIUS,
  DEFAULT_SENSORS_SENSOR_THRESHOLD,
  DEFAULT_SENSORS_SENSOR_STRENGTH,
  DEFAULT_SENSORS_FOLLOW_BEHAVIOR,
  DEFAULT_SENSORS_FLEE_BEHAVIOR,
  DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD,
  DEFAULT_SENSORS_FLEE_ANGLE,
  Sensors,
  type SensorBehavior,
  radToDeg,
  degToRad,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";

export function SensorsModule({
  sensors,
  enabled = true,
}: {
  sensors: Sensors | null;
  enabled?: boolean;
}) {
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
  const [followValue, setFollowValue] = useState<string>(
    DEFAULT_SENSORS_FOLLOW_BEHAVIOR
  );
  const [fleeValue, setFleeValue] = useState<string>(
    DEFAULT_SENSORS_FLEE_BEHAVIOR
  );
  const [colorSimilarityThreshold, setColorSimilarityThreshold] = useState(
    DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD
  );
  const [fleeAngle, setFleeAngle] = useState(
    radToDeg(DEFAULT_SENSORS_FLEE_ANGLE)
  );

  // Visibility helpers for conditional controls
  const showColorSimilarity =
    followValue === "same" ||
    followValue === "different" ||
    fleeValue === "same" ||
    fleeValue === "different";
  const showFleeAngle = fleeValue !== "none";

  return (
    <>
      <Slider
        label="Distance"
        min={3}
        max={100}
        step={1}
        value={sensorDistance}
        onChange={(v) => {
          setSensorDistance(v);
          sensors?.setSensorDistance(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Angle"
        value={sensorAngle}
        min={2}
        max={90}
        step={1}
        onChange={(v) => {
          setSensorAngle(v);
          sensors?.setSensorAngle(degToRad(v));
        }}
        formatValue={(v) => `${v.toFixed(0)}°`}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={sensorRadius}
        min={0}
        max={10}
        step={1}
        onChange={(v) => {
          setSensorRadius(v);
          sensors?.setSensorRadius(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Threshold"
        value={sensorThreshold}
        min={0.01}
        max={0.2}
        step={0.01}
        onChange={(v) => {
          setSensorThreshold(v);
          sensors?.setSensorThreshold(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Strength"
        value={sensorStrength}
        min={0}
        max={3000}
        step={1}
        onChange={(v) => {
          setSensorStrength(v);
          sensors?.setSensorStrength(v);
        }}
        disabled={!enabled}
      />
      <Dropdown
        label="Follow Behavior"
        value={followValue}
        onChange={(v) => {
          setFollowValue(v);
          sensors?.setFollowBehavior(v as SensorBehavior);
        }}
        disabled={!enabled}
        options={[
          { value: "none", label: "None" },
          { value: "any", label: "Any" },
          { value: "same", label: "Same" },
          { value: "different", label: "Different" },
        ]}
      />
      <Dropdown
        label="Flee Behavior"
        value={fleeValue}
        onChange={(v) => {
          setFleeValue(v);
          sensors?.setFleeBehavior(v as SensorBehavior);
        }}
        disabled={!enabled}
        options={[
          { value: "none", label: "None" },
          { value: "any", label: "Any" },
          { value: "same", label: "Same" },
          { value: "different", label: "Different" },
        ]}
      />
      {showColorSimilarity && (
        <Slider
          label="Color Similarity Threshold"
          value={colorSimilarityThreshold}
          onChange={(v) => {
            setColorSimilarityThreshold(v);
            sensors?.setColorSimilarityThreshold(v);
          }}
          disabled={!enabled}
        />
      )}
      {showFleeAngle && (
        <Slider
          label="Flee Angle"
          value={fleeAngle}
          onChange={(v) => {
            setFleeAngle(v);
            sensors?.setFleeAngle(degToRad(v));
          }}
          disabled={!enabled}
        />
      )}
    </>
  );
}
