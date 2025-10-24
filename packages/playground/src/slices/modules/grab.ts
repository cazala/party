import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_GRAB_GRABBED_INDEX,
  DEFAULT_GRAB_POSITION_X,
  DEFAULT_GRAB_POSITION_Y,
} from "@cazala/party";

export interface GrabModuleState {
  enabled: boolean;
  grabbedIndex: number;
  positionX: number;
  positionY: number;
}

const initialState: GrabModuleState = {
  enabled: false,
  grabbedIndex: DEFAULT_GRAB_GRABBED_INDEX,
  positionX: DEFAULT_GRAB_POSITION_X,
  positionY: DEFAULT_GRAB_POSITION_Y,
};

export const grabSlice = createSlice({
  name: "modules/grab",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setGrabbedIndex: (state, action: PayloadAction<number>) => {
      state.grabbedIndex = Math.floor(action.payload);
    },
    setPositionX: (state, action: PayloadAction<number>) => {
      state.positionX = action.payload;
    },
    setPositionY: (state, action: PayloadAction<number>) => {
      state.positionY = action.payload;
    },
    setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.positionX = action.payload.x;
      state.positionY = action.payload.y;
    },
    grabParticle: (
      state,
      action: PayloadAction<{
        index: number;
        position: { x: number; y: number };
      }>
    ) => {
      state.grabbedIndex = Math.floor(action.payload.index);
      state.positionX = action.payload.position.x;
      state.positionY = action.payload.position.y;
    },
    releaseGrab: (state) => {
      state.grabbedIndex = -1;
    },
    reset: () => initialState,
    clearGrab: (state) => {
      state.grabbedIndex = -1;
      state.positionX = DEFAULT_GRAB_POSITION_X;
      state.positionY = DEFAULT_GRAB_POSITION_Y;
    },
    importSettings: (state, action: PayloadAction<GrabModuleState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setGrabEnabled,
  setGrabbedIndex,
  setPositionX,
  setPositionY,
  setPosition,
  grabParticle,
  releaseGrab,
  reset: resetGrab,
  clearGrab,
  importSettings: importGrabSettings,
} = grabSlice.actions;

export const grabReducer = grabSlice.reducer;

// Selectors
export const selectGrab = (state: { grab: GrabModuleState }) => state.grab;
