import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectPicflip,
  setPicflipEnabled,
  setPicflipFlipRatio,
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
  const { flipRatio, density, radius, pressure } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (picflip) {
      picflip.setFlipRatio(state.flipRatio);
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

  const setFlipRatio = useCallback(
    (value: number) => {
      dispatch(setPicflipFlipRatio(value));
      picflip?.setFlipRatio(value);
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
    flipRatio,
    density,
    radius,
    pressure,
    isEnabled,
    // Actions
    setEnabled,
    setFlipRatio,
    setDensity,
    setRadius,
    setPressure,
    reset,
  };
}
