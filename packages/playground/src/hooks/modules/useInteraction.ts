import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../redux";
import { useEngine } from "../useEngine";
import {
  setInteractionEnabled,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
} from "../../slices/modules/interaction";
import { InteractionModuleState } from "../../slices/modules/types";

export function useInteraction() {
  const dispatch = useAppDispatch();
  const { interaction } = useEngine();
  
  // Get state
  const state = useAppSelector((state) => state.modules.interaction);
  const isEnabled = useAppSelector((state) => state.modules.interaction.enabled);
  
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
    state,
    isEnabled,
    setEnabled,
    setMode,
    setStrength,
    setRadius,
  };
}