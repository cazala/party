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

// Thunk to toggle fullscreen mode
export const toggleFullscreen = createAsyncThunk(
  "ui/toggleFullscreen",
  async (_, { dispatch }) => {
    const isCurrentlyFullscreen = !document.fullscreenElement;

    try {
      if (isCurrentlyFullscreen) {
        // Entering fullscreen
        await document.documentElement.requestFullscreen();

        // Hide bars and lock spawning
        dispatch(lockSpawnTemporarily(200));
        dispatch(setBarsVisible(false));
      } else {
        // Exiting fullscreen
        await document.exitFullscreen();

        // Show bars and lock spawning
        dispatch(lockSpawnTemporarily(200));
        dispatch(setBarsVisible(true));
      }
    } catch (error) {
      console.warn("Fullscreen API not supported or failed:", error);
    }
  }
);

// Thunk to restore bars when fullscreen is exited externally (ESC key, etc.)
export const restoreBarsFromFullscreen = createAsyncThunk(
  "ui/restoreBarsFromFullscreen",
  async (_, { dispatch }) => {
    // Show bars with spawn locking (without touching fullscreen API)
    dispatch(lockSpawnTemporarily(200));
    dispatch(setBarsVisible(true));
  }
);

export const { toggleBars, setBarsVisible } = uiSlice.actions;

// Selectors
export const selectBarsVisible = (state: { ui: UIState }) =>
  state.ui.barsVisible;

export default uiSlice.reducer;
