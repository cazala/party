import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectPicflip,
  setPicflipEnabled,
  setPicflipGridResolution,
  setPicflipFlipRatio,
  setPicflipPressureIterations,
  setPicflipOverrelaxation,
  setPicflipDensity,
  setPicflipRadius,
  setPicflipPressure,
  resetPicflip,
} from "../../slices/modules/picflip";

export function usePicflip() {
  const dispatch = useAppDispatch();
  const { picflip } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectPicflip(modulesState), [modulesState]);

  // Destructure individual properties
  const {
    gridResolution,
    flipRatio,
    pressureIterations,
    overrelaxation,
    density,
    radius,
    pressure,
  } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (picflip) {
      picflip.setGridResolution(state.gridResolution);
      picflip.setFlipRatio(state.flipRatio);
      picflip.setPressureIterations(state.pressureIterations);
      picflip.setOverrelaxation(state.overrelaxation);
      picflip.setDensity(state.density);
      picflip.setRadius(state.radius);
      picflip.setPressure(state.pressure);
    }
  }, [picflip, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setPicflipEnabled(enabled));
    },
    [dispatch]
  );

  const setGridResolution = useCallback(
    (value: number) => {
      dispatch(setPicflipGridResolution(value));
      picflip?.setGridResolution(value);
    },
    [dispatch, picflip]
  );

  const setFlipRatio = useCallback(
    (value: number) => {
      dispatch(setPicflipFlipRatio(value));
      picflip?.setFlipRatio(value);
    },
    [dispatch, picflip]
  );

  const setPressureIterations = useCallback(
    (value: number) => {
      dispatch(setPicflipPressureIterations(value));
      picflip?.setPressureIterations(value);
    },
    [dispatch, picflip]
  );

  const setOverrelaxation = useCallback(
    (value: number) => {
      dispatch(setPicflipOverrelaxation(value));
      picflip?.setOverrelaxation(value);
    },
    [dispatch, picflip]
  );

  const setDensity = useCallback(
    (value: number) => {
      dispatch(setPicflipDensity(value));
      picflip?.setDensity(value);
    },
    [dispatch, picflip]
  );

  const setRadius = useCallback(
    (value: number) => {
      dispatch(setPicflipRadius(value));
      picflip?.setRadius(value);
    },
    [dispatch, picflip]
  );

  const setPressure = useCallback(
    (value: number) => {
      dispatch(setPicflipPressure(value));
      picflip?.setPressure(value);
    },
    [dispatch, picflip]
  );

  const reset = useCallback(() => {
    dispatch(resetPicflip());
  }, [dispatch]);

  return {
    // Individual state properties
    gridResolution,
    flipRatio,
    pressureIterations,
    overrelaxation,
    density,
    radius,
    pressure,
    isEnabled,
    // Actions
    setEnabled,
    setGridResolution,
    setFlipRatio,
    setPressureIterations,
    setOverrelaxation,
    setDensity,
    setRadius,
    setPressure,
    reset,
  };
}
