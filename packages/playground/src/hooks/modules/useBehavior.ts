import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import {
  setBehaviorEnabled,
  setBehaviorWander,
  setBehaviorCohesion,
  setBehaviorAlignment,
  setBehaviorRepulsion,
  setBehaviorChase,
  setBehaviorAvoid,
  setBehaviorSeparation,
  setBehaviorViewRadius,
  setBehaviorViewAngle,
} from "../../slices/modules/behavior";

export function useBehavior() {
  const dispatch = useAppDispatch();
  const { behavior } = useEngine();
  
  // Get state
  const state = useAppSelector((state) => state.modules.behavior);
  const isEnabled = useAppSelector((state) => state.modules.behavior.enabled);
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (behavior) {
      behavior.setWander(state.wander);
      behavior.setCohesion(state.cohesion);
      behavior.setAlignment(state.alignment);
      behavior.setRepulsion(state.repulsion);
      behavior.setChase(state.chase);
      behavior.setAvoid(state.avoid);
      behavior.setSeparation(state.separation);
      behavior.setViewRadius(state.viewRadius);
      behavior.setViewAngle(state.viewAngle);
    }
  }, [behavior, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setBehaviorEnabled(enabled));
  }, [dispatch]);
  
  const setWander = useCallback((value: number) => {
    dispatch(setBehaviorWander(value));
    behavior?.setWander(value);
  }, [dispatch, behavior]);
  
  const setCohesion = useCallback((value: number) => {
    dispatch(setBehaviorCohesion(value));
    behavior?.setCohesion(value);
  }, [dispatch, behavior]);
  
  const setAlignment = useCallback((value: number) => {
    dispatch(setBehaviorAlignment(value));
    behavior?.setAlignment(value);
  }, [dispatch, behavior]);
  
  const setRepulsion = useCallback((value: number) => {
    dispatch(setBehaviorRepulsion(value));
    behavior?.setRepulsion(value);
  }, [dispatch, behavior]);
  
  const setChase = useCallback((value: number) => {
    dispatch(setBehaviorChase(value));
    behavior?.setChase(value);
  }, [dispatch, behavior]);
  
  const setAvoid = useCallback((value: number) => {
    dispatch(setBehaviorAvoid(value));
    behavior?.setAvoid(value);
  }, [dispatch, behavior]);
  
  const setSeparation = useCallback((value: number) => {
    dispatch(setBehaviorSeparation(value));
    behavior?.setSeparation(value);
  }, [dispatch, behavior]);
  
  const setViewRadius = useCallback((value: number) => {
    dispatch(setBehaviorViewRadius(value));
    behavior?.setViewRadius(value);
  }, [dispatch, behavior]);
  
  const setViewAngle = useCallback((value: number) => {
    dispatch(setBehaviorViewAngle(value));
    behavior?.setViewAngle(value);
  }, [dispatch, behavior]);
  
  return {
    state,
    isEnabled,
    setEnabled,
    setWander,
    setCohesion,
    setAlignment,
    setRepulsion,
    setChase,
    setAvoid,
    setSeparation,
    setViewRadius,
    setViewAngle,
  };
}