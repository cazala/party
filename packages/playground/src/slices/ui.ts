import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  showGrid: boolean;
}

const initialState: UIState = {
  showGrid: false,
};

export const uiSlice = createSlice({
  name: 'ui',
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

export const { setShowGrid, toggleShowGrid } = uiSlice.actions;

// Selectors
export const selectShowGrid = (state: { ui: UIState }) => state.ui.showGrid;

export default uiSlice.reducer;