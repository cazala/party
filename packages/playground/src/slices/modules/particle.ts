import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ParticleModuleState {
  enabled: boolean;
}

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

export const { setParticleEnabled, resetParticle, importParticleSettings } =
  particleSlice.actions;

export const particleReducer = particleSlice.reducer;

// Selectors
export const selectParticle = (state: { particle: ParticleModuleState }) =>
  state.particle;
