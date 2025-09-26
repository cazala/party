import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectTrails,
  setTrailsEnabled,
  setTrailsDecay,
  setTrailsDiffuse,
} from "../../slices/modules/trails";

export function useTrails() {
  const dispatch = useAppDispatch();
  const { trails } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectTrails(modulesState), [modulesState]);

  // Destructure individual properties
  const { trailDecay, trailDiffuse } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (trails) {
      trails.setTrailDecay(state.trailDecay);
      trails.setTrailDiffuse(state.trailDiffuse);
    }
  }, [trails, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setTrailsEnabled(enabled));
    },
    [dispatch]
  );

  const setDecay = useCallback(
    (value: number) => {
      dispatch(setTrailsDecay(value));
      trails?.setTrailDecay(value);
    },
    [dispatch, trails]
  );

  const setDiffuse = useCallback(
    (value: number) => {
      dispatch(setTrailsDiffuse(value));
      trails?.setTrailDiffuse(value);
    },
    [dispatch, trails]
  );

  return {
    // Individual state properties
    trailDecay,
    trailDiffuse,
    isEnabled,
    // Actions
    setEnabled,
    setDecay,
    setDiffuse,
  };
}
