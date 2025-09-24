import { useState } from "react";
import {
  DEFAULT_FLUID_INFLUENCE_RADIUS,
  DEFAULT_FLUID_TARGET_DENSITY,
  DEFAULT_FLUID_PRESSURE_MULTIPLIER,
  DEFAULT_FLUID_VISCOSITY,
  DEFAULT_FLUID_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_FLUID_NEAR_THRESHOLD,
  DEFAULT_FLUID_ENABLE_NEAR_PRESSURE,
  DEFAULT_FLUID_MAX_ACCELERATION,
  Fluid,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";

export function FluidModule({
  fluid,
  enabled = true,
}: {
  fluid: Fluid | null;
  enabled?: boolean;
}) {
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_FLUID_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(
    DEFAULT_FLUID_TARGET_DENSITY
  );
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_FLUID_PRESSURE_MULTIPLIER
  );
  const [viscosity, setViscosity] = useState(DEFAULT_FLUID_VISCOSITY);
  const [nearPressureMultiplier, setNearPressureMultiplier] = useState(
    DEFAULT_FLUID_NEAR_PRESSURE_MULTIPLIER
  );
  const [nearThreshold, setNearThreshold] = useState(
    DEFAULT_FLUID_NEAR_THRESHOLD
  );
  const [enableNearPressure, setEnableNearPressure] = useState(
    DEFAULT_FLUID_ENABLE_NEAR_PRESSURE
  );
  const [maxAcceleration, setMaxAcceleration] = useState(
    DEFAULT_FLUID_MAX_ACCELERATION
  );

  return (
    <>
      <Slider
        label="Influence Radius"
        value={influenceRadius}
        onChange={(v) => {
          setInfluenceRadius(v);
          fluid?.setInfluenceRadius(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Max Acceleration"
        value={maxAcceleration}
        onChange={(v) => {
          setMaxAcceleration(v);
          fluid?.setMaxAcceleration(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Density"
        value={targetDensity}
        onChange={(v) => {
          setTargetDensity(v);
          fluid?.setTargetDensity(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Pressure"
        value={pressureMultiplier}
        onChange={(v) => {
          setPressureMultiplier(v);
          fluid?.setPressureMultiplier(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Viscosity"
        value={viscosity}
        onChange={(v) => {
          setViscosity(v);
          fluid?.setViscosity(v);
        }}
        disabled={!enabled}
      />
      <Checkbox
        label="Enable Near Pressure"
        checked={enableNearPressure}
        onChange={(v) => {
          setEnableNearPressure(v);
          fluid?.setEnableNearPressure(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Near Pressure"
        value={nearPressureMultiplier}
        onChange={(v) => {
          setNearPressureMultiplier(v);
          fluid?.setNearPressureMultiplier(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        label="Near Threshold"
        value={nearThreshold}
        onChange={(v) => {
          setNearThreshold(v);
          fluid?.setNearThreshold(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
    </>
  );
}
