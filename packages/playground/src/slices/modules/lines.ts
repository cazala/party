import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface LinesModuleState {
  enabled: boolean;
  aIndexes: number[];
  bIndexes: number[];
  lineWidth: number;
}

const initialState: LinesModuleState = {
  enabled: true,
  aIndexes: [],
  bIndexes: [],
  lineWidth: 1.5,
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
    setLines: (
      state,
      action: PayloadAction<{
        aIndexes: number[];
        bIndexes: number[];
      }>
    ) => {
      state.aIndexes = action.payload.aIndexes;
      state.bIndexes = action.payload.bIndexes;
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
  setLines: setLines,
  reset: resetLines,
  importSettings: importLinesSettings,
} = linesSlice.actions;

export const linesReducer = linesSlice.reducer;

// Selectors
export const selectLines = (state: { lines: LinesModuleState }) => state.lines;
