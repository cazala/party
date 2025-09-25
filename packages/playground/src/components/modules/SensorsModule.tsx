import { useEffect } from "react";
import {
  Sensors,
  type SensorBehavior,
  radToDeg,
  degToRad,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectSensorsModule,
  setSensorDistance,
  setSensorAngle,
  setSensorRadius,
  setSensorThreshold,
  setSensorStrength,
  setSensorFollowValue,
  setSensorFleeValue,
  setSensorColorSimilarityThreshold,
  setSensorFleeAngle,
} from "../../modules/modules/slice";

export function SensorsModule({
  sensors,
  enabled = true,
}: {
  sensors: Sensors | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const sensorsState = useAppSelector(selectSensorsModule);
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
  
  // Sync Redux state with sensors module when sensors is available
  useEffect(() => {
    if (sensors && enabled) {
      sensors.setSensorDistance(sensorDistance);
      sensors.setSensorAngle(sensorAngle); // sensorAngle is already in radians
      sensors.setSensorRadius(sensorRadius);
      sensors.setSensorThreshold(sensorThreshold);
      sensors.setSensorStrength(sensorStrength);
      sensors.setFollowBehavior(followValue as SensorBehavior);
      sensors.setFleeBehavior(fleeValue as SensorBehavior);
      sensors.setColorSimilarityThreshold(colorSimilarityThreshold);
      sensors.setFleeAngle(fleeAngle); // fleeAngle is already in radians
    }
  }, [sensors, enabled, sensorDistance, sensorAngle, sensorRadius, sensorThreshold, sensorStrength, followValue, fleeValue, colorSimilarityThreshold, fleeAngle]);

  return (
    <>
      <Slider
        label="Distance"
        min={3}
        max={100}
        step={1}
        value={sensorDistance}
        onChange={(v) => {
          dispatch(setSensorDistance(v));
          sensors?.setSensorDistance(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Angle"
        value={sensorAngleDegrees}
        min={2}
        max={90}
        step={1}
        onChange={(v) => {
          dispatch(setSensorAngle(degToRad(v)));
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
          dispatch(setSensorRadius(v));
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
          dispatch(setSensorThreshold(v));
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
          dispatch(setSensorStrength(v));
          sensors?.setSensorStrength(v);
        }}
        disabled={!enabled}
      />
      <Dropdown
        label="Follow Behavior"
        value={followValue}
        onChange={(v) => {
          dispatch(setSensorFollowValue(v));
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
          dispatch(setSensorFleeValue(v));
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
            dispatch(setSensorColorSimilarityThreshold(v));
            sensors?.setColorSimilarityThreshold(v);
          }}
          disabled={!enabled}
        />
      )}
      {showFleeAngle && (
        <Slider
          label="Flee Angle"
          value={fleeAngleDegrees}
          onChange={(v) => {
            dispatch(setSensorFleeAngle(degToRad(v)));
            sensors?.setFleeAngle(degToRad(v));
          }}
          disabled={!enabled}
        />
      )}
    </>
  );
}
