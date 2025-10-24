import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PerformanceState {
  showGrid: boolean;
}

const initialState: PerformanceState = {
  showGrid: false,
};

export const performanceSlice = createSlice({
  name: "performance",
  initialState,
  reducers: {
    setShowGrid: (state, action: PayloadAction<boolean>) => {
      state.showGrid = action.payload;
    },
    toggleShowGrid: (state) => {
      state.showGrid = !state.showGrid;
    },
  },
});

export const { setShowGrid, toggleShowGrid } = performanceSlice.actions;

// Selectors
export const selectShowGrid = (state: { performance: PerformanceState }) =>
  state.performance.showGrid;

export const performanceReducer = performanceSlice.reducer;
