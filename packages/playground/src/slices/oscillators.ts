import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OscillationSpeed = "slow" | "normal" | "fast";

export interface OscillatorData {
  // Core values
  speedHz: number;
  customMin: number;
  customMax: number;
  // Optional mapping to engine input
  moduleName?: string;
  inputName?: string;
  // Optional per-oscillator options
  curveExponent?: number;
  jitter?: boolean | number;
}

export interface OscillatorsState {
  // Map of sliderId -> oscillator configuration (active only)
  oscillators: Record<string, OscillatorData>;
}

const initialState: OscillatorsState = {
  oscillators: {},
};

// Helper mapping for UI presets (optional use)
const presetToHz: Record<OscillationSpeed, number> = {
  slow: 0.01,
  normal: 0.05,
  fast: 0.2,
};

const oscillatorsSlice = createSlice({
  name: "oscillators",
  initialState,
  reducers: {
    setOscillator: (
      state,
      action: PayloadAction<{ sliderId: string; config: OscillatorData }>
    ) => {
      const { sliderId, config } = action.payload;
      state.oscillators[sliderId] = config;
    },

    removeOscillator: (state, action: PayloadAction<string>) => {
      const sliderId = action.payload;
      delete state.oscillators[sliderId];
    },

    // Back-compat UI action: accepts preset labels and stores as Hz
    updateOscillatorSpeed: (
      state,
      action: PayloadAction<{ sliderId: string; speed: OscillationSpeed }>
    ) => {
      const { sliderId, speed } = action.payload;
      if (state.oscillators[sliderId]) {
        state.oscillators[sliderId].speedHz = presetToHz[speed];
      }
    },

    // New numeric-speed action
    updateOscillatorSpeedHz: (
      state,
      action: PayloadAction<{ sliderId: string; speedHz: number }>
    ) => {
      const { sliderId, speedHz } = action.payload;
      if (state.oscillators[sliderId]) {
        state.oscillators[sliderId].speedHz = speedHz;
      }
    },

    updateOscillatorBounds: (
      state,
      action: PayloadAction<{
        sliderId: string;
        customMin: number;
        customMax: number;
      }>
    ) => {
      const { sliderId, customMin, customMax } = action.payload;
      if (state.oscillators[sliderId]) {
        state.oscillators[sliderId].customMin = customMin;
        state.oscillators[sliderId].customMax = customMax;
      }
    },

    updateOscillatorMin: (
      state,
      action: PayloadAction<{ sliderId: string; customMin: number }>
    ) => {
      const { sliderId, customMin } = action.payload;
      if (state.oscillators[sliderId]) {
        state.oscillators[sliderId].customMin = customMin;
      }
    },

    updateOscillatorMax: (
      state,
      action: PayloadAction<{ sliderId: string; customMax: number }>
    ) => {
      const { sliderId, customMax } = action.payload;
      if (state.oscillators[sliderId]) {
        state.oscillators[sliderId].customMax = customMax;
      }
    },

    clearAllOscillators: (state) => {
      state.oscillators = {};
    },
  },
});

export const {
  setOscillator,
  removeOscillator,
  updateOscillatorSpeed,
  updateOscillatorSpeedHz,
  updateOscillatorBounds,
  updateOscillatorMin,
  updateOscillatorMax,
  clearAllOscillators,
} = oscillatorsSlice.actions;

export const oscillatorsReducer = oscillatorsSlice.reducer;

// Selectors
export const selectOscillators = (state: { oscillators: OscillatorsState }) =>
  state.oscillators.oscillators;

export const selectOscillator = (
  state: { oscillators: OscillatorsState },
  sliderId: string
) => state.oscillators.oscillators[sliderId];

export const selectIsOscillating = (
  state: { oscillators: OscillatorsState },
  sliderId: string
) => !!state.oscillators.oscillators[sliderId];
