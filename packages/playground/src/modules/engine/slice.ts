import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface EngineState {
  isWebGPU: boolean;
  isAutoMode: boolean;
  isPlaying: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  constrainIterations: number;
  gridCellSize: number;
  particleCount: number;
  fps: number;
  clearColor: { r: number; g: number; b: number; a: number };
  size: { width: number; height: number };
  camera: { x: number; y: number };
  zoom: number;
}

const initialState: EngineState = {
  isWebGPU: false,
  isAutoMode: true,
  isPlaying: true,
  isInitialized: false,
  isInitializing: false,
  error: null,
  constrainIterations: 5,
  gridCellSize: 32,
  particleCount: 0,
  fps: 0,
  clearColor: { r: 0, g: 0, b: 0, a: 1 },
  size: { width: 800, height: 600 },
  camera: { x: 0, y: 0 },
  zoom: 1,
};

export const engineSlice = createSlice({
  name: 'engine',
  initialState,
  reducers: {
    setWebGPU: (state, action: PayloadAction<boolean>) => {
      state.isWebGPU = action.payload;
    },
    setAutoMode: (state, action: PayloadAction<boolean>) => {
      state.isAutoMode = action.payload;
    },
    setPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    play: (state) => {
      state.isPlaying = true;
    },
    pause: (state) => {
      state.isPlaying = false;
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.isInitializing = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setConstrainIterations: (state, action: PayloadAction<number>) => {
      state.constrainIterations = action.payload;
    },
    setGridCellSize: (state, action: PayloadAction<number>) => {
      state.gridCellSize = action.payload;
    },
    setParticleCount: (state, action: PayloadAction<number>) => {
      state.particleCount = action.payload;
    },
    setFPS: (state, action: PayloadAction<number>) => {
      state.fps = action.payload;
    },
    setClearColor: (state, action: PayloadAction<{ r: number; g: number; b: number; a: number }>) => {
      state.clearColor = action.payload;
    },
    setSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
      state.size = action.payload;
    },
    setCamera: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.camera = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    toggleEngineType: (state) => {
      state.isAutoMode = false;
      state.isWebGPU = !state.isWebGPU;
      // Set default constraint iterations based on engine type
      state.constrainIterations = state.isWebGPU ? 50 : 5;
    },
    updateEngineState: (state, action: PayloadAction<Partial<EngineState>>) => {
      Object.assign(state, action.payload);
    },
    resetEngine: () => initialState,
  },
});

export const {
  setWebGPU,
  setAutoMode,
  setPlaying,
  play,
  pause,
  setInitialized,
  setInitializing,
  setError,
  setConstrainIterations,
  setGridCellSize,
  setParticleCount,
  setFPS,
  setClearColor,
  setSize,
  setCamera,
  setZoom,
  toggleEngineType,
  updateEngineState,
  resetEngine,
} = engineSlice.actions;

export const engineReducer = engineSlice.reducer;

// Selectors
export const selectEngineState = (state: { engine: EngineState }) => state.engine;
export const selectIsWebGPU = (state: { engine: EngineState }) => state.engine.isWebGPU;
export const selectIsPlaying = (state: { engine: EngineState }) => state.engine.isPlaying;
export const selectIsInitialized = (state: { engine: EngineState }) => state.engine.isInitialized;
export const selectIsInitializing = (state: { engine: EngineState }) => state.engine.isInitializing;
export const selectError = (state: { engine: EngineState }) => state.engine.error;
export const selectParticleCount = (state: { engine: EngineState }) => state.engine.particleCount;
export const selectFPS = (state: { engine: EngineState }) => state.engine.fps;
export const selectCamera = (state: { engine: EngineState }) => state.engine.camera;
export const selectZoom = (state: { engine: EngineState }) => state.engine.zoom;
export const selectSize = (state: { engine: EngineState }) => state.engine.size;
export const selectClearColor = (state: { engine: EngineState }) => state.engine.clearColor;