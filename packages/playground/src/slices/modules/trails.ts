import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TrailsModuleState } from "./types";

const initialState: TrailsModuleState = {
  enabled: false,
  trailDecay: 10,
  trailDiffuse: 1,
};

export const trailsSlice = createSlice({
  name: "trails",
  initialState,
  reducers: {
    setTrailsEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setTrailsDecay: (state, action: PayloadAction<number>) => {
      state.trailDecay = action.payload;
    },
    setTrailsDiffuse: (state, action: PayloadAction<number>) => {
      state.trailDiffuse = action.payload;
    },
    resetTrails: () => initialState,
    importTrailsSettings: (
      state,
      action: PayloadAction<Partial<TrailsModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setTrailsEnabled,
  setTrailsDecay,
  setTrailsDiffuse,
  resetTrails,
  importTrailsSettings,
} = trailsSlice.actions;

export const trailsReducer = trailsSlice.reducer;

// Selectors
export const selectTrailsModule = (state: { trails: TrailsModuleState }) =>
  state.trails;
export const selectTrailsEnabled = (state: { trails: TrailsModuleState }) =>
  state.trails.enabled;