import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectPin,
  setPinEnabled,
  setPinnedParticleIndexes,
} from "../../slices/modules/pin";
import { useParticle } from "./useParticle";

export function usePin() {
  const dispatch = useAppDispatch();
  const { pin, engine } = useEngine();
  const { setRedIndexes } = useParticle();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectPin(modulesState), [modulesState]);

  // Destructure individual properties
  const { pinnedParticleIndexes } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (pin) {
      pin.setPinnedParticleIndexes(state.pinnedParticleIndexes);
    }
  }, [pin, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setPinEnabled(enabled));
    },
    [dispatch]
  );

  const setPinnedIndexes = useCallback(
    (indexes: number[]) => {
      dispatch(setPinnedParticleIndexes(indexes));
      pin?.setPinnedParticleIndexes(indexes);
      // Also set the same indexes as red particles to visually show pinned particles
      setRedIndexes(indexes);
    },
    [dispatch, pin, setRedIndexes]
  );

  // Pin particles within a given radius
  const pinParticles = useCallback(
    async ({
      center,
      radius,
    }: {
      center: { x: number; y: number };
      radius: number;
    }) => {
      if (!engine) return;

      // Get current particles
      const particles = await engine.getParticles();

      // Find particles within pin area and collect their indexes
      const pinnedIndexes: number[] = [];
      particles.forEach((particle, index) => {
        const dx = particle.position.x - center.x;
        const dy = particle.position.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          pinnedIndexes.push(index);
        }
      });

      // Update the pin module with the new pinned indexes (even if empty to clear previous pins)
      setPinnedIndexes(pinnedIndexes);
    },
    [engine, setPinnedIndexes]
  );

  return {
    // Individual state properties
    pinnedParticleIndexes,
    isEnabled,
    // Actions
    setEnabled,
    setPinnedIndexes,
    pinParticles,
  };
}