import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useFluids } from "../../hooks/modules/useFluids";

export function FluidsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
    setInfluenceRadius,
    setTargetDensity,
    setPressureMultiplier,
    setViscosity,
    setNearPressureMultiplier,
    setNearThreshold,
    setEnableNearPressure,
    setMaxAcceleration,
  } = useFluids();

  return (
    <>
      <Slider
        sliderId="fluids.influenceRadius"
        label="Influence Radius"
        value={influenceRadius}
        min={1}
        max={100}
        step={1}
        onChange={setInfluenceRadius}
        disabled={!enabled}
      />
      <Slider
        sliderId="fluids.maxAcceleration"
        label="Max Acceleration"
        value={maxAcceleration}
        min={0}
        max={100}
        step={1}
        onChange={setMaxAcceleration}
        disabled={!enabled}
      />
      <Slider
        sliderId="fluids.targetDensity"
        label="Density"
        value={targetDensity}
        min={0}
        max={5}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setTargetDensity}
        disabled={!enabled}
      />
      <Slider
        sliderId="fluids.pressureMultiplier"
        label="Pressure"
        value={pressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setPressureMultiplier}
        disabled={!enabled}
      />
      <Slider
        sliderId="fluids.viscosity"
        label="Viscosity"
        value={viscosity}
        min={0}
        max={10}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
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
        sliderId="fluids.nearPressureMultiplier"
        label="Near Pressure"
        value={nearPressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={setNearPressureMultiplier}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        sliderId="fluids.nearThreshold"
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
