import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_ECA_RULE } from "@cazala/party";

export interface ElementaryCAModuleState {
  enabled: boolean;
  rule: number;
}

const initialState: ElementaryCAModuleState = {
  enabled: false,
  rule: DEFAULT_ECA_RULE,
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
  resetElementaryCA,
  importElementaryCASettings,
} = elementaryCaSlice.actions;

export const elementaryCaReducer = elementaryCaSlice.reducer;

export const selectElementaryCA = (state: {
  elementaryCa: ElementaryCAModuleState;
}) => state.elementaryCa;
