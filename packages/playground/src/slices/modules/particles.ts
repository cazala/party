import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ParticlesColorType } from "@cazala/party";

export interface ParticlesModuleState {
  enabled: boolean;
  colorType: ParticlesColorType; // 0 default, 1 custom, 2 hue
  customColor: { r: number; g: number; b: number; a: number };
  hue: number; // 0..1
}

const initialState: ParticlesModuleState = {
  enabled: true,
  colorType: ParticlesColorType.Default,
  customColor: { r: 1, g: 1, b: 1, a: 1 },
  hue: 0,
};

export const particlesSlice = createSlice({
  name: "particles",
  initialState,
  reducers: {
    setParticlesEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setParticlesColorType: (
      state,
      action: PayloadAction<ParticlesColorType>
    ) => {
      state.colorType = action.payload;
    },
    setParticlesCustomColor: (
      state,
      action: PayloadAction<{ r: number; g: number; b: number; a: number }>
    ) => {
      state.customColor = action.payload;
    },
    setParticlesHue: (state, action: PayloadAction<number>) => {
      state.hue = Math.min(1, Math.max(0, action.payload));
    },
    resetParticles: () => initialState,
    importParticlesSettings: (
      state,
      action: PayloadAction<Partial<ParticlesModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setParticlesEnabled,
  setParticlesColorType,
  setParticlesCustomColor,
  setParticlesHue,
  resetParticles,
  importParticlesSettings,
} = particlesSlice.actions;

export const particlesReducer = particlesSlice.reducer;

// Selectors
export const selectParticles = (state: { particles: ParticlesModuleState }) =>
  state.particles;
