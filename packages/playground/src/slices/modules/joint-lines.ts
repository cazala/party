import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface JointLinesModuleState {
  enabled: boolean;
  aIndexes: number[];
  bIndexes: number[];
  lineWidth: number;
}

const initialState: JointLinesModuleState = {
  enabled: false,
  aIndexes: [],
  bIndexes: [],
  lineWidth: 1.5,
};

export const jointLinesSlice = createSlice({
  name: "modules/jointLines",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setLineWidth: (state, action: PayloadAction<number>) => {
      state.lineWidth = action.payload;
    },
    setJoints: (
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
    importSettings: (state, action: PayloadAction<JointLinesModuleState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setJointLinesEnabled,
  setLineWidth: setJointLinesLineWidth,
  setJoints: setJointLinesJoints,
  reset: resetJointLines,
  importSettings: importJointLinesSettings,
} = jointLinesSlice.actions;

export const jointLinesReducer = jointLinesSlice.reducer;

// Selectors
export const selectJointLines = (state: {
  jointLines: JointLinesModuleState;
}) => state.jointLines;