import { radToDeg, degToRad } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useModules } from "../../hooks/useModules";

export function SensorsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    sensorsState,
    setSensorDistance,
    setSensorAngle,
    setSensorRadius,
    setSensorThreshold,
    setSensorStrength,
    setSensorFollowValue,
    setSensorFleeValue,
    setSensorColorSimilarityThreshold,
    setSensorFleeAngle,
  } = useModules();

  const {
    sensorDistance,
    sensorAngle,
    sensorRadius,
    sensorThreshold,
    sensorStrength,
    followValue,
    fleeValue,
    colorSimilarityThreshold,
    fleeAngle,
  } = sensorsState;

  // Convert radians to degrees for display
  const sensorAngleDegrees = radToDeg(sensorAngle);
  const fleeAngleDegrees = radToDeg(fleeAngle);

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
        onChange={setSensorDistance}
        disabled={!enabled}
      />
      <Slider
        label="Angle"
        value={sensorAngleDegrees}
        min={2}
        max={90}
        step={1}
        onChange={(v) => setSensorAngle(degToRad(v))}
        formatValue={(v) => `${v.toFixed(0)}°`}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={sensorRadius}
        min={0}
        max={10}
        step={1}
        onChange={setSensorRadius}
        disabled={!enabled}
      />
      <Slider
        label="Threshold"
        value={sensorThreshold}
        min={0.01}
        max={0.2}
        step={0.01}
        onChange={setSensorThreshold}
        disabled={!enabled}
      />
      <Slider
        label="Strength"
        value={sensorStrength}
        min={0}
        max={3000}
        step={1}
        onChange={setSensorStrength}
        disabled={!enabled}
      />
      <Dropdown
        label="Follow Behavior"
        value={followValue}
        onChange={setSensorFollowValue}
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
        onChange={setSensorFleeValue}
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
          onChange={setSensorColorSimilarityThreshold}
          disabled={!enabled}
        />
      )}
      {showFleeAngle && (
        <Slider
          label="Flee Angle"
          value={fleeAngleDegrees}
          onChange={(v) => setSensorFleeAngle(degToRad(v))}
          disabled={!enabled}
        />
      )}
    </>
  );
}
