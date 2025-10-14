import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  selectOscillators,
  selectOscillator,
  selectIsOscillating,
  setOscillator,
  removeOscillator,
  updateOscillatorSpeed,
  updateOscillatorBounds,
  updateOscillatorMin,
  updateOscillatorMax,
  clearAllOscillators,
  OscillationSpeed,
  OscillatorData,
} from "../slices/oscillators";

export function useOscillators(sliderId?: string) {
  const dispatch = useAppDispatch();
  const oscillators = useAppSelector(selectOscillators);
  
  // Get oscillator data for specific slider if ID provided
  const oscillatorData = sliderId ? useAppSelector((state) => selectOscillator(state, sliderId)) : undefined;
  const isOscillating = sliderId ? useAppSelector((state) => selectIsOscillating(state, sliderId)) : false;

  // Wrapped action creators
  const setOscillatorConfig = useCallback(
    (config: OscillatorData) => {
      if (!sliderId) return;
      dispatch(setOscillator({ sliderId, config }));
    },
    [dispatch, sliderId]
  );

  const removeOscillatorConfig = useCallback(() => {
    if (!sliderId) return;
    dispatch(removeOscillator(sliderId));
  }, [dispatch, sliderId]);

  const updateSpeed = useCallback(
    (speed: OscillationSpeed) => {
      if (!sliderId) return;
      dispatch(updateOscillatorSpeed({ sliderId, speed }));
    },
    [dispatch, sliderId]
  );

  const updateBounds = useCallback(
    (customMin: number, customMax: number) => {
      if (!sliderId) return;
      dispatch(updateOscillatorBounds({ sliderId, customMin, customMax }));
    },
    [dispatch, sliderId]
  );

  const updateMin = useCallback(
    (customMin: number) => {
      if (!sliderId) return;
      dispatch(updateOscillatorMin({ sliderId, customMin }));
    },
    [dispatch, sliderId]
  );

  const updateMax = useCallback(
    (customMax: number) => {
      if (!sliderId) return;
      dispatch(updateOscillatorMax({ sliderId, customMax }));
    },
    [dispatch, sliderId]
  );

  const clearAll = useCallback(() => {
    dispatch(clearAllOscillators());
  }, [dispatch]);

  return {
    // State for specific slider
    speed: oscillatorData?.speed || 'none' as const,
    customMin: oscillatorData?.customMin,
    customMax: oscillatorData?.customMax,
    isOscillating,
    hasConfig: !!oscillatorData,
    
    // Global state
    allOscillators: oscillators,
    
    // Actions
    setOscillator: setOscillatorConfig,
    removeOscillator: removeOscillatorConfig,
    updateSpeed,
    updateBounds,
    updateMin,
    updateMax,
    clearAllOscillators: clearAll,
  };
}