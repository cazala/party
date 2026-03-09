import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_RD_FEED,
  DEFAULT_RD_KILL,
  DEFAULT_RD_DIFFUSION_A,
  DEFAULT_RD_DIFFUSION_B,
  DEFAULT_RD_DT,
  DEFAULT_RD_CELL_SIZE,
} from "@cazala/party";

export interface ReactionDiffusionModuleState {
  enabled: boolean;
  feed: number;
  kill: number;
  diffusionA: number;
  diffusionB: number;
  dt: number;
  cellSize: number;
}

const initialState: ReactionDiffusionModuleState = {
  enabled: false,
  feed: DEFAULT_RD_FEED,
  kill: DEFAULT_RD_KILL,
  diffusionA: DEFAULT_RD_DIFFUSION_A,
  diffusionB: DEFAULT_RD_DIFFUSION_B,
  dt: DEFAULT_RD_DT,
  cellSize: DEFAULT_RD_CELL_SIZE,
};

export const reactionDiffusionSlice = createSlice({
  name: "reactionDiffusion",
  initialState,
  reducers: {
    setReactionDiffusionEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setReactionDiffusionFeed: (state, action: PayloadAction<number>) => {
      state.feed = action.payload;
    },
    setReactionDiffusionKill: (state, action: PayloadAction<number>) => {
      state.kill = action.payload;
    },
    setReactionDiffusionDiffusionA: (state, action: PayloadAction<number>) => {
      state.diffusionA = action.payload;
    },
    setReactionDiffusionDiffusionB: (state, action: PayloadAction<number>) => {
      state.diffusionB = action.payload;
    },
    setReactionDiffusionDt: (state, action: PayloadAction<number>) => {
      state.dt = action.payload;
    },
    setReactionDiffusionCellSize: (state, action: PayloadAction<number>) => {
      state.cellSize = action.payload;
    },
    resetReactionDiffusion: () => initialState,
    importReactionDiffusionSettings: (
      state,
      action: PayloadAction<Partial<ReactionDiffusionModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setReactionDiffusionEnabled,
  setReactionDiffusionFeed,
  setReactionDiffusionKill,
  setReactionDiffusionDiffusionA,
  setReactionDiffusionDiffusionB,
  setReactionDiffusionDt,
  setReactionDiffusionCellSize,
  resetReactionDiffusion,
  importReactionDiffusionSettings,
} = reactionDiffusionSlice.actions;

export const reactionDiffusionReducer = reactionDiffusionSlice.reducer;

export const selectReactionDiffusion = (state: {
  reactionDiffusion: ReactionDiffusionModuleState;
}) => state.reactionDiffusion;
