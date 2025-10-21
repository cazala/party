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
        sliderId="sensors.sensorDistance"
        label="Distance"
        min={3}
        max={100}
        step={1}
        value={sensorDistance}
        onChange={setDistance}
        disabled={!enabled}
      />
      <Slider
        sliderId="sensors.sensorAngle"
        label="Angle"
        value={sensorAngleDegrees}
        min={2}
        max={90}
        step={1}
        onChange={(v) => setAngle(degToRad(v))}
        formatValue={(v) => `${v.toFixed(0)}°`}
        toEngine={(deg) => degToRad(deg)}
        fromEngine={(rad) => radToDeg(rad)}
        disabled={!enabled}
      />
      <Slider
        sliderId="sensors.sensorRadius"
        label="Radius"
        value={sensorRadius}
        min={0}
        max={10}
        step={1}
        onChange={setRadius}
        disabled={!enabled}
      />
      <Slider
        sliderId="sensors.sensorThreshold"
        label="Threshold"
        value={sensorThreshold}
        min={0.01}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setThreshold}
        disabled={!enabled}
      />
      <Slider
        sliderId="sensors.sensorStrength"
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
        onChange={setFollowValue as (value: string) => void}
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
        onChange={setFleeValue as (value: string) => void}
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
          sliderId="sensors.colorSimilarityThreshold"
          label="Color Similarity Threshold"
          value={colorSimilarityThreshold}
          min={0}
          max={1}
          step={0.01}
          formatValue={(v) => v.toFixed(2)}
          onChange={setColorSimilarityThreshold}
          disabled={!enabled}
        />
      )}
      {showFleeAngle && (
        <Slider
          sliderId="sensors.fleeAngle"
          label="Flee Angle"
          value={fleeAngleDegrees}
          onChange={(v) => setFleeAngle(degToRad(v))}
          disabled={!enabled}
        />
      )}
    </>
  );
}
