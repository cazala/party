import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import {
  setBoundaryEnabled,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
} from "../../slices/modules/boundary";
import { BoundaryModuleState } from "../../slices/modules/types";

export function useBoundary() {
  const dispatch = useAppDispatch();
  const { boundary } = useEngine();
  
  // Get state
  const state = useAppSelector((state) => state.modules.boundary);
  const isEnabled = useAppSelector((state) => state.modules.boundary.enabled);
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (boundary) {
      boundary.setMode(state.mode as any);
      boundary.setRestitution(state.restitution);
      boundary.setFriction(state.friction);
      boundary.setRepelDistance(state.repelDistance);
      boundary.setRepelStrength(state.repelStrength);
    }
  }, [boundary, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setBoundaryEnabled(enabled));
  }, [dispatch]);
  
  const setMode = useCallback((mode: BoundaryModuleState["mode"]) => {
    dispatch(setBoundaryMode(mode));
    boundary?.setMode(mode as any);
  }, [dispatch, boundary]);
  
  const setRestitution = useCallback((value: number) => {
    dispatch(setBoundaryRestitution(value));
    boundary?.setRestitution(value);
  }, [dispatch, boundary]);
  
  const setFriction = useCallback((value: number) => {
    dispatch(setBoundaryFriction(value));
    boundary?.setFriction(value);
  }, [dispatch, boundary]);
  
  const setRepelDistance = useCallback((value: number) => {
    dispatch(setBoundaryRepelDistance(value));
    boundary?.setRepelDistance(value);
  }, [dispatch, boundary]);
  
  const setRepelStrength = useCallback((value: number) => {
    dispatch(setBoundaryRepelStrength(value));
    boundary?.setRepelStrength(value);
  }, [dispatch, boundary]);
  
  return {
    state,
    isEnabled,
    setEnabled,
    setMode,
    setRestitution,
    setFriction,
    setRepelDistance,
    setRepelStrength,
  };
}