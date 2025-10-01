import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Joint } from "@cazala/party";

export interface JointsModuleState {
  enabled: boolean;
  enableCollisions: boolean;
  list: Joint[];
  momentum: number;
}

const initialState: JointsModuleState = {
  enabled: true,
  enableCollisions: true,
  list: [],
  momentum: 0.7,
};

export const jointsSlice = createSlice({
  name: "modules/joints",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setEnableCollisions: (state, action: PayloadAction<boolean>) => {
      state.enableCollisions = action.payload;
    },
    setMomentum: (state, action: PayloadAction<number>) => {
      state.momentum = Math.max(0, Math.min(1, action.payload)); // Clamp between 0 and 1
    },
    setJoints: (state, action: PayloadAction<Joint[]>) => {
      state.list = action.payload;
    },
    importSettings: (state, action: PayloadAction<JointsModuleState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setJointsEnabled,
  setEnableCollisions,
  setMomentum,
  setJoints,
  importSettings: importJointsSettings,
} = jointsSlice.actions;

export const jointsReducer = jointsSlice.reducer;

// Selectors
export const selectJoints = (state: { joints: JointsModuleState }) =>
  state.joints;
