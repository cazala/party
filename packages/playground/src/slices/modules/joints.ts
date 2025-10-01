import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Joint } from "@cazala/party";

export interface JointsModuleState {
  enabled: boolean;
  enableCollisions: boolean;
  list: Joint[];
  momentum: number;
}

const initialState: JointsModuleState = {
  enabled: true,
  enableCollisions: true,
  list: [],
  momentum: 0.7,
};

export const jointsSlice = createSlice({
  name: "modules/joints",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setEnableCollisions: (state, action: PayloadAction<boolean>) => {
      state.enableCollisions = action.payload;
    },
    setMomentum: (state, action: PayloadAction<number>) => {
      state.momentum = Math.max(0, Math.min(1, action.payload)); // Clamp between 0 and 1
    },
    setJoints: (state, action: PayloadAction<Joint[]>) => {
      state.list = action.payload;
    },
    addJoint: (
      state,
      action: PayloadAction<{ a: number; b: number; rest: number }>
    ) => {
      let { a, b, rest } = action.payload;
      if (a === b) return;
      if (b < a) [a, b] = [b, a];
      // dedupe
      for (let i = 0; i < state.list.length; i++) {
        if (state.list[i].aIndex === a && state.list[i].bIndex === b) return;
      }
      state.list.push({ aIndex: a, bIndex: b, restLength: rest });
    },
    removeJoint: (state, action: PayloadAction<number>) => {
      const i = action.payload;
      if (i < 0 || i >= state.list.length) return;
      state.list.splice(i, 1);
    },
    reset: () => initialState,
    importSettings: (state, action: PayloadAction<JointsModuleState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setJointsEnabled,
  setEnableCollisions,
  setMomentum,
  setJoints,
  addJoint,
  removeJoint,
  reset,
  importSettings: importJointsSettings,
} = jointsSlice.actions;

export const jointsReducer = jointsSlice.reducer;

// Selectors
export const selectJoints = (state: { joints: JointsModuleState }) =>
  state.joints;
