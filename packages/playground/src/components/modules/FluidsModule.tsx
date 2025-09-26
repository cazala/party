import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useModules } from "../../hooks/useModules";

export function FluidsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    fluidsState,
    setFluidsInfluenceRadius,
    setFluidsTargetDensity,
    setFluidsPressureMultiplier,
    setFluidsViscosity,
    setFluidsNearPressureMultiplier,
    setFluidsNearThreshold,
    setFluidsEnableNearPressure,
    setFluidsMaxAcceleration,
  } = useModules();

  const {
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
  } = fluidsState;

  return (
    <>
      <Slider
        label="Influence Radius"
        value={influenceRadius}
        min={1}
        max={100}
        step={1}
        onChange={setFluidsInfluenceRadius}
        disabled={!enabled}
      />
      <Slider
        label="Max Acceleration"
        value={maxAcceleration}
        min={0}
        max={100}
        step={1}
        onChange={setFluidsMaxAcceleration}
        disabled={!enabled}
      />
      <Slider
        label="Density"
        value={targetDensity}
        min={0}
        max={5}
        step={0.01}
        onChange={setFluidsTargetDensity}
        disabled={!enabled}
      />
      <Slider
        label="Pressure"
        value={pressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setFluidsPressureMultiplier}
        disabled={!enabled}
      />
      <Slider
        label="Viscosity"
        value={viscosity}
        min={0}
        max={10}
        step={0.01}
        onChange={setFluidsViscosity}
        disabled={!enabled}
      />
      <Checkbox
        label="Enable Near Pressure"
        checked={enableNearPressure}
        onChange={setFluidsEnableNearPressure}
        disabled={!enabled}
      />
      <Slider
        label="Near Pressure"
        value={nearPressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setFluidsNearPressureMultiplier}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        label="Near Threshold"
        value={nearThreshold}
        min={0}
        max={100}
        step={1}
        onChange={setFluidsNearThreshold}
        disabled={!enabled || !enableNearPressure}
      />
    </>
  );
}
