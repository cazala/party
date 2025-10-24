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
  // Runtime state (optional, for session save/load)
  lastValue?: number;
  lastDirection?: -1 | 0 | 1;
  phaseOffset?: number;
  active?: boolean;
}

export type OscillatorsState = Record<string, OscillatorData>;

const initialState: OscillatorsState = {};

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
      state[sliderId] = config;
    },

    removeOscillator: (state, action: PayloadAction<string>) => {
      const sliderId = action.payload;
      delete state[sliderId];
    },

    // Back-compat UI action: accepts preset labels and stores as Hz
    updateOscillatorSpeed: (
      state,
      action: PayloadAction<{ sliderId: string; speed: OscillationSpeed }>
    ) => {
      const { sliderId, speed } = action.payload;
      if (state[sliderId]) {
        state[sliderId].speedHz = presetToHz[speed];
      }
    },

    // New numeric-speed action
    updateOscillatorSpeedHz: (
      state,
      action: PayloadAction<{ sliderId: string; speedHz: number }>
    ) => {
      const { sliderId, speedHz } = action.payload;
      if (state[sliderId]) {
        state[sliderId].speedHz = speedHz;
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
      if (state[sliderId]) {
        state[sliderId].customMin = customMin;
        state[sliderId].customMax = customMax;
      }
    },

    updateOscillatorMin: (
      state,
      action: PayloadAction<{ sliderId: string; customMin: number }>
    ) => {
      const { sliderId, customMin } = action.payload;
      if (state[sliderId]) {
        state[sliderId].customMin = customMin;
      }
    },

    updateOscillatorMax: (
      state,
      action: PayloadAction<{ sliderId: string; customMax: number }>
    ) => {
      const { sliderId, customMax } = action.payload;
      if (state[sliderId]) {
        state[sliderId].customMax = customMax;
      }
    },

    clearAllOscillators: () => {
      return {};
    },

    clearModuleOscillators: (state, action: PayloadAction<string>) => {
      const moduleName = action.payload;
      const filtered: OscillatorsState = {};
      for (const [sliderId, config] of Object.entries(state)) {
        // Check both explicit moduleName and inferred from sliderId
        let oscillatorModuleName = config.moduleName;
        if (!oscillatorModuleName) {
          // Infer module name from sliderId (e.g., "environment.gravityStrength" -> "environment")
          const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
          if (parts.length >= 2) {
            oscillatorModuleName = parts[0];
          }
        }
        
        if (oscillatorModuleName !== moduleName) {
          filtered[sliderId] = config;
        }
      }
      return filtered;
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
  clearModuleOscillators,
} = oscillatorsSlice.actions;

export const oscillatorsReducer = oscillatorsSlice.reducer;

// Selectors
export const selectOscillators = (state: { oscillators: OscillatorsState }) =>
  state.oscillators;

export const selectOscillator = (
  state: { oscillators: OscillatorsState },
  sliderId: string
) => state.oscillators[sliderId];

export const selectIsOscillating = (
  state: { oscillators: OscillatorsState },
  sliderId: string
) => !!state.oscillators[sliderId];
