import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface BehaviorModuleState {
  enabled: boolean;
  wander: number;
  cohesion: number;
  alignment: number;
  repulsion: number;
  chase: number;
  avoid: number;
  separation: number;
  viewRadius: number;
  viewAngle: number; // stored in radians, displayed in degrees
}

const initialState: BehaviorModuleState = {
  enabled: false,
  wander: 5,
  cohesion: 1,
  alignment: 1,
  repulsion: 2,
  chase: 0,
  avoid: 0,
  separation: 25,
  viewRadius: 50,
  viewAngle: Math.PI / 3, // 60 degrees in radians
};

export const behaviorSlice = createSlice({
  name: "behavior",
  initialState,
  reducers: {
    setBehaviorEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setBehaviorWander: (state, action: PayloadAction<number>) => {
      state.wander = action.payload;
    },
    setBehaviorCohesion: (state, action: PayloadAction<number>) => {
      state.cohesion = action.payload;
    },
    setBehaviorAlignment: (state, action: PayloadAction<number>) => {
      state.alignment = action.payload;
    },
    setBehaviorRepulsion: (state, action: PayloadAction<number>) => {
      state.repulsion = action.payload;
    },
    setBehaviorChase: (state, action: PayloadAction<number>) => {
      state.chase = action.payload;
    },
    setBehaviorAvoid: (state, action: PayloadAction<number>) => {
      state.avoid = action.payload;
    },
    setBehaviorSeparation: (state, action: PayloadAction<number>) => {
      state.separation = action.payload;
    },
    setBehaviorViewRadius: (state, action: PayloadAction<number>) => {
      state.viewRadius = action.payload;
    },
    setBehaviorViewAngle: (state, action: PayloadAction<number>) => {
      state.viewAngle = action.payload;
    },
    resetBehavior: () => initialState,
    importBehaviorSettings: (
      state,
      action: PayloadAction<Partial<BehaviorModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setBehaviorEnabled,
  setBehaviorWander,
  setBehaviorCohesion,
  setBehaviorAlignment,
  setBehaviorRepulsion,
  setBehaviorChase,
  setBehaviorAvoid,
  setBehaviorSeparation,
  setBehaviorViewRadius,
  setBehaviorViewAngle,
  resetBehavior,
  importBehaviorSettings,
} = behaviorSlice.actions;

export const behaviorReducer = behaviorSlice.reducer;

// Selectors
export const selectBehavior = (state: { behavior: BehaviorModuleState }) =>
  state.behavior;