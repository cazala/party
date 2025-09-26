import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_BOUNDARY_RESTITUTION,
  DEFAULT_BOUNDARY_FRICTION,
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
} from "@cazala/party";

export interface BoundaryModuleState {
  enabled: boolean;
  restitution: number;
  friction: number;
  mode: "bounce" | "warp" | "kill" | "none";
  repelDistance: number;
  repelStrength: number;
}

const initialState: BoundaryModuleState = {
  enabled: true,
  restitution: DEFAULT_BOUNDARY_RESTITUTION,
  friction: DEFAULT_BOUNDARY_FRICTION,
  mode: DEFAULT_BOUNDARY_MODE,
  repelDistance: DEFAULT_BOUNDARY_REPEL_DISTANCE,
  repelStrength: DEFAULT_BOUNDARY_REPEL_STRENGTH,
};

export const boundarySlice = createSlice({
  name: "boundary",
  initialState,
  reducers: {
    setBoundaryEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setBoundaryMode: (
      state,
      action: PayloadAction<BoundaryModuleState["mode"]>
    ) => {
      state.mode = action.payload;
    },
    setBoundaryRestitution: (state, action: PayloadAction<number>) => {
      state.restitution = action.payload;
    },
    setBoundaryFriction: (state, action: PayloadAction<number>) => {
      state.friction = action.payload;
    },
    setBoundaryRepelDistance: (state, action: PayloadAction<number>) => {
      state.repelDistance = action.payload;
    },
    setBoundaryRepelStrength: (state, action: PayloadAction<number>) => {
      state.repelStrength = action.payload;
    },
    resetBoundary: () => initialState,
    importBoundarySettings: (
      state,
      action: PayloadAction<Partial<BoundaryModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setBoundaryEnabled,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
  resetBoundary,
  importBoundarySettings,
} = boundarySlice.actions;

export const boundaryReducer = boundarySlice.reducer;

// Selectors
export const selectBoundary = (state: { boundary: BoundaryModuleState }) =>
  state.boundary;
