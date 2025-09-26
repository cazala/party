import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ParticleModuleState } from "./types";

const initialState: ParticleModuleState = {
  enabled: true,
};

export const particleSlice = createSlice({
  name: "particle",
  initialState,
  reducers: {
    setParticleEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    resetParticle: () => initialState,
    importParticleSettings: (
      state,
      action: PayloadAction<Partial<ParticleModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setParticleEnabled,
  resetParticle,
  importParticleSettings,
} = particleSlice.actions;

export const particleReducer = particleSlice.reducer;

// Selectors
export const selectParticleModule = (state: { particle: ParticleModuleState }) =>
  state.particle;
export const selectParticleEnabled = (state: { particle: ParticleModuleState }) =>
  state.particle.enabled;