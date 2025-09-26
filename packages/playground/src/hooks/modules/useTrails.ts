import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import {
  setTrailsEnabled,
  setTrailsDecay,
  setTrailsDiffuse,
} from "../../slices/modules/trails";

export function useTrails() {
  const dispatch = useAppDispatch();
  const { trails } = useEngine();
  
  // Get state
  const state = useAppSelector((state) => state.modules.trails);
  const isEnabled = useAppSelector((state) => state.modules.trails.enabled);
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (trails) {
      trails.setTrailDecay(state.trailDecay);
      trails.setTrailDiffuse(state.trailDiffuse);
    }
  }, [trails, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setTrailsEnabled(enabled));
  }, [dispatch]);
  
  const setDecay = useCallback((value: number) => {
    dispatch(setTrailsDecay(value));
    trails?.setTrailDecay(value);
  }, [dispatch, trails]);
  
  const setDiffuse = useCallback((value: number) => {
    dispatch(setTrailsDiffuse(value));
    trails?.setTrailDiffuse(value);
  }, [dispatch, trails]);
  
  return {
    state,
    isEnabled,
    setEnabled,
    setDecay,
    setDiffuse,
  };
}