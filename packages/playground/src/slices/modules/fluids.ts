import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_FLUIDS_INFLUENCE_RADIUS,
  DEFAULT_FLUIDS_TARGET_DENSITY,
  DEFAULT_FLUIDS_PRESSURE_MULTIPLIER,
  DEFAULT_FLUIDS_VISCOSITY,
  DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_FLUIDS_NEAR_THRESHOLD,
  DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE,
  DEFAULT_FLUIDS_MAX_ACCELERATION,
  DEFAULT_PICFLIP_FLIP_RATIO,
  FluidsMethod,
} from "@cazala/party";

export interface FluidsModuleState {
  enabled: boolean;
  method: FluidsMethod;
  influenceRadius: number;
  targetDensity: number;
  pressureMultiplier: number;
  viscosity: number;
  // PIC/FLIP-only (used when method === "picflip")
  flipRatio: number;
  nearPressureMultiplier: number;
  nearThreshold: number;
  enableNearPressure: boolean;
  maxAcceleration: number;
}

const initialState: FluidsModuleState = {
  enabled: false,
  method: FluidsMethod.Sph,
  influenceRadius: DEFAULT_FLUIDS_INFLUENCE_RADIUS,
  targetDensity: DEFAULT_FLUIDS_TARGET_DENSITY,
  pressureMultiplier: DEFAULT_FLUIDS_PRESSURE_MULTIPLIER,
  viscosity: DEFAULT_FLUIDS_VISCOSITY,
  flipRatio: DEFAULT_PICFLIP_FLIP_RATIO,
  nearPressureMultiplier: DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
  nearThreshold: DEFAULT_FLUIDS_NEAR_THRESHOLD,
  enableNearPressure: DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE,
  maxAcceleration: DEFAULT_FLUIDS_MAX_ACCELERATION,
};

export const fluidsSlice = createSlice({
  name: "fluids",
  initialState,
  reducers: {
    setFluidsEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setFluidsMethod: (state, action: PayloadAction<FluidsMethod>) => {
      state.method = action.payload;
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
    setFluidsFlipRatio: (state, action: PayloadAction<number>) => {
      state.flipRatio = action.payload;
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
  setFluidsMethod,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsFlipRatio,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
  resetFluids,
  importFluidsSettings,
} = fluidsSlice.actions;

export const fluidsReducer = fluidsSlice.reducer;

// Selectors
export const selectFluids = (state: { fluids: FluidsModuleState }) =>
  state.fluids;
