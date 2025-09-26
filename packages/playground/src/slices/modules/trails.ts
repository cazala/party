import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_TRAILS_TRAIL_DECAY,
  DEFAULT_TRAILS_TRAIL_DIFFUSE,
} from "@cazala/party";

export interface TrailsModuleState {
  enabled: boolean;
  trailDecay: number;
  trailDiffuse: number;
}

const initialState: TrailsModuleState = {
  enabled: false,
  trailDecay: DEFAULT_TRAILS_TRAIL_DECAY,
  trailDiffuse: DEFAULT_TRAILS_TRAIL_DIFFUSE,
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
export const selectTrails = (state: { trails: TrailsModuleState }) =>
  state.trails;
