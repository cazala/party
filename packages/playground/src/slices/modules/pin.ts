import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PinModuleState {
  enabled: boolean;
  pinnedParticleIndexes: number[];
}

const initialState: PinModuleState = {
  enabled: true, // Pin module should be enabled by default
  pinnedParticleIndexes: [],
};

export const pinSlice = createSlice({
  name: "pin",
  initialState,
  reducers: {
    setPinEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setPinnedParticleIndexes: (state, action: PayloadAction<number[]>) => {
      state.pinnedParticleIndexes = action.payload;
    },
    resetPin: () => initialState,
    importPinSettings: (
      state,
      action: PayloadAction<Partial<PinModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setPinEnabled,
  setPinnedParticleIndexes,
  resetPin,
  importPinSettings,
} = pinSlice.actions;

export const pinReducer = pinSlice.reducer;

// Selectors
export const selectPin = (state: { pin: PinModuleState }) => state.pin;