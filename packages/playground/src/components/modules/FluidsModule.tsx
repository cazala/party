import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { Dropdown } from "../ui/Dropdown";
import { useFluids } from "../../hooks/modules/useFluids";
import { FluidsMethod } from "@cazala/party";

export function FluidsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    method,
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    flipRatio,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
    setMethod,
    setInfluenceRadius,
    setTargetDensity,
    setPressureMultiplier,
    setViscosity,
    setFlipRatio,
    setNearPressureMultiplier,
    setNearThreshold,
    setEnableNearPressure,
    setMaxAcceleration,
  } = useFluids();

  const isPicflip = method === FluidsMethod.Picflip;

  return (
    <>
      <Dropdown
        label="Method"
        value={method}
        onChange={(v) => setMethod(v as FluidsMethod)}
        options={[
          { value: FluidsMethod.Sph, label: "SPH" },
          { value: FluidsMethod.Picflip, label: "PIC/FLIP" },
        ]}
        disabled={!enabled}
      />
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
      {!isPicflip && (
        <Slider
          sliderId="fluids.maxAcceleration"
          label="Max Acceleration"
          value={maxAcceleration}
          min={0}
          max={100}
          step={1}
          formatValue={(v) => v.toFixed(0)}
          onChange={setMaxAcceleration}
          disabled={!enabled}
        />
      )}
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
        formatValue={(v) => v.toFixed(0)}
        onChange={setPressureMultiplier}
        disabled={!enabled}
      />
      {!isPicflip && (
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
      )}
      {isPicflip ? (
        <Slider
          sliderId="fluids.flipRatio"
          label="PIC/FLIP Ratio"
          value={flipRatio}
          min={0}
          max={1}
          step={0.01}
          formatValue={(v) => v.toFixed(2)}
          onChange={setFlipRatio}
          disabled={!enabled}
        />
      ) : (
        <>
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
      )}
    </>
  );
}
