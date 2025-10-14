import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ParticleColorType } from "@cazala/party";

export interface ParticleModuleState {
  enabled: boolean;
  colorType: ParticleColorType; // 0 default, 1 custom, 2 hue
  customColor: { r: number; g: number; b: number; a: number };
  hue: number; // 0..1
}

const initialState: ParticleModuleState = {
  enabled: true,
  colorType: ParticleColorType.Default,
  customColor: { r: 1, g: 1, b: 1, a: 1 },
  hue: 0,
};

export const particleSlice = createSlice({
  name: "particle",
  initialState,
  reducers: {
    setParticleEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setParticleColorType: (state, action: PayloadAction<ParticleColorType>) => {
      state.colorType = action.payload;
    },
    setParticleCustomColor: (
      state,
      action: PayloadAction<{ r: number; g: number; b: number; a: number }>
    ) => {
      state.customColor = action.payload;
    },
    setParticleHue: (state, action: PayloadAction<number>) => {
      state.hue = Math.min(1, Math.max(0, action.payload));
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
  setParticleColorType,
  setParticleCustomColor,
  setParticleHue,
  resetParticle,
  importParticleSettings,
} = particleSlice.actions;

export const particleReducer = particleSlice.reducer;

// Selectors
export const selectParticle = (state: { particle: ParticleModuleState }) =>
  state.particle;
