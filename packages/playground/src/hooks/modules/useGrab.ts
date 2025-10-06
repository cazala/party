import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectGrab,
  setGrabEnabled,
  setGrabbedIndex,
  setPositionX,
  setPositionY,
  setPosition,
  grabParticle,
  releaseGrab,
} from "../../slices/modules/grab";

export function useGrab() {
  const dispatch = useAppDispatch();
  const { grab } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectGrab(modulesState), [modulesState]);

  // Destructure individual properties
  const { enabled, grabbedIndex, positionX, positionY } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (grab) {
      grab.setEnabled(state.enabled);
      grab.setGrabbedIndex(state.grabbedIndex);
      grab.setPositionX(state.positionX);
      grab.setPositionY(state.positionY);
    }
  }, [grab, state]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setGrabEnabled(enabled));
    },
    [dispatch]
  );

  const setGrabbedIndexValue = useCallback(
    (value: number) => {
      dispatch(setGrabbedIndex(value));
      grab?.setGrabbedIndex(value);
    },
    [dispatch, grab]
  );

  const setPositionXValue = useCallback(
    (value: number) => {
      dispatch(setPositionX(value));
      grab?.setPositionX(value);
    },
    [dispatch, grab]
  );

  const setPositionYValue = useCallback(
    (value: number) => {
      dispatch(setPositionY(value));
      grab?.setPositionY(value);
    },
    [dispatch, grab]
  );

  const setPositionValue = useCallback(
    (position: { x: number; y: number }) => {
      dispatch(setPosition(position));
      grab?.setPosition(position);
    },
    [dispatch, grab]
  );

  const grabParticleValue = useCallback(
    (index: number, position: { x: number; y: number }) => {
      dispatch(grabParticle({ index, position }));
      grab?.grabParticle(index, position);
    },
    [dispatch, grab]
  );

  const releaseParticle = useCallback(() => {
    dispatch(releaseGrab());
    grab?.releaseParticle();
  }, [dispatch, grab]);

  const updatePosition = useCallback(
    (position: { x: number; y: number }) => {
      // Only update position if we're actively grabbing
      if (grabbedIndex >= 0) {
        setPositionValue(position);
      }
    },
    [grabbedIndex, setPositionValue]
  );

  const isGrabbing = useCallback(() => {
    return grabbedIndex >= 0;
  }, [grabbedIndex]);

  return {
    // Individual state properties
    enabled,
    grabbedIndex,
    positionX,
    positionY,
    isEnabled,
    // Actions
    setEnabled,
    setGrabbedIndex: setGrabbedIndexValue,
    setPositionX: setPositionXValue,
    setPositionY: setPositionYValue,
    setPosition: setPositionValue,
    grabParticle: grabParticleValue,
    releaseParticle,
    updatePosition,
    // Helper methods
    isGrabbing,
  };
}