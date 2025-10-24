import { useCallback, useEffect, useMemo } from "react";
import { ParticlesColorType } from "@cazala/party";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectParticles,
  setParticlesEnabled,
  setParticlesColorType,
  setParticlesCustomColor,
  setParticlesHue,
} from "../../slices/modules/particles";

export function useParticles() {
  const dispatch = useAppDispatch();
  const { particles } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectParticles(modulesState), [modulesState]);

  // Destructure individual properties
  const isEnabled = state.enabled;
  const colorType = state.colorType;
  const customColor = state.customColor;
  const hue = state.hue;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (!particles) return;
    particles.setEnabled(isEnabled);
    particles.setColorType(colorType);
    particles.setCustomColor(customColor);
    particles.setHue(hue);
  }, [particles, isEnabled, colorType, customColor, hue]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setParticlesEnabled(enabled));
    },
    [dispatch]
  );

  const setColorType = useCallback(
    (value: ParticlesColorType) => {
      dispatch(setParticlesColorType(value));
      particles?.setColorType(value);
    },
    [dispatch, particles]
  );

  const setCustomColor = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      dispatch(setParticlesCustomColor(color));
      particles?.setCustomColor(color);
    },
    [dispatch, particles]
  );

  const setHue = useCallback(
    (value: number) => {
      dispatch(setParticlesHue(value));
      particles?.setHue(value);
    },
    [dispatch, particles]
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
