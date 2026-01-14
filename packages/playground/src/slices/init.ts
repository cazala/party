import {
  createSlice,
  PayloadAction,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import { SpawnParticlesConfig } from "./engine";
import type { RootState } from "./store";

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
const DEFAULT_TEXT = "Party";
const DEFAULT_TEXT_FONT = "sans-serif";
const DEFAULT_TEXT_SIZE = 64;

export interface InitSliceState extends InitState {
  hasInitialSpawned: boolean;
  isSpawnLocked: boolean;
}

const initialState: InitSliceState = {
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
  text: DEFAULT_TEXT,
  textFont: DEFAULT_TEXT_FONT,
  textSize: DEFAULT_TEXT_SIZE,
  textPosition: { x: 0, y: 0 },
  textAlign: { horizontal: "center", vertical: "center" },
  hasInitialSpawned: false,
  isSpawnLocked: false,
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
    setText: (state, action: PayloadAction<string>) => {
      state.text = action.payload;
    },
    setTextFont: (state, action: PayloadAction<string>) => {
      state.textFont = action.payload;
    },
    setTextSize: (state, action: PayloadAction<number>) => {
      state.textSize = action.payload;
    },
    setState: (state, action: PayloadAction<Partial<InitState>>) => {
      Object.assign(state, action.payload);
    },
    setHasInitialSpawned: (state, action: PayloadAction<boolean>) => {
      state.hasInitialSpawned = action.payload;
    },
    setSpawnLocked: (state, action: PayloadAction<boolean>) => {
      state.isSpawnLocked = action.payload;
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
  setText,
  setTextFont,
  setTextSize,
  setState,
  setHasInitialSpawned,
  setSpawnLocked,
  resetToDefaults,
} = initSlice.actions;

export const initReducer = initSlice.reducer;

// Thunk to temporarily lock spawn operations during UI changes
export const lockSpawnTemporarily = createAsyncThunk(
  "init/lockSpawnTemporarily",
  async (durationMs: number = 100, { dispatch }) => {
    dispatch(setSpawnLocked(true));

    // Wait for specified duration (enough for UI transitions to settle)
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    dispatch(setSpawnLocked(false));
  }
);

// Selectors - Memoized to prevent unnecessary re-renders
export const selectInitState = createSelector(
  [(state: RootState) => state.init],
  (init): InitState => ({
    numParticles: init.numParticles,
    shape: init.shape,
    spacing: init.spacing,
    particleSize: init.particleSize,
    particleMass: init.particleMass,
    radius: init.radius,
    innerRadius: init.innerRadius,
    squareSize: init.squareSize,
    cornerRadius: init.cornerRadius,
    colors: init.colors,
    velocityConfig: init.velocityConfig,
    gridJoints: init.gridJoints,
    text: init.text,
    textFont: init.textFont,
    textSize: init.textSize,
    textPosition: init.textPosition,
    textAlign: init.textAlign,
  })
);

export const selectHasInitialSpawned = (state: RootState): boolean =>
  state.init.hasInitialSpawned;

export const selectIsSpawnLocked = (state: RootState): boolean =>
  state.init.isSpawnLocked;
