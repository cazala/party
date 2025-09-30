import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectBoundary,
  setBoundaryEnabled,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
  BoundaryModuleState,
} from "../../slices/modules/boundary";

export function useBoundary() {
  const dispatch = useAppDispatch();
  const { boundary } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectBoundary(modulesState), [modulesState]);

  // Destructure individual properties
  const { mode, restitution, friction, repelDistance, repelStrength } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (boundary) {
      boundary.setMode(state.mode);
      boundary.setRestitution(state.restitution);
      boundary.setFriction(state.friction);
      boundary.setRepelDistance(state.repelDistance);
      boundary.setRepelStrength(state.repelStrength);
    }
  }, [boundary, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setBoundaryEnabled(enabled));
    },
    [dispatch]
  );

  const setMode = useCallback(
    (mode: BoundaryModuleState["mode"]) => {
      dispatch(setBoundaryMode(mode));
      boundary?.setMode(mode);
    },
    [dispatch, boundary]
  );

  const setRestitution = useCallback(
    (value: number) => {
      dispatch(setBoundaryRestitution(value));
      boundary?.setRestitution(value);
    },
    [dispatch, boundary]
  );

  const setFriction = useCallback(
    (value: number) => {
      dispatch(setBoundaryFriction(value));
      boundary?.setFriction(value);
    },
    [dispatch, boundary]
  );

  const setRepelDistance = useCallback(
    (value: number) => {
      dispatch(setBoundaryRepelDistance(value));
      boundary?.setRepelDistance(value);
    },
    [dispatch, boundary]
  );

  const setRepelStrength = useCallback(
    (value: number) => {
      dispatch(setBoundaryRepelStrength(value));
      boundary?.setRepelStrength(value);
    },
    [dispatch, boundary]
  );

  return {
    // Individual state properties
    mode,
    restitution,
    friction,
    repelDistance,
    repelStrength,
    isEnabled,
    // Actions
    setEnabled,
    setMode,
    setRestitution,
    setFriction,
    setRepelDistance,
    setRepelStrength,
  };
}
