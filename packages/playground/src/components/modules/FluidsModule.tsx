import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useFluids } from "../../hooks/modules/useFluids";

export function FluidsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    state,
    setInfluenceRadius,
    setTargetDensity,
    setPressureMultiplier,
    setViscosity,
    setNearPressureMultiplier,
    setNearThreshold,
    setEnableNearPressure,
    setMaxAcceleration,
  } = useFluids();

  const {
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
  } = state;

  return (
    <>
      <Slider
        label="Influence Radius"
        value={influenceRadius}
        min={1}
        max={100}
        step={1}
        onChange={setInfluenceRadius}
        disabled={!enabled}
      />
      <Slider
        label="Max Acceleration"
        value={maxAcceleration}
        min={0}
        max={100}
        step={1}
        onChange={setMaxAcceleration}
        disabled={!enabled}
      />
      <Slider
        label="Density"
        value={targetDensity}
        min={0}
        max={5}
        step={0.01}
        onChange={setTargetDensity}
        disabled={!enabled}
      />
      <Slider
        label="Pressure"
        value={pressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setPressureMultiplier}
        disabled={!enabled}
      />
      <Slider
        label="Viscosity"
        value={viscosity}
        min={0}
        max={10}
        step={0.01}
        onChange={setViscosity}
        disabled={!enabled}
      />
      <Checkbox
        label="Enable Near Pressure"
        checked={enableNearPressure}
        onChange={setEnableNearPressure}
        disabled={!enabled}
      />
      <Slider
        label="Near Pressure"
        value={nearPressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setNearPressureMultiplier}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        label="Near Threshold"
        value={nearThreshold}
        min={0}
        max={100}
        step={1}
        onChange={setNearThreshold}
        disabled={!enabled || !enableNearPressure}
      />
    </>
  );
}
