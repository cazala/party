import { useCallback, useEffect, useMemo } from "react";
import { degToRad, GravityDirection } from "@cazala/party";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
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
  setEnvironmentMode,
  resetEnvironment,
} from "../../slices/modules/environment";

export function useEnvironment() {
  const dispatch = useAppDispatch();
  const { environment } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectEnvironment(modulesState), [modulesState]);

  // Destructure individual properties
  const { gravityStrength, dirX, dirY, inertia, friction, damping, mode } =
    state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (environment) {
      environment.setGravityStrength(state.gravityStrength);
      environment.setInertia(state.inertia);
      environment.setFriction(state.friction);
      environment.setDamping(state.damping);
      environment.setGravityDirection?.(state.mode);
    }
  }, [environment, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setEnvironmentEnabled(enabled));
    },
    [dispatch]
  );

  const setGravityStrength = useCallback(
    (value: number) => {
      dispatch(setEnvironmentGravityStrength(value));
      environment?.setGravityStrength(value);
    },
    [dispatch, environment]
  );

  const setInertia = useCallback(
    (value: number) => {
      dispatch(setEnvironmentInertia(value));
      environment?.setInertia(value);
    },
    [dispatch, environment]
  );

  const setFriction = useCallback(
    (value: number) => {
      dispatch(setEnvironmentFriction(value));
      environment?.setFriction(value);
    },
    [dispatch, environment]
  );

  const setDamping = useCallback(
    (value: number) => {
      dispatch(setEnvironmentDamping(value));
      environment?.setDamping(value);
    },
    [dispatch, environment]
  );

  const setDirection = useCallback(
    (dirX: number, dirY: number) => {
      dispatch(setEnvironmentDirection({ dirX, dirY }));
      // Only auto-set mode if we're not already in custom mode
      if (mode !== "custom") {
        const direction =
          dirX === 0 && dirY === 1
            ? "down"
            : dirX === 0 && dirY === -1
            ? "up"
            : dirX === -1 && dirY === 0
            ? "left"
            : dirX === 1 && dirY === 0
            ? "right"
            : "custom";
        dispatch(setEnvironmentMode(direction));
        environment?.setGravityDirection(direction);
      } else {
        // If in custom mode, just update the engine with custom
        environment?.setGravityDirection("custom");
      }
    },
    [dispatch, environment, mode]
  );

  const setMode = useCallback(
    (mode: GravityDirection) => {
      dispatch(setEnvironmentMode(mode));
      environment?.setGravityDirection?.(mode);
    },
    [dispatch, environment]
  );

  const setCustomDirection = useCallback(
    (dirX: number, dirY: number) => {
      dispatch(setEnvironmentDirection({ dirX, dirY }));
      // For custom mode, we need to tell the engine to use custom direction
      environment?.setGravityDirection?.("custom");
    },
    [dispatch, environment]
  );

  const setCustomAngle = useCallback(
    (angleRadians: number) => {
      // Use the engine's setGravityAngle method which handles custom angles properly
      environment?.setGravityAngle?.(angleRadians);
      // Also update our Redux state to keep it in sync
      const dirX = Math.sin(angleRadians);
      const dirY = -Math.cos(angleRadians);
      dispatch(setEnvironmentDirection({ dirX, dirY }));
    },
    [dispatch, environment]
  );

  const setCustomAngleDegrees = useCallback(
    (angleDegrees: number) => {
      setCustomAngle(degToRad(angleDegrees));
    },
    [setCustomAngle]
  );

  const reset = useCallback(() => {
    dispatch(resetEnvironment());
  }, [dispatch]);

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
    setMode,
    setCustomDirection,
    setCustomAngle,
    setCustomAngleDegrees,
    reset,
  };
}
