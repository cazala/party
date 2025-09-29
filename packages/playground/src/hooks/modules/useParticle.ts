import { useCallback, useMemo } from "react";
import { useAppDispatch } from "../useAppDispatch";
import { useAppSelector } from "../useAppSelector";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectParticle,
  setParticleEnabled,
} from "../../slices/modules/particle";

export function useParticle() {
  const dispatch = useAppDispatch();
  const { particle } = useEngine();

  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectParticle(modulesState), [modulesState]);

  // Destructure individual properties
  const isEnabled = state.enabled;

  // Sync Redux state to engine module when they change
  // No inputs to sync for particle render

  // Action creators with engine calls
  const setEnabled = useCallback(
    (enabled: boolean) => {
      dispatch(setParticleEnabled(enabled));
    },
    [dispatch]
  );

  // No red indexes anymore; pinned visualization happens in shader

  return {
    // Individual state properties
    isEnabled,
    // Actions
    setEnabled,
  };
}
