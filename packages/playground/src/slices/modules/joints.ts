import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  DEFAULT_JOINTS_ENABLE_JOINT_COLLISIONS,
  DEFAULT_JOINTS_ENABLE_PARTICLE_COLLISIONS,
  DEFAULT_JOINTS_STEPS,
  DEFAULT_JOINTS_SEPARATION,
  DEFAULT_JOINTS_MOMENTUM,
  DEFAULT_JOINTS_RESTITUTION,
  Joint,
  DEFAULT_JOINTS_FRICTION,
} from "@cazala/party";

export interface JointsModuleState {
  enabled: boolean;
  enableParticleCollisions: boolean;
  enableJointCollisions: boolean;
  list: Joint[];
  momentum: number;
  restitution: number;
  separation: number;
  steps: number;
  friction: number;
}

const initialState: JointsModuleState = {
  enabled: false,
  enableParticleCollisions: !!DEFAULT_JOINTS_ENABLE_PARTICLE_COLLISIONS,
  enableJointCollisions: !!DEFAULT_JOINTS_ENABLE_JOINT_COLLISIONS,
  list: [],
  momentum: DEFAULT_JOINTS_MOMENTUM,
  restitution: DEFAULT_JOINTS_RESTITUTION,
  separation: DEFAULT_JOINTS_SEPARATION,
  steps: DEFAULT_JOINTS_STEPS,
  friction: DEFAULT_JOINTS_FRICTION,
};

export const jointsSlice = createSlice({
  name: "modules/joints",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
    setEnableParticleCollisions: (state, action: PayloadAction<boolean>) => {
      state.enableParticleCollisions = action.payload;
    },
    setEnableJointCollisions: (state, action: PayloadAction<boolean>) => {
      state.enableJointCollisions = action.payload;
    },
    setMomentum: (state, action: PayloadAction<number>) => {
      state.momentum = Math.max(0, Math.min(1, action.payload)); // Clamp between 0 and 1
    },
    setJoints: (state, action: PayloadAction<Joint[]>) => {
      state.list = action.payload;
    },
    setRestitution: (state, action: PayloadAction<number>) => {
      state.restitution = Math.max(0, Math.min(1, action.payload));
    },
    setSeparation: (state, action: PayloadAction<number>) => {
      state.separation = Math.max(0, Math.min(0.5, action.payload));
    },
    setSteps: (state, action: PayloadAction<number>) => {
      state.steps = Math.max(0, Math.min(100, Math.floor(action.payload)));
    },
    setFriction: (state, action: PayloadAction<number>) => {
      state.friction = Math.max(0, Math.min(1, action.payload));
    },
    resetJoints: () => initialState,
    importSettings: (state, action: PayloadAction<Partial<JointsModuleState>>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setEnabled: setJointsEnabled,
  setEnableParticleCollisions,
  setEnableJointCollisions,
  setMomentum,
  setJoints,
  setRestitution,
  setSeparation,
  setSteps,
  setFriction,
  resetJoints,
  importSettings: importJointsSettings,
} = jointsSlice.actions;

export const jointsReducer = jointsSlice.reducer;

// Selectors
export const selectJoints = (state: { joints: JointsModuleState }) =>
  state.joints;
