import { useState } from "react";
import {
  DEFAULT_FLUIDS_INFLUENCE_RADIUS,
  DEFAULT_FLUIDs_TARGET_DENSITY,
  DEFAULT_FLUIDS_PRESSURE_MULTIPLIER,
  DEFAULT_FLUIDS_VISCOSITY,
  DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_FLUIDS_NEAR_THRESHOLD,
  DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE,
  DEFAULT_FLUIDS_MAX_ACCELERATION,
  Fluids,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";

export function FluidsModule({
  fluids,
  enabled = true,
}: {
  fluids: Fluids | null;
  enabled?: boolean;
}) {
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_FLUIDS_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(
    DEFAULT_FLUIDs_TARGET_DENSITY
  );
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_FLUIDS_PRESSURE_MULTIPLIER
  );
  const [viscosity, setViscosity] = useState(DEFAULT_FLUIDS_VISCOSITY);
  const [nearPressureMultiplier, setNearPressureMultiplier] = useState(
    DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER
  );
  const [nearThreshold, setNearThreshold] = useState(
    DEFAULT_FLUIDS_NEAR_THRESHOLD
  );
  const [enableNearPressure, setEnableNearPressure] = useState(
    DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE
  );
  const [maxAcceleration, setMaxAcceleration] = useState(
    DEFAULT_FLUIDS_MAX_ACCELERATION
  );

  return (
    <>
      <Slider
        label="Influence Radius"
        value={influenceRadius}
        onChange={(v) => {
          setInfluenceRadius(v);
          fluids?.setInfluenceRadius(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Max Acceleration"
        value={maxAcceleration}
        onChange={(v) => {
          setMaxAcceleration(v);
          fluids?.setMaxAcceleration(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Density"
        value={targetDensity}
        onChange={(v) => {
          setTargetDensity(v);
          fluids?.setTargetDensity(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Pressure"
        value={pressureMultiplier}
        onChange={(v) => {
          setPressureMultiplier(v);
          fluids?.setPressureMultiplier(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Viscosity"
        value={viscosity}
        onChange={(v) => {
          setViscosity(v);
          fluids?.setViscosity(v);
        }}
        disabled={!enabled}
      />
      <Checkbox
        label="Enable Near Pressure"
        checked={enableNearPressure}
        onChange={(v) => {
          setEnableNearPressure(v);
          fluids?.setEnableNearPressure(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Near Pressure"
        value={nearPressureMultiplier}
        onChange={(v) => {
          setNearPressureMultiplier(v);
          fluids?.setNearPressureMultiplier(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        label="Near Threshold"
        value={nearThreshold}
        onChange={(v) => {
          setNearThreshold(v);
          fluids?.setNearThreshold(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
    </>
  );
}
