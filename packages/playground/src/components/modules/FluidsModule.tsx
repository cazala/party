import { useEffect } from "react";
import { Fluids } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectFluidsModule,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
} from "../../modules/modules/slice";

export function FluidsModule({
  fluids,
  enabled = true,
}: {
  fluids: Fluids | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const fluidsState = useAppSelector(selectFluidsModule);
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

  // Sync Redux state with fluids module when fluids is available
  useEffect(() => {
    if (fluids && enabled) {
      fluids.setInfluenceRadius(influenceRadius);
      fluids.setTargetDensity(targetDensity);
      fluids.setPressureMultiplier(pressureMultiplier);
      fluids.setViscosity(viscosity);
      fluids.setNearPressureMultiplier(nearPressureMultiplier);
      fluids.setNearThreshold(nearThreshold);
      fluids.setEnableNearPressure(enableNearPressure);
      fluids.setMaxAcceleration(maxAcceleration);
    }
  }, [
    fluids,
    enabled,
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
  ]);

  return (
    <>
      <Slider
        label="Influence Radius"
        value={influenceRadius}
        min={1}
        max={100}
        step={1}
        onChange={(v) => {
          dispatch(setFluidsInfluenceRadius(v));
          fluids?.setInfluenceRadius(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Max Acceleration"
        value={maxAcceleration}
        min={0}
        max={100}
        step={1}
        onChange={(v) => {
          dispatch(setFluidsMaxAcceleration(v));
          fluids?.setMaxAcceleration(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Density"
        value={targetDensity}
        min={0}
        max={5}
        step={0.01}
        onChange={(v) => {
          dispatch(setFluidsTargetDensity(v));
          fluids?.setTargetDensity(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Pressure"
        value={pressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={(v) => {
          dispatch(setFluidsPressureMultiplier(v));
          fluids?.setPressureMultiplier(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Viscosity"
        value={viscosity}
        min={0}
        max={10}
        step={0.01}
        onChange={(v) => {
          dispatch(setFluidsViscosity(v));
          fluids?.setViscosity(v);
        }}
        disabled={!enabled}
      />
      <Checkbox
        label="Enable Near Pressure"
        checked={enableNearPressure}
        onChange={(v) => {
          dispatch(setFluidsEnableNearPressure(v));
          fluids?.setEnableNearPressure(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Near Pressure"
        value={nearPressureMultiplier}
        min={0}
        max={100}
        step={1}
        onChange={(v) => {
          dispatch(setFluidsNearPressureMultiplier(v));
          fluids?.setNearPressureMultiplier(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
      <Slider
        label="Near Threshold"
        value={nearThreshold}
        min={0}
        max={100}
        step={1}
        onChange={(v) => {
          dispatch(setFluidsNearThreshold(v));
          fluids?.setNearThreshold(v);
        }}
        disabled={!enabled || !enableNearPressure}
      />
    </>
  );
}
