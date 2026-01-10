import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_PICFLIP_GRID_RESOLUTION,
  DEFAULT_PICFLIP_FLIP_RATIO,
  DEFAULT_PICFLIP_GRAVITY_X,
  DEFAULT_PICFLIP_GRAVITY_Y,
  DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
  DEFAULT_PICFLIP_OVERRELAXATION,
  DEFAULT_PICFLIP_DENSITY,
  DEFAULT_PICFLIP_MAX_VELOCITY,
} from "@cazala/party";

export interface PicflipModuleState {
  enabled: boolean;
  gridResolution: number;
  flipRatio: number;
  gravityX: number;
  gravityY: number;
  pressureIterations: number;
  overrelaxation: number;
  density: number;
  maxVelocity: number;
}

const initialState: PicflipModuleState = {
  enabled: false,
  gridResolution: DEFAULT_PICFLIP_GRID_RESOLUTION,
  flipRatio: DEFAULT_PICFLIP_FLIP_RATIO,
  gravityX: DEFAULT_PICFLIP_GRAVITY_X,
  gravityY: DEFAULT_PICFLIP_GRAVITY_Y,
  pressureIterations: DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
  overrelaxation: DEFAULT_PICFLIP_OVERRELAXATION,
  density: DEFAULT_PICFLIP_DENSITY,
  maxVelocity: DEFAULT_PICFLIP_MAX_VELOCITY,
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
    setPicflipGravityX: (state, action: PayloadAction<number>) => {
      state.gravityX = action.payload;
    },
    setPicflipGravityY: (state, action: PayloadAction<number>) => {
      state.gravityY = action.payload;
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
    setPicflipMaxVelocity: (state, action: PayloadAction<number>) => {
      state.maxVelocity = action.payload;
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
  setPicflipGravityX,
  setPicflipGravityY,
  setPicflipPressureIterations,
  setPicflipOverrelaxation,
  setPicflipDensity,
  setPicflipMaxVelocity,
  resetPicflip,
  importPicflipSettings,
} = picflipSlice.actions;

export const picflipReducer = picflipSlice.reducer;

// Selectors
export const selectPicflip = (state: { picflip: PicflipModuleState }) =>
  state.picflip;
