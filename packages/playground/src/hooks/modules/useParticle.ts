import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectParticle,
  setParticleEnabled,
  setRedParticleIndexes,
} from "../../slices/modules/particle";

export function useParticle() {
  const dispatch = useAppDispatch();
  const { particle, engine } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectParticle(modulesState), [modulesState]);

  // Destructure individual properties
  const { redParticleIndexes } = state;
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (particle) {
      particle.setRedParticleIndexes(state.redParticleIndexes);
    }
  }, [particle, state]);

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setParticleEnabled(enabled));
    },
    [dispatch]
  );

  const setRedIndexes = useCallback(
    (indexes: number[]) => {
      dispatch(setRedParticleIndexes(indexes));
      particle?.setRedParticleIndexes(indexes);
    },
    [dispatch, particle]
  );

  return {
    // Individual state properties
    redParticleIndexes,
    isEnabled,
    // Actions
    setEnabled,
    setRedIndexes,
  };
}