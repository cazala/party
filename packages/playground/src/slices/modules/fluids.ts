import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { FluidsModuleState } from "./types";

const initialState: FluidsModuleState = {
  enabled: false,
  influenceRadius: 100,
  targetDensity: 1,
  pressureMultiplier: 30,
  viscosity: 1,
  nearPressureMultiplier: 50,
  nearThreshold: 20,
  enableNearPressure: true,
  maxAcceleration: 75,
};

export const fluidsSlice = createSlice({
  name: "fluids",
  initialState,
  reducers: {
    setFluidsEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setFluidsInfluenceRadius: (state, action: PayloadAction<number>) => {
      state.influenceRadius = action.payload;
    },
    setFluidsTargetDensity: (state, action: PayloadAction<number>) => {
      state.targetDensity = action.payload;
    },
    setFluidsPressureMultiplier: (state, action: PayloadAction<number>) => {
      state.pressureMultiplier = action.payload;
    },
    setFluidsViscosity: (state, action: PayloadAction<number>) => {
      state.viscosity = action.payload;
    },
    setFluidsNearPressureMultiplier: (state, action: PayloadAction<number>) => {
      state.nearPressureMultiplier = action.payload;
    },
    setFluidsNearThreshold: (state, action: PayloadAction<number>) => {
      state.nearThreshold = action.payload;
    },
    setFluidsEnableNearPressure: (state, action: PayloadAction<boolean>) => {
      state.enableNearPressure = action.payload;
    },
    setFluidsMaxAcceleration: (state, action: PayloadAction<number>) => {
      state.maxAcceleration = action.payload;
    },
    resetFluids: () => initialState,
    importFluidsSettings: (
      state,
      action: PayloadAction<Partial<FluidsModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setFluidsEnabled,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
  resetFluids,
  importFluidsSettings,
} = fluidsSlice.actions;

export const fluidsReducer = fluidsSlice.reducer;

// Selectors
export const selectFluidsModule = (state: { fluids: FluidsModuleState }) =>
  state.fluids;
export const selectFluidsEnabled = (state: { fluids: FluidsModuleState }) =>
  state.fluids.enabled;