import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface RenderState {
  invertColors: boolean;
}

const initialState: RenderState = {
  invertColors: false,
};

const renderSlice = createSlice({
  name: "render",
  initialState,
  reducers: {
    setInvertColors: (state, action: PayloadAction<boolean>) => {
      state.invertColors = action.payload;
    },
    toggleInvertColors: (state) => {
      state.invertColors = !state.invertColors;
    },
    importRenderSettings: (state, action: PayloadAction<RenderState>) => {
      return { ...state, ...action.payload };
    },
    resetRenderSettings: () => initialState,
  },
});

export const {
  setInvertColors,
  toggleInvertColors,
  importRenderSettings,
  resetRenderSettings,
} = renderSlice.actions;

export const renderReducer = renderSlice.reducer;

export const selectInvertColors = (state: { render: RenderState }) =>
  state.render.invertColors;
