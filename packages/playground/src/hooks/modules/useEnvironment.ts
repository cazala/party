import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectEnvironment,
  setEnvironmentEnabled,
  setEnvironmentGravityStrength,
  setEnvironmentInertia,
  setEnvironmentFriction,
  setEnvironmentDamping,
  setEnvironmentDirection,
} from "../../slices/modules/environment";

export function useEnvironment() {
  const dispatch = useAppDispatch();
  const { environment } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectEnvironment(modulesState), [modulesState]);

  // Destructure individual properties
  const {
    gravityStrength,
    dirX,
    dirY,
    inertia,
    friction,
    damping,
    mode,
  } = state;
  const isEnabled = state.enabled;
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (environment) {
      environment.setGravityStrength(state.gravityStrength);
      environment.setInertia(state.inertia);
      environment.setFriction(state.friction);
      environment.setDamping(state.damping);
      environment.setGravityDirection?.(
        state.dirX === 0 && state.dirY === 1 ? "down" :
        state.dirX === 0 && state.dirY === -1 ? "up" :
        state.dirX === -1 && state.dirY === 0 ? "left" :
        state.dirX === 1 && state.dirY === 0 ? "right" : "custom" as any
      );
    }
  }, [environment, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setEnvironmentEnabled(enabled));
  }, [dispatch]);
  
  const setGravityStrength = useCallback((value: number) => {
    dispatch(setEnvironmentGravityStrength(value));
    environment?.setGravityStrength(value);
  }, [dispatch, environment]);
  
  const setInertia = useCallback((value: number) => {
    dispatch(setEnvironmentInertia(value));
    environment?.setInertia(value);
  }, [dispatch, environment]);
  
  const setFriction = useCallback((value: number) => {
    dispatch(setEnvironmentFriction(value));
    environment?.setFriction(value);
  }, [dispatch, environment]);
  
  const setDamping = useCallback((value: number) => {
    dispatch(setEnvironmentDamping(value));
    environment?.setDamping(value);
  }, [dispatch, environment]);
  
  const setDirection = useCallback((dirX: number, dirY: number) => {
    dispatch(setEnvironmentDirection({ dirX, dirY }));
    const direction =
      dirX === 0 && dirY === 1 ? "down" :
      dirX === 0 && dirY === -1 ? "up" :
      dirX === -1 && dirY === 0 ? "left" :
      dirX === 1 && dirY === 0 ? "right" : "custom" as any;
    environment?.setGravityDirection?.(direction);
  }, [dispatch, environment]);
  
  return {
    // Individual state properties
    gravityStrength,
    dirX,
    dirY,
    inertia,
    friction,
    damping,
    mode,
    isEnabled,
    // Actions
    setEnabled,
    setGravityStrength,
    setInertia,
    setFriction,
    setDamping,
    setDirection,
  };
}