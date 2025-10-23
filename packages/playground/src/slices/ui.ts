import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { lockSpawnTemporarily } from "./init";

// UI layout constants
export const LAYOUT_CONSTANTS = {
  LEFT_SIDEBAR_WIDTH: 280,
  RIGHT_SIDEBAR_WIDTH: 320,
  TOPBAR_HEIGHT: 60,
  TOOLBAR_HEIGHT: 60,
} as const;

export interface UIState {
  barsVisible: boolean;
}

const initialState: UIState = {
  barsVisible: true,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleBars: (state) => {
      state.barsVisible = !state.barsVisible;
    },
    setBarsVisible: (state, action: PayloadAction<boolean>) => {
      state.barsVisible = action.payload;
    },
  },
});

// Thunk to toggle bars with spawn locking
export const toggleBarsWithLock = createAsyncThunk(
  "ui/toggleBarsWithLock",
  async (_, { dispatch }) => {
    // Lock spawning before toggling bars
    dispatch(lockSpawnTemporarily(200)); // Lock for 200ms
    
    // Toggle bars
    dispatch(toggleBars());
  }
);

export const { toggleBars, setBarsVisible } = uiSlice.actions;

// Selectors
export const selectBarsVisible = (state: { ui: UIState }) => state.ui.barsVisible;

export default uiSlice.reducer;