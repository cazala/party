import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectFluids,
  setFluidsEnabled,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
} from "../../slices/modules/fluids";

export function useFluids() {
  const dispatch = useAppDispatch();
  const { fluids } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectFluids(modulesState), [modulesState]);

  // Destructure individual properties
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
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (fluids) {
      fluids.setInfluenceRadius(state.influenceRadius);
      fluids.setTargetDensity(state.targetDensity);
      fluids.setPressureMultiplier(state.pressureMultiplier);
      fluids.setViscosity(state.viscosity);
      fluids.setNearPressureMultiplier(state.nearPressureMultiplier);
      fluids.setNearThreshold(state.nearThreshold);
      fluids.setEnableNearPressure(state.enableNearPressure);
      fluids.setMaxAcceleration(state.maxAcceleration);
    }
  }, [fluids, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setFluidsEnabled(enabled));
    },
    [dispatch]
  );

  const setInfluenceRadius = useCallback(
    (value: number) => {
      dispatch(setFluidsInfluenceRadius(value));
      fluids?.setInfluenceRadius(value);
    },
    [dispatch, fluids]
  );

  const setTargetDensity = useCallback(
    (value: number) => {
      dispatch(setFluidsTargetDensity(value));
      fluids?.setTargetDensity(value);
    },
    [dispatch, fluids]
  );

  const setPressureMultiplier = useCallback(
    (value: number) => {
      dispatch(setFluidsPressureMultiplier(value));
      fluids?.setPressureMultiplier(value);
    },
    [dispatch, fluids]
  );

  const setViscosity = useCallback(
    (value: number) => {
      dispatch(setFluidsViscosity(value));
      fluids?.setViscosity(value);
    },
    [dispatch, fluids]
  );

  const setNearPressureMultiplier = useCallback(
    (value: number) => {
      dispatch(setFluidsNearPressureMultiplier(value));
      fluids?.setNearPressureMultiplier(value);
    },
    [dispatch, fluids]
  );

  const setNearThreshold = useCallback(
    (value: number) => {
      dispatch(setFluidsNearThreshold(value));
      fluids?.setNearThreshold(value);
    },
    [dispatch, fluids]
  );

  const setEnableNearPressure = useCallback(
    (value: boolean) => {
      dispatch(setFluidsEnableNearPressure(value));
      fluids?.setEnableNearPressure(value);
    },
    [dispatch, fluids]
  );

  const setMaxAcceleration = useCallback(
    (value: number) => {
      dispatch(setFluidsMaxAcceleration(value));
      fluids?.setMaxAcceleration(value);
    },
    [dispatch, fluids]
  );

  return {
    // Individual state properties
    influenceRadius,
    targetDensity,
    pressureMultiplier,
    viscosity,
    nearPressureMultiplier,
    nearThreshold,
    enableNearPressure,
    maxAcceleration,
    isEnabled,
    // Actions
    setEnabled,
    setInfluenceRadius,
    setTargetDensity,
    setPressureMultiplier,
    setViscosity,
    setNearPressureMultiplier,
    setNearThreshold,
    setEnableNearPressure,
    setMaxAcceleration,
  };
}
