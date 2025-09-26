import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CollisionsModuleState {
  enabled: boolean;
  restitution: number;
}

const initialState: CollisionsModuleState = {
  enabled: true,
  restitution: 0.8,
};

export const collisionsSlice = createSlice({
  name: "collisions",
  initialState,
  reducers: {
    setCollisionsEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setCollisionsRestitution: (state, action: PayloadAction<number>) => {
      state.restitution = action.payload;
    },
    resetCollisions: () => initialState,
    importCollisionsSettings: (
      state,
      action: PayloadAction<Partial<CollisionsModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setCollisionsEnabled,
  setCollisionsRestitution,
  resetCollisions,
  importCollisionsSettings,
} = collisionsSlice.actions;

export const collisionsReducer = collisionsSlice.reducer;

// Selectors
export const selectCollisions = (state: { collisions: CollisionsModuleState }) =>
  state.collisions;