import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_ENVIRONMENT_GRAVITY_DIRECTION,
  DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH,
  DEFAULT_ENVIRONMENT_INERTIA,
  DEFAULT_ENVIRONMENT_FRICTION,
  DEFAULT_ENVIRONMENT_DAMPING,
} from "@cazala/party";

export interface EnvironmentModuleState {
  enabled: boolean;
  gravityStrength: number;
  dirX: number;
  dirY: number;
  inertia: number;
  friction: number;
  damping: number;
  mode: string;
}

const initialState: EnvironmentModuleState = {
  enabled: true,
  gravityStrength: DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH,
  dirX: 0,
  dirY: 1,
  inertia: DEFAULT_ENVIRONMENT_INERTIA,
  friction: DEFAULT_ENVIRONMENT_FRICTION,
  damping: DEFAULT_ENVIRONMENT_DAMPING,
  mode: DEFAULT_ENVIRONMENT_GRAVITY_DIRECTION,
};

export const environmentSlice = createSlice({
  name: "environment",
  initialState,
  reducers: {
    setEnvironmentEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setEnvironmentGravityStrength: (state, action: PayloadAction<number>) => {
      state.gravityStrength = action.payload;
    },
    setEnvironmentInertia: (state, action: PayloadAction<number>) => {
      state.inertia = action.payload;
    },
    setEnvironmentFriction: (state, action: PayloadAction<number>) => {
      state.friction = action.payload;
    },
    setEnvironmentDamping: (state, action: PayloadAction<number>) => {
      state.damping = action.payload;
    },
    setEnvironmentDirection: (
      state,
      action: PayloadAction<{ dirX: number; dirY: number }>
    ) => {
      state.dirX = action.payload.dirX;
      state.dirY = action.payload.dirY;
    },
    resetEnvironment: () => initialState,
    importEnvironmentSettings: (
      state,
      action: PayloadAction<Partial<EnvironmentModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setEnvironmentEnabled,
  setEnvironmentGravityStrength,
  setEnvironmentInertia,
  setEnvironmentFriction,
  setEnvironmentDamping,
  setEnvironmentDirection,
  resetEnvironment,
  importEnvironmentSettings,
} = environmentSlice.actions;

export const environmentReducer = environmentSlice.reducer;

// Selectors
export const selectEnvironment = (state: {
  environment: EnvironmentModuleState;
}) => state.environment;
