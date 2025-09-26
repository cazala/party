import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface InteractionModuleState {
  enabled: boolean;
  mode: "attract" | "repel";
  strength: number;
  radius: number;
}

const initialState: InteractionModuleState = {
  enabled: false,
  mode: "attract",
  strength: 10000,
  radius: 500,
};

export const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    setInteractionEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setInteractionMode: (
      state,
      action: PayloadAction<InteractionModuleState["mode"]>
    ) => {
      state.mode = action.payload;
    },
    setInteractionStrength: (state, action: PayloadAction<number>) => {
      state.strength = action.payload;
    },
    setInteractionRadius: (state, action: PayloadAction<number>) => {
      state.radius = action.payload;
    },
    resetInteraction: () => initialState,
    importInteractionSettings: (
      state,
      action: PayloadAction<Partial<InteractionModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setInteractionEnabled,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
  resetInteraction,
  importInteractionSettings,
} = interactionSlice.actions;

export const interactionReducer = interactionSlice.reducer;

// Selectors
export const selectInteraction = (state: { interaction: InteractionModuleState }) =>
  state.interaction;