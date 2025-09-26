import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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
  gravityStrength: 0,
  dirX: 0,
  dirY: 1,
  inertia: 0,
  friction: 0,
  damping: 0,
  mode: "normal",
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
export const selectEnvironment = (state: { environment: EnvironmentModuleState }) =>
  state.environment;