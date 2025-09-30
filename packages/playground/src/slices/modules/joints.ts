import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface JointsModuleState {
  enabled: boolean;
  enableCollisions: boolean;
  aIndexes: number[];
  bIndexes: number[];
  restLengths: number[];
  lineWidth: number;
}

const initialState: JointsModuleState = {
  enabled: false,
  enableCollisions: true,
  aIndexes: [],
  bIndexes: [],
  restLengths: [],
  lineWidth: 1.5,
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
    setLineWidth: (state, action: PayloadAction<number>) => {
      state.lineWidth = action.payload;
    },
    setJoints: (
      state,
      action: PayloadAction<{
        aIndexes: number[];
        bIndexes: number[];
        restLengths: number[];
      }>
    ) => {
      state.aIndexes = action.payload.aIndexes;
      state.bIndexes = action.payload.bIndexes;
      state.restLengths = action.payload.restLengths;
    },
    addJoint: (
      state,
      action: PayloadAction<{ a: number; b: number; rest: number }>
    ) => {
      let { a, b, rest } = action.payload;
      if (a === b) return;
      if (b < a) [a, b] = [b, a];
      // dedupe
      for (let i = 0; i < state.aIndexes.length; i++) {
        if (state.aIndexes[i] === a && state.bIndexes[i] === b) return;
      }
      state.aIndexes.push(a);
      state.bIndexes.push(b);
      state.restLengths.push(rest);
    },
    removeJoint: (state, action: PayloadAction<number>) => {
      const i = action.payload;
      if (i < 0 || i >= state.aIndexes.length) return;
      state.aIndexes.splice(i, 1);
      state.bIndexes.splice(i, 1);
      state.restLengths.splice(i, 1);
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
  setLineWidth,
  setJoints,
  addJoint,
  removeJoint,
  reset,
  importSettings: importJointsSettings,
} = jointsSlice.actions;

export const jointsReducer = jointsSlice.reducer;

// Selectors
export const selectJoints = (state: {
  joints: JointsModuleState;
}) => state.joints;
