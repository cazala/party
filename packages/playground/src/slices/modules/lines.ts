import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Line } from "@cazala/party";

export interface LinesModuleState {
  enabled: boolean;
  list: Line[];
  lineWidth: number;
  lineColor: { r: number; g: number; b: number; a: number } | null;
}

const initialState: LinesModuleState = {
  enabled: false,
  list: [],
  lineWidth: 1.5,
  lineColor: null,
};

export const linesSlice = createSlice({
  name: "modules/lines",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setLineWidth: (state, action: PayloadAction<number>) => {
      state.lineWidth = action.payload;
    },
    setLineColor: (
      state,
      action: PayloadAction<{
        r: number;
        g: number;
        b: number;
        a: number;
      } | null>
    ) => {
      state.lineColor = action.payload;
    },
    setLines: (state, action: PayloadAction<Line[]>) => {
      state.list = action.payload;
    },
    reset: () => initialState,
    importSettings: (state, action: PayloadAction<LinesModuleState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setLinesEnabled,
  setLineWidth: setLineWidth,
  setLineColor: setLineColor,
  setLines: setLines,
  reset: resetLines,
  importSettings: importLinesSettings,
} = linesSlice.actions;

export const linesReducer = linesSlice.reducer;

// Selectors
export const selectLines = (state: { lines: LinesModuleState }) => state.lines;
