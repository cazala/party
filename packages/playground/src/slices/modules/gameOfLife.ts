import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_GOL_BIRTH_MASK,
  DEFAULT_GOL_SURVIVE_MASK,
  DEFAULT_GOL_SEED_DENSITY,
} from "@cazala/party";

export interface GameOfLifeModuleState {
  enabled: boolean;
  birthMask: number;
  surviveMask: number;
  seedDensity: number;
}

const initialState: GameOfLifeModuleState = {
  enabled: false,
  birthMask: DEFAULT_GOL_BIRTH_MASK,
  surviveMask: DEFAULT_GOL_SURVIVE_MASK,
  seedDensity: DEFAULT_GOL_SEED_DENSITY,
};

export const gameOfLifeSlice = createSlice({
  name: "gameOfLife",
  initialState,
  reducers: {
    setGameOfLifeEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setGameOfLifeBirthMask: (state, action: PayloadAction<number>) => {
      state.birthMask = action.payload;
    },
    setGameOfLifeSurviveMask: (state, action: PayloadAction<number>) => {
      state.surviveMask = action.payload;
    },
    setGameOfLifeSeedDensity: (state, action: PayloadAction<number>) => {
      state.seedDensity = action.payload;
    },
    resetGameOfLife: () => initialState,
    importGameOfLifeSettings: (
      state,
      action: PayloadAction<Partial<GameOfLifeModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setGameOfLifeEnabled,
  setGameOfLifeBirthMask,
  setGameOfLifeSurviveMask,
  setGameOfLifeSeedDensity,
  resetGameOfLife,
  importGameOfLifeSettings,
} = gameOfLifeSlice.actions;

export const gameOfLifeReducer = gameOfLifeSlice.reducer;

export const selectGameOfLife = (state: { gameOfLife: GameOfLifeModuleState }) =>
  state.gameOfLife;
