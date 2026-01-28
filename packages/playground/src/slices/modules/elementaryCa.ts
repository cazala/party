import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_ECA_RULE, DEFAULT_ECA_CELL_SIZE } from "@cazala/party";

export interface ElementaryCAModuleState {
  enabled: boolean;
  rule: number;
  cellSize: number;
}

const initialState: ElementaryCAModuleState = {
  enabled: false,
  rule: DEFAULT_ECA_RULE,
  cellSize: DEFAULT_ECA_CELL_SIZE,
};

export const elementaryCaSlice = createSlice({
  name: "elementaryCa",
  initialState,
  reducers: {
    setElementaryCAEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setElementaryCARule: (state, action: PayloadAction<number>) => {
      state.rule = action.payload;
    },
    setElementaryCACellSize: (state, action: PayloadAction<number>) => {
      state.cellSize = action.payload;
    },
    resetElementaryCA: () => initialState,
    importElementaryCASettings: (
      state,
      action: PayloadAction<Partial<ElementaryCAModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setElementaryCAEnabled,
  setElementaryCARule,
  setElementaryCACellSize,
  resetElementaryCA,
  importElementaryCASettings,
} = elementaryCaSlice.actions;

export const elementaryCaReducer = elementaryCaSlice.reducer;

export const selectElementaryCA = (state: {
  elementaryCa: ElementaryCAModuleState;
}) => state.elementaryCa;
