import { radToDeg, degToRad } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useSensors } from "../../hooks/modules/useSensors";

export function SensorsModule({ enabled = true }: { enabled?: boolean }) {
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
    setDistance,
    setAngle,
    setRadius,
    setThreshold,
    setStrength,
    setFollowValue,
    setFleeValue,
    setColorSimilarityThreshold,
    setFleeAngle,
  } = useSensors();

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
        onChange={setDistance}
        disabled={!enabled}
      />
      <Slider
        label="Angle"
        value={sensorAngleDegrees}
        min={2}
        max={90}
        step={1}
        onChange={(v) => setAngle(degToRad(v))}
        formatValue={(v) => `${v.toFixed(0)}°`}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={sensorRadius}
        min={0}
        max={10}
        step={1}
        onChange={setRadius}
        disabled={!enabled}
      />
      <Slider
        label="Threshold"
        value={sensorThreshold}
        min={0.01}
        max={0.2}
        step={0.01}
        onChange={setThreshold}
        disabled={!enabled}
      />
      <Slider
        label="Strength"
        value={sensorStrength}
        min={0}
        max={3000}
        step={1}
        onChange={setStrength}
        disabled={!enabled}
      />
      <Dropdown
        label="Follow Behavior"
        value={followValue}
        onChange={setFollowValue}
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
        onChange={setFleeValue}
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
          onChange={setColorSimilarityThreshold}
          disabled={!enabled}
        />
      )}
      {showFleeAngle && (
        <Slider
          label="Flee Angle"
          value={fleeAngleDegrees}
          onChange={(v) => setFleeAngle(degToRad(v))}
          disabled={!enabled}
        />
      )}
    </>
  );
}
