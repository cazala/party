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
  setPicflipGravityX,
  setPicflipGravityY,
  setPicflipPressureIterations,
  setPicflipOverrelaxation,
  setPicflipDensity,
  setPicflipMaxVelocity,
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
    gravityX,
    gravityY,
    pressureIterations,
    overrelaxation,
    density,
    maxVelocity,
  } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (picflip) {
      picflip.setGridResolution(state.gridResolution);
      picflip.setFlipRatio(state.flipRatio);
      picflip.setGravityX(state.gravityX);
      picflip.setGravityY(state.gravityY);
      picflip.setPressureIterations(state.pressureIterations);
      picflip.setOverrelaxation(state.overrelaxation);
      picflip.setDensity(state.density);
      picflip.setMaxVelocity(state.maxVelocity);
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

  const setGravityX = useCallback(
    (value: number) => {
      dispatch(setPicflipGravityX(value));
      picflip?.setGravityX(value);
    },
    [dispatch, picflip]
  );

  const setGravityY = useCallback(
    (value: number) => {
      dispatch(setPicflipGravityY(value));
      picflip?.setGravityY(value);
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

  const setMaxVelocity = useCallback(
    (value: number) => {
      dispatch(setPicflipMaxVelocity(value));
      picflip?.setMaxVelocity(value);
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
    gravityX,
    gravityY,
    pressureIterations,
    overrelaxation,
    density,
    maxVelocity,
    isEnabled,
    // Actions
    setEnabled,
    setGridResolution,
    setFlipRatio,
    setGravityX,
    setGravityY,
    setPressureIterations,
    setOverrelaxation,
    setDensity,
    setMaxVelocity,
    reset,
  };
}
