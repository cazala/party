import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_PICFLIP_GRID_RESOLUTION,
  DEFAULT_PICFLIP_FLIP_RATIO,
  DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
  DEFAULT_PICFLIP_OVERRELAXATION,
  DEFAULT_PICFLIP_DENSITY,
  DEFAULT_PICFLIP_RADIUS,
  DEFAULT_PICFLIP_PRESSURE,
} from "@cazala/party";

export interface PicflipModuleState {
  enabled: boolean;
  gridResolution: number;
  flipRatio: number;
  pressureIterations: number;
  overrelaxation: number;
  density: number;
  radius: number;
  pressure: number;
}

const initialState: PicflipModuleState = {
  enabled: false,
  gridResolution: DEFAULT_PICFLIP_GRID_RESOLUTION,
  flipRatio: DEFAULT_PICFLIP_FLIP_RATIO,
  pressureIterations: DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
  overrelaxation: DEFAULT_PICFLIP_OVERRELAXATION,
  density: DEFAULT_PICFLIP_DENSITY,
  radius: DEFAULT_PICFLIP_RADIUS,
  pressure: DEFAULT_PICFLIP_PRESSURE,
};

export const picflipSlice = createSlice({
  name: "picflip",
  initialState,
  reducers: {
    setPicflipEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setPicflipGridResolution: (state, action: PayloadAction<number>) => {
      state.gridResolution = action.payload;
    },
    setPicflipFlipRatio: (state, action: PayloadAction<number>) => {
      state.flipRatio = action.payload;
    },
    setPicflipPressureIterations: (state, action: PayloadAction<number>) => {
      state.pressureIterations = action.payload;
    },
    setPicflipOverrelaxation: (state, action: PayloadAction<number>) => {
      state.overrelaxation = action.payload;
    },
    setPicflipDensity: (state, action: PayloadAction<number>) => {
      state.density = action.payload;
    },
    setPicflipRadius: (state, action: PayloadAction<number>) => {
      state.radius = action.payload;
    },
    setPicflipPressure: (state, action: PayloadAction<number>) => {
      state.pressure = action.payload;
    },
    resetPicflip: () => initialState,
    importPicflipSettings: (
      state,
      action: PayloadAction<Partial<PicflipModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setPicflipEnabled,
  setPicflipGridResolution,
  setPicflipFlipRatio,
  setPicflipPressureIterations,
  setPicflipOverrelaxation,
  setPicflipDensity,
  setPicflipRadius,
  setPicflipPressure,
  resetPicflip,
  importPicflipSettings,
} = picflipSlice.actions;

export const picflipReducer = picflipSlice.reducer;

// Selectors
export const selectPicflip = (state: { picflip: PicflipModuleState }) =>
  state.picflip;
