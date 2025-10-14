import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectParticle,
  setParticleEnabled,
  setParticleColorType,
  setParticleCustomColor,
  setParticleHue,
} from "../../slices/modules/particle";
import { ParticleColorType } from "@cazala/party";

export function useParticle() {
  const dispatch = useAppDispatch();
  const { particle } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectParticle(modulesState), [modulesState]);

  // Destructure individual properties
  const isEnabled = state.enabled;
  const colorType = state.colorType;
  const customColor = state.customColor;
  const hue = state.hue;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (!particle) return;
    particle.setEnabled(isEnabled);
    particle.setColorType(colorType);
    particle.setCustomColor(customColor);
    particle.setHue(hue);
  }, [particle, isEnabled, colorType, customColor, hue]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setParticleEnabled(enabled));
    },
    [dispatch]
  );

  const setColorType = useCallback(
    (value: ParticleColorType) => {
      dispatch(setParticleColorType(value));
      particle?.setColorType(value);
    },
    [dispatch, particle]
  );

  const setCustomColor = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      dispatch(setParticleCustomColor(color));
      particle?.setCustomColor(color);
    },
    [dispatch, particle]
  );

  const setHue = useCallback(
    (value: number) => {
      dispatch(setParticleHue(value));
      particle?.setHue(value);
    },
    [dispatch, particle]
  );

  // No red indexes anymore; pinned visualization happens in shader

  return {
    // Individual state properties
    isEnabled,
    colorType,
    customColor,
    hue,
    // Actions
    setEnabled,
    setColorType,
    setCustomColor,
    setHue,
  };
}
