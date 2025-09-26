import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import { selectModules } from "../../slices/modules";
import {
  selectInteraction,
  setInteractionEnabled,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
  InteractionModuleState,
} from "../../slices/modules/interaction";

export function useInteraction() {
  const dispatch = useAppDispatch();
  const { interaction } = useEngine();
  
  // Get state
  const modulesState = useAppSelector(selectModules);
  const state = useMemo(() => selectInteraction(modulesState), [modulesState]);
  
  // Destructure individual properties
  const {
    mode,
    strength,
    radius,
  } = state;
  const isEnabled = state.enabled;
  
  // Sync Redux state to engine module when they change
  useEffect(() => {
    if (interaction) {
      interaction.setMode(state.mode);
      interaction.setStrength(state.strength);
      interaction.setRadius(state.radius);
    }
  }, [interaction, state]);
  
  // Action creators with engine calls
  const setEnabled = useCallback((enabled: boolean) => {
    dispatch(setInteractionEnabled(enabled));
  }, [dispatch]);
  
  const setMode = useCallback((mode: InteractionModuleState["mode"]) => {
    dispatch(setInteractionMode(mode));
    interaction?.setMode(mode);
  }, [dispatch, interaction]);
  
  const setStrength = useCallback((value: number) => {
    dispatch(setInteractionStrength(value));
    interaction?.setStrength(value);
  }, [dispatch, interaction]);
  
  const setRadius = useCallback((value: number) => {
    dispatch(setInteractionRadius(value));
    interaction?.setRadius(value);
  }, [dispatch, interaction]);
  
  return {
    // Individual state properties
    mode,
    strength,
    radius,
    isEnabled,
    // Actions
    setEnabled,
    setMode,
    setStrength,
    setRadius,
  };
}