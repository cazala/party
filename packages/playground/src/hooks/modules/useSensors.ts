import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectSensors,
  setSensorsEnabled,
  setSensorDistance,
  setSensorAngle,
  setSensorRadius,
  setSensorThreshold,
  setSensorStrength,
  setSensorFollowValue,
  setSensorFleeValue,
  setSensorColorSimilarityThreshold,
  setSensorFleeAngle,
} from "../../slices/modules/sensors";

export function useSensors() {
  const dispatch = useAppDispatch();
  const { sensors } = useEngine();
  
  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectSensors(modulesState), [modulesState]);
  
  // Destructure individual properties
  const {
    sensorDistance,
    sensorAngle,
    sensorRadius,
    sensorThreshold,
    sensorStrength,
    followValue,
    fleeValue,
    colorSimilarityThreshold,
    fleeAngle,
  } = state;
  const isEnabled = state.enabled;
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (sensors) {
      sensors.setSensorDistance(state.sensorDistance);
      sensors.setSensorAngle(state.sensorAngle);
      sensors.setSensorRadius(state.sensorRadius);
      sensors.setSensorThreshold(state.sensorThreshold);
      sensors.setSensorStrength(state.sensorStrength);
      sensors.setFollowBehavior(state.followValue as any);
      sensors.setFleeBehavior(state.fleeValue as any);
      sensors.setColorSimilarityThreshold(state.colorSimilarityThreshold);
      sensors.setFleeAngle(state.fleeAngle);
    }
  }, [sensors, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setSensorsEnabled(enabled));
  }, [dispatch]);
  
  const setDistance = useCallback((value: number) => {
    dispatch(setSensorDistance(value));
    sensors?.setSensorDistance(value);
  }, [dispatch, sensors]);
  
  const setAngle = useCallback((value: number) => {
    dispatch(setSensorAngle(value));
    sensors?.setSensorAngle(value);
  }, [dispatch, sensors]);
  
  const setRadius = useCallback((value: number) => {
    dispatch(setSensorRadius(value));
    sensors?.setSensorRadius(value);
  }, [dispatch, sensors]);
  
  const setThreshold = useCallback((value: number) => {
    dispatch(setSensorThreshold(value));
    sensors?.setSensorThreshold(value);
  }, [dispatch, sensors]);
  
  const setStrength = useCallback((value: number) => {
    dispatch(setSensorStrength(value));
    sensors?.setSensorStrength(value);
  }, [dispatch, sensors]);
  
  const setFollowValue = useCallback((value: string) => {
    dispatch(setSensorFollowValue(value));
    sensors?.setFollowBehavior(value as any);
  }, [dispatch, sensors]);
  
  const setFleeValue = useCallback((value: string) => {
    dispatch(setSensorFleeValue(value));
    sensors?.setFleeBehavior(value as any);
  }, [dispatch, sensors]);
  
  const setColorSimilarityThreshold = useCallback((value: number) => {
    dispatch(setSensorColorSimilarityThreshold(value));
    sensors?.setColorSimilarityThreshold(value);
  }, [dispatch, sensors]);
  
  const setFleeAngle = useCallback((value: number) => {
    dispatch(setSensorFleeAngle(value));
    sensors?.setFleeAngle(value);
  }, [dispatch, sensors]);
  
  return {
    // Individual state properties
    sensorDistance,
    sensorAngle,
    sensorRadius,
    sensorThreshold,
    sensorStrength,
    followValue,
    fleeValue,
    colorSimilarityThreshold,
    fleeAngle,
    isEnabled,
    // Actions
    setEnabled,
    setDistance,
    setAngle,
    setRadius,
    setThreshold,
    setStrength,
    setFollowValue,
    setFleeValue,
    setColorSimilarityThreshold,
    setFleeAngle,
  };
}