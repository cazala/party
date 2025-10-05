import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SpawnParticlesConfig } from "./engine";

export interface InitVelocityConfig {
  speed: number;
  direction:
    | "random"
    | "in"
    | "out"
    | "custom"
    | "clockwise"
    | "counter-clockwise";
  angle: number;
}

export interface InitState extends Required<SpawnParticlesConfig> {}

const DEFAULT_SPAWN_NUM_PARTICLES = 900;
const DEFAULT_SPAWN_SHAPE = "grid" as const;
const DEFAULT_SPAWN_SPACING = 12;
const DEFAULT_SPAWN_PARTICLE_SIZE = 5;
const DEFAULT_SPAWN_RADIUS = 100;
const DEFAULT_INNER_RADIUS = 50;
const DEFAULT_SQUARE_SIZE = 200;
const DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_VELOCITY_SPEED = 0;
const DEFAULT_VELOCITY_DIRECTION = "random" as const;
const DEFAULT_VELOCITY_ANGLE = 0;

const initialState: InitState = {
  numParticles: DEFAULT_SPAWN_NUM_PARTICLES,
  shape: DEFAULT_SPAWN_SHAPE,
  spacing: DEFAULT_SPAWN_SPACING,
  particleSize: DEFAULT_SPAWN_PARTICLE_SIZE,
  particleMass: 1, // Will be calculated from size
  radius: DEFAULT_SPAWN_RADIUS,
  innerRadius: DEFAULT_INNER_RADIUS,
  squareSize: DEFAULT_SQUARE_SIZE,
  cornerRadius: DEFAULT_CORNER_RADIUS,
  colors: [],
  velocityConfig: {
    speed: DEFAULT_VELOCITY_SPEED,
    direction: DEFAULT_VELOCITY_DIRECTION,
    angle: DEFAULT_VELOCITY_ANGLE,
  },
  gridJoints: false,
};

export const initSlice = createSlice({
  name: "init",
  initialState,
  reducers: {
    setNumParticles: (state, action: PayloadAction<number>) => {
      state.numParticles = action.payload;
    },
    setSpawnShape: (state, action: PayloadAction<InitState["shape"]>) => {
      state.shape = action.payload;
    },
    setSpacing: (state, action: PayloadAction<number>) => {
      state.spacing = action.payload;
    },
    setParticleSize: (state, action: PayloadAction<number>) => {
      state.particleSize = action.payload;
    },
    setParticleMass: (state, action: PayloadAction<number>) => {
      state.particleMass = action.payload;
    },
    setRadius: (state, action: PayloadAction<number>) => {
      state.radius = action.payload;
    },
    setInnerRadius: (state, action: PayloadAction<number>) => {
      state.innerRadius = action.payload;
    },
    setSquareSize: (state, action: PayloadAction<number>) => {
      state.squareSize = action.payload;
    },
    setCornerRadius: (state, action: PayloadAction<number>) => {
      state.cornerRadius = action.payload;
    },
    setColors: (state, action: PayloadAction<string[]>) => {
      state.colors = action.payload;
    },
    setVelocityConfig: (state, action: PayloadAction<InitVelocityConfig>) => {
      state.velocityConfig = action.payload;
    },
    updateVelocityConfig: (
      state,
      action: PayloadAction<Partial<InitVelocityConfig>>
    ) => {
      state.velocityConfig = {
        ...state.velocityConfig,
        ...action.payload,
      };
    },
    setGridJoints: (state, action: PayloadAction<boolean>) => {
      state.gridJoints = action.payload;
    },
    setState: (state, action: PayloadAction<Partial<InitState>>) => {
      Object.assign(state, action.payload);
    },
    resetToDefaults: () => initialState,
  },
});

export const {
  setNumParticles,
  setSpawnShape,
  setSpacing,
  setParticleSize,
  setParticleMass,
  setRadius,
  setInnerRadius,
  setSquareSize,
  setCornerRadius,
  setColors,
  setVelocityConfig,
  updateVelocityConfig,
  setGridJoints,
  setState,
  resetToDefaults,
} = initSlice.actions;

export const initReducer = initSlice.reducer;

// Selectors
export const selectInitState = (state: { init: InitState }) => state.init;
export const selectNumParticles = (state: { init: InitState }) =>
  state.init.numParticles;
export const selectSpawnShape = (state: { init: InitState }) =>
  state.init.shape;
export const selectParticleSize = (state: { init: InitState }) =>
  state.init.particleSize;
export const selectParticleMass = (state: { init: InitState }) =>
  state.init.particleMass;
export const selectColors = (state: { init: InitState }) => state.init.colors;
export const selectVelocityConfig = (state: { init: InitState }) =>
  state.init.velocityConfig;
export const selectGridJoints = (state: { init: InitState }) =>
  state.init.gridJoints;
