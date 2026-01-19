import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
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
  setGridJoints,
  setText,
  setTextFont,
  setTextSize,
  setImageData,
  setImageSize,
  setImageSource,
  setImageUrl,
  selectInitState,
  selectHasInitialSpawned,
  selectIsSpawnLocked,
  setHasInitialSpawned,
  InitState,
  InitVelocityConfig,
} from "../slices/init";

export function useInit() {
  const dispatch = useAppDispatch();
  const initState = useAppSelector(selectInitState);
  const hasInitialSpawned = useAppSelector(selectHasInitialSpawned);
  const isSpawnLocked = useAppSelector(selectIsSpawnLocked);

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
    gridJoints,
    text,
    textFont,
    textSize,
    textPosition,
    textAlign,
    imageData,
    imageSize,
    imageSource,
    imageUrl,
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

  const setGridJointsValue = useCallback(
    (value: boolean) => {
      dispatch(setGridJoints(value));
    },
    [dispatch]
  );

  const setTextValue = useCallback(
    (value: string) => {
      dispatch(setText(value));
    },
    [dispatch]
  );

  const setTextFontValue = useCallback(
    (value: string) => {
      dispatch(setTextFont(value));
    },
    [dispatch]
  );

  const setTextSizeValue = useCallback(
    (value: number) => {
      dispatch(setTextSize(value));
    },
    [dispatch]
  );

  const setImageDataValue = useCallback(
    (value: ImageData | null) => {
      dispatch(setImageData(value));
    },
    [dispatch]
  );

  const setImageSizeValue = useCallback(
    (value: number) => {
      dispatch(setImageSize(value));
    },
    [dispatch]
  );

  const setImageSourceValue = useCallback(
    (value: "url" | "upload") => {
      dispatch(setImageSource(value));
    },
    [dispatch]
  );

  const setImageUrlValue = useCallback(
    (value: string) => {
      dispatch(setImageUrl(value));
    },
    [dispatch]
  );

  const markInitialSpawned = useCallback(() => {
    dispatch(setHasInitialSpawned(true));
  }, [dispatch]);

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
    gridJoints,
    text,
    textFont,
    textSize,
    textPosition,
    textAlign,
    imageData,
    imageSize,
    imageSource,
    imageUrl,

    // Spawn state
    hasInitialSpawned,
    isSpawnLocked,

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
    setGridJoints: setGridJointsValue,
    setText: setTextValue,
    setTextFont: setTextFontValue,
    setTextSize: setTextSizeValue,
    setImageData: setImageDataValue,
    setImageSize: setImageSizeValue,
    setImageSource: setImageSourceValue,
    setImageUrl: setImageUrlValue,
    markInitialSpawned,
  };
}
