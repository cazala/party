import { useCallback, useEffect } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import { useEngine } from "./useEngine";
import {
  selectOscillators,
  selectOscillator,
  selectIsOscillating,
  setOscillator,
  removeOscillator,
  updateOscillatorSpeed,
  updateOscillatorSpeedHz,
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
  const { engine: engineInstance } = useEngine();

  // Get oscillator data for specific slider if ID provided
  const oscillatorData = sliderId
    ? useAppSelector((state) => selectOscillator(state, sliderId))
    : undefined;
  const isOscillating = sliderId
    ? useAppSelector((state) => selectIsOscillating(state, sliderId))
    : false;

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

  const updateSpeedHz = useCallback(
    (speedHz: number) => {
      if (!sliderId) return;
      dispatch(updateOscillatorSpeedHz({ sliderId, speedHz }));
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

  // Sync Redux → Engine for this slider (if moduleName/inputName present)
  useEffect(() => {
    if (!sliderId) return;
    const cfg = oscillatorData;
    const api = engineInstance;
    if (!api) return;

    // Resolve module/input from explicit fields or from sliderId formatted as common patterns
    let moduleName = cfg?.moduleName;
    let inputName = cfg?.inputName;
    if (!moduleName || !inputName) {
      const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
      if (parts.length >= 2) {
        moduleName = moduleName || parts[0];
        inputName = inputName || parts[1];
      }
    }
    if (!moduleName || !inputName) return;

    if (cfg) {
      api.addOscillator({
        moduleName,
        inputName,
        min: cfg.customMin,
        max: cfg.customMax,
        speedHz: cfg.speedHz,
        options: {
          curveExponent: cfg.curveExponent,
          jitter: cfg.jitter,
          currentValue: api.getModule(moduleName)?.readValue(inputName),
        },
      });
    } else {
      api.removeOscillator(moduleName, inputName);
    }
    // No cleanup to avoid removing oscillators on unmount without explicit action
  }, [sliderId, oscillatorData, engineInstance]);

  return {
    // State for specific slider
    speedHz: oscillatorData?.speedHz,
    speed:
      oscillatorData?.speedHz == null
        ? undefined
        : ((oscillatorData.speedHz <= 0.02
            ? "slow"
            : oscillatorData.speedHz <= 0.1
            ? "normal"
            : "fast") as OscillationSpeed),
    customMin: oscillatorData?.customMin,
    customMax: oscillatorData?.customMax,
    isOscillating,
    hasConfig: !!oscillatorData,

    // Global state
    allOscillators: oscillators,

    // Actions
    setOscillator: setOscillatorConfig,
    removeOscillator: removeOscillatorConfig,
    updateSpeed, // convenience preset action
    updateSpeedHz,
    updateBounds,
    updateMin,
    updateMax,
    clearAllOscillators: clearAll,
  };
}
