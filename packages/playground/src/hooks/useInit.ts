import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import {
  setNumParticles,
  setSpawnShape,
  setSpacing,
  setParticleSize,
  setParticleMass,
  setRadius,
  setInnerRadius,
  setSquareSize,
  setCornerRadius,
  setColors,
  updateVelocityConfig,
  selectInitState,
  InitState,
  InitVelocityConfig,
} from "../slices/init";

export function useInit() {
  const dispatch = useAppDispatch();
  const initState = useAppSelector(selectInitState);

  // Getters - destructure all state values
  const {
    numParticles,
    shape,
    spacing,
    particleSize,
    particleMass,
    radius,
    innerRadius,
    squareSize,
    cornerRadius,
    colors,
    velocityConfig,
  } = initState;

  // Setters - wrapped dispatch functions
  const setNumParticlesValue = useCallback(
    (value: number) => {
      dispatch(setNumParticles(value));
    },
    [dispatch]
  );

  const setSpawnShapeValue = useCallback(
    (value: InitState["shape"]) => {
      dispatch(setSpawnShape(value));
    },
    [dispatch]
  );

  const setSpacingValue = useCallback(
    (value: number) => {
      dispatch(setSpacing(value));
    },
    [dispatch]
  );

  const setParticleSizeValue = useCallback(
    (value: number) => {
      dispatch(setParticleSize(value));
    },
    [dispatch]
  );

  const setParticleMassValue = useCallback(
    (value: number) => {
      dispatch(setParticleMass(value));
    },
    [dispatch]
  );

  const setRadiusValue = useCallback(
    (value: number) => {
      dispatch(setRadius(value));
    },
    [dispatch]
  );

  const setInnerRadiusValue = useCallback(
    (value: number) => {
      dispatch(setInnerRadius(value));
    },
    [dispatch]
  );

  const setSquareSizeValue = useCallback(
    (value: number) => {
      dispatch(setSquareSize(value));
    },
    [dispatch]
  );

  const setCornerRadiusValue = useCallback(
    (value: number) => {
      dispatch(setCornerRadius(value));
    },
    [dispatch]
  );

  const setColorsValue = useCallback(
    (value: string[]) => {
      dispatch(setColors(value));
    },
    [dispatch]
  );

  const updateVelocityConfigValue = useCallback(
    (value: Partial<InitVelocityConfig>) => {
      dispatch(updateVelocityConfig(value));
    },
    [dispatch]
  );

  return {
    // State values (getters)
    numParticles,
    shape,
    spacing,
    particleSize,
    particleMass,
    radius,
    innerRadius,
    squareSize,
    cornerRadius,
    colors,
    velocityConfig,

    // Full state object for convenience
    initState,

    // Action functions (setters)
    setNumParticles: setNumParticlesValue,
    setSpawnShape: setSpawnShapeValue,
    setSpacing: setSpacingValue,
    setParticleSize: setParticleSizeValue,
    setParticleMass: setParticleMassValue,
    setRadius: setRadiusValue,
    setInnerRadius: setInnerRadiusValue,
    setSquareSize: setSquareSizeValue,
    setCornerRadius: setCornerRadiusValue,
    setColors: setColorsValue,
    updateVelocityConfig: updateVelocityConfigValue,
  };
}
