import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { Engine } from "@cazala/party";
import { Spawner } from "@cazala/party";
import { clearGrab } from "./modules/grab";
import {
  setJointsEnabled,
  setEnableParticleCollisions,
  setEnableJointCollisions,
  setMomentum,
  setJoints,
  setRestitution,
  setSeparation,
  setSteps,
  setFriction,
} from "./modules/joints";
import { setLinesEnabled, setLines } from "./modules/lines";

// Type for particle data (matches engine's IParticle interface)
export interface ParticleData {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  size: number;
  mass: number;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export type SpawnParticlesConfig = {
  numParticles: number;
  shape: "grid" | "random" | "circle" | "donut" | "square";
  spacing: number;
  particleSize: number;
  radius?: number;
  colors?: string[];
  velocityConfig?: {
    speed: number;
    direction:
      | "random"
      | "in"
      | "out"
      | "custom"
      | "clockwise"
      | "counter-clockwise";
    angle: number;
  };
  innerRadius?: number;
  squareSize?: number;
  cornerRadius?: number;
  particleMass?: number;
  gridJoints?: boolean;
};

export type RuntimeType = "cpu" | "webgpu" | "webgl2";
export type RequestedRuntimeType = RuntimeType | "auto";

export interface EngineState {
  isWebGPU: boolean; // Deprecated - use actualRuntime instead
  isAutoMode: boolean;
  isPlaying: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  constrainIterations: number;
  gridCellSize: number;
  maxNeighbors: number;
  maxParticles: number | null;
  clearColor: { r: number; g: number; b: number; a: number };
  size: { width: number; height: number };
  camera: { x: number; y: number };
  zoom: number;
  // New runtime tracking fields
  requestedRuntime: RequestedRuntimeType; // What the user selected
  actualRuntime: RuntimeType; // What the engine is actually using
}

// Engine registry for thunks to access the engine instance
let engineInstance: Engine | null = null;

export const registerEngine = (engine: Engine | null) => {
  engineInstance = engine;
};

export const getEngine = (): Engine | null => engineInstance;

const initialState: EngineState = {
  isWebGPU: false,
  isAutoMode: true,
  isPlaying: true,
  isInitialized: false,
  isInitializing: false,
  error: null,
  constrainIterations: 1,
  gridCellSize: 16,
  maxNeighbors: 1000,
  maxParticles: null,
  clearColor: { r: 0, g: 0, b: 0, a: 1 },
  size: { width: 800, height: 600 },
  camera: { x: 0, y: 0 },
  zoom: 1,
  // New runtime fields
  requestedRuntime: "auto",
  actualRuntime: "cpu",
};

export const engineSlice = createSlice({
  name: "engine",
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
    setMaxNeighbors: (state, action: PayloadAction<number>) => {
      state.maxNeighbors = action.payload;
    },
    setMaxParticles: (state, action: PayloadAction<number | null>) => {
      state.maxParticles = action.payload;
    },
    setClearColor: (
      state,
      action: PayloadAction<{ r: number; g: number; b: number; a: number }>
    ) => {
      state.clearColor = action.payload;
    },
    setSize: (
      state,
      action: PayloadAction<{ width: number; height: number }>
    ) => {
      state.size = action.payload;
    },
    setCamera: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.camera = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },
    toggleRuntime: (state) => {
      state.isAutoMode = false;
      state.isWebGPU = !state.isWebGPU;
      // Note: Constraint iterations will be synced from the actual engine after recreation
    },
    setRequestedRuntime: (state, action: PayloadAction<RequestedRuntimeType>) => {
      state.requestedRuntime = action.payload;
      state.isAutoMode = action.payload === "auto";
      // Keep isWebGPU in sync for backward compatibility
      state.isWebGPU = action.payload === "webgpu";
    },
    setActualRuntime: (state, action: PayloadAction<RuntimeType>) => {
      state.actualRuntime = action.payload;
      // Keep isWebGPU in sync for backward compatibility
      state.isWebGPU = action.payload === "webgpu";
    },
    updateEngineState: (state, action: PayloadAction<Partial<EngineState>>) => {
      Object.assign(state, action.payload);
    },
    resetEngine: () => initialState,
  },
});

// Async thunks for engine actions
export const playThunk = createAsyncThunk(
  "engine/play",
  async (_, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.play();
      dispatch(engineSlice.actions.setPlaying(true));
    }
  }
);

export const pauseThunk = createAsyncThunk(
  "engine/pause",
  async (_, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.pause();
      dispatch(engineSlice.actions.setPlaying(false));
    }
  }
);

export const clearThunk = createAsyncThunk(
  "engine/clear",
  async (_, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.clear();
      // Ensure the loop continues so the cleared scene is presented
      engine.play();
      dispatch(engineSlice.actions.setPlaying(true));
      // Note: Particle count now tracked via refs in useEngineInternal

      // Clear grab module state since all particles are gone
      dispatch(clearGrab());
    }
  }
);

export const setSizeThunk = createAsyncThunk(
  "engine/setSize",
  async (size: { width: number; height: number }, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setSize(size.width, size.height);
      dispatch(engineSlice.actions.setSize(size));
    }
  }
);

export const setCameraThunk = createAsyncThunk(
  "engine/setCamera",
  async (camera: { x: number; y: number }, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setCamera(camera.x, camera.y);
      dispatch(engineSlice.actions.setCamera(camera));
    }
  }
);

export const setZoomThunk = createAsyncThunk(
  "engine/setZoom",
  async (zoom: number, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setZoom(zoom);
      dispatch(engineSlice.actions.setZoom(zoom));
    }
  }
);

export const setConstrainIterationsThunk = createAsyncThunk(
  "engine/setConstrainIterations",
  async (iterations: number, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setConstrainIterations(iterations);
      dispatch(engineSlice.actions.setConstrainIterations(iterations));
    }
  }
);

export const setCellSizeThunk = createAsyncThunk(
  "engine/setCellSize",
  async (cellSize: number, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setCellSize(cellSize);
      dispatch(engineSlice.actions.setGridCellSize(cellSize));
    }
  }
);

export const setMaxNeighborsThunk = createAsyncThunk(
  "engine/setMaxNeighbors",
  async (maxNeighbors: number, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setMaxNeighbors(maxNeighbors);
      dispatch(engineSlice.actions.setMaxNeighbors(maxNeighbors));
    }
  }
);

export const setMaxParticlesThunk = createAsyncThunk(
  "engine/setMaxParticles",
  async (maxParticles: number | null, { dispatch }) => {
    const engine = getEngine();
    if (engine) {
      engine.setMaxParticles(maxParticles);
      dispatch(engineSlice.actions.setMaxParticles(maxParticles));
    }
  }
);

export const setClearColorThunk = createAsyncThunk(
  "engine/setClearColor",
  async (
    color: { r: number; g: number; b: number; a: number },
    { dispatch }
  ) => {
    const engine = getEngine();
    if (engine) {
      engine.setClearColor(color);
      dispatch(engineSlice.actions.setClearColor(color));
    }
  }
);

export const toggleRuntimeThunk = createAsyncThunk(
  "engine/toggleRuntime",
  async (recreateEngine: () => Promise<void>, { dispatch }) => {
    const currentEngine = getEngine();

    try {
      // Capture current state if engine exists
      let capturedState = null;
      if (currentEngine) {
        const particles = await currentEngine.getParticles();
        capturedState = {
          particles,
          constrainIterations: currentEngine.getConstrainIterations(),
          cellSize: currentEngine.getCellSize(),
          maxNeighbors: currentEngine.getMaxNeighbors(),
          clearColor: currentEngine.getClearColor(),
          camera: currentEngine.getCamera(),
          zoom: currentEngine.getZoom(),
          size: currentEngine.getSize(),
        };
      }

      // Toggle engine type in Redux
      dispatch(engineSlice.actions.toggleRuntime());

      // Recreate the engine with new type
      await recreateEngine();

      // Restore state if we had captured it
      const newEngine = getEngine();
      if (newEngine && capturedState) {
        if (capturedState.particles && capturedState.particles.length > 0) {
          newEngine.setParticles(capturedState.particles);
        }
        newEngine.setConstrainIterations(capturedState.constrainIterations);
        newEngine.setCellSize(capturedState.cellSize);
        newEngine.setMaxNeighbors(capturedState.maxNeighbors ?? 100);
        newEngine.setClearColor(capturedState.clearColor);
        newEngine.setCamera(capturedState.camera.x, capturedState.camera.y);
        newEngine.setZoom(capturedState.zoom);
        newEngine.setSize(capturedState.size.width, capturedState.size.height);
      }
    } catch (error) {
      console.error("Error during engine type toggle:", error);
      dispatch(
        engineSlice.actions.setError(
          error instanceof Error ? error.message : "Unknown error"
        )
      );
    }
  }
);

// Particle management thunks
export const addParticleThunk = createAsyncThunk(
  "engine/addParticle",
  async (particle: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    size: number;
    mass: number;
    color: { r: number; g: number; b: number; a: number };
  }) => {
    const engine = getEngine();
    if (engine) {
      engine.addParticle(particle);
      // Note: Particle count now tracked via refs in useEngineInternal
    }
  }
);

export const spawnParticlesThunk = createAsyncThunk(
  "engine/spawnParticles",
  async (config: SpawnParticlesConfig, { dispatch }) => {
    const engine = getEngine();
    if (!engine) return;

    // Ensure engine has a sane size before spawning (Safari can report tiny sizes initially)
    const waitForEngineSize = async () => {
      let attempts = 0;
      while (attempts < 10) {
        const s = engine.getSize();
        if (s.width >= 4 && s.height >= 4) return s;
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        attempts++;
      }
      return engine.getSize();
    };
    await waitForEngineSize();

    const {
      numParticles,
      shape,
      spacing,
      particleSize,
      radius = 200,
      colors,
      velocityConfig = { speed: 0, direction: "random", angle: 0 },
      innerRadius = 50,
      squareSize = 200,
      cornerRadius = 0,
      particleMass = 1,
    } = config;

    engine.clear();

    const spawner = new Spawner();

    // Get camera and bounds info for spawning
    const cam = engine.getCamera();
    const size = engine.getSize();
    const zoom = engine.getZoom();
    const worldWidth = size.width / Math.max(zoom, 0.0001);
    const worldHeight = size.height / Math.max(zoom, 0.0001);

    const particles = spawner.initParticles({
      count: numParticles,
      colors: colors?.length ? colors : ["#ffffff"],
      shape,
      center: cam,
      spacing,
      radius,
      innerRadius,
      squareSize,
      cornerRadius,
      size: particleSize,
      mass: particleMass,
      bounds: { width: worldWidth, height: worldHeight },
      velocity: velocityConfig
        ? {
            speed: velocityConfig.speed,
            direction: velocityConfig.direction,
            angle:
              velocityConfig.direction === "custom"
                ? (velocityConfig.angle * Math.PI) / 180
                : undefined,
          }
        : undefined,
    });

    engine.setParticles(particles);
    engine.play(); // Actually start the engine loop
    // Note: Particle count now tracked via refs in useEngineInternal
    dispatch(engineSlice.actions.setPlaying(true));
  }
);

// Set particles directly (for session loading)
export const setParticlesThunk = createAsyncThunk(
  "engine/setParticles",
  async (
    payload: {
      particles: ParticleData[];
      jointsToRestore?: any;
      linesToRestore?: any;
    },
    { dispatch }
  ) => {
    const { particles, jointsToRestore, linesToRestore } = payload;
    const engine = getEngine();
    if (!engine) return;

    engine.clear();
    engine.setParticles(particles);

    // Use a timeout to ensure particles are processed by the engine before applying joints
    // This mirrors the timing used in InitControls.tsx for grid joints
    setTimeout(() => {
      // Use passed data instead of reading from Redux state (which might be stale)
      if (jointsToRestore) {
        const joints = engine.getModule("joints");
        if (joints && "setJoints" in joints) {
          const jointsModule = joints as any;
          // Sync all joint properties to engine
          jointsModule.setEnabled(jointsToRestore.enabled);
          jointsModule.setEnableParticleCollisions(
            jointsToRestore.enableParticleCollisions
          );
          jointsModule.setEnableJointCollisions(
            jointsToRestore.enableJointCollisions
          );
          jointsModule.setMomentum(jointsToRestore.momentum);
          jointsModule.setRestitution(jointsToRestore.restitution);
          jointsModule.setSeparation(jointsToRestore.separation);
          jointsModule.setSteps(jointsToRestore.steps);
          jointsModule.setFriction(jointsToRestore.friction);
          jointsModule.setJoints(jointsToRestore.list);

          // CRITICAL: Also sync Redux state to match engine state
          // This ensures subsequent saves capture the correct joint state
          dispatch(setJointsEnabled(jointsToRestore.enabled));
          dispatch(
            setEnableParticleCollisions(
              jointsToRestore.enableParticleCollisions
            )
          );
          dispatch(
            setEnableJointCollisions(jointsToRestore.enableJointCollisions)
          );
          dispatch(setMomentum(jointsToRestore.momentum));
          dispatch(setRestitution(jointsToRestore.restitution));
          dispatch(setSeparation(jointsToRestore.separation));
          dispatch(setSteps(jointsToRestore.steps));
          dispatch(setFriction(jointsToRestore.friction));
          dispatch(setJoints(jointsToRestore.list));
        }
      }

      // Restore lines
      if (linesToRestore) {
        const lines = engine.getModule("lines");
        if (lines && "setLines" in lines) {
          const linesModule = lines as any;
          // Sync lines to engine
          linesModule.setEnabled(linesToRestore.enabled);
          linesModule.setLines(linesToRestore.list);

          // CRITICAL: Also sync Redux state to match engine state
          dispatch(setLinesEnabled(linesToRestore.enabled));
          dispatch(setLines(linesToRestore.list));
        }
      }
    }, 100); // Small delay to ensure particles are processed by the engine

    engine.play();
    dispatch(engineSlice.actions.setPlaying(true));
  }
);

// Zoom handling thunk
export const handleWheelThunk = createAsyncThunk(
  "engine/handleWheel",
  async (
    zoomData: {
      deltaY: number;
      centerX: number;
      centerY: number;
      screenToWorld: (sx: number, sy: number) => { x: number; y: number };
    },
    { dispatch }
  ) => {
    const engine = getEngine();
    if (!engine) return;

    const { deltaY, centerX, centerY, screenToWorld } = zoomData;
    const zoomSensitivity = 0.01;

    // Calculate zoom factor
    const zoomFactor = Math.pow(0.95, deltaY * zoomSensitivity);
    const currentZoom = engine.getZoom();
    const newZoom = Math.max(0.1, Math.min(10, currentZoom * zoomFactor));

    // Get world coordinates of cursor before zoom
    const worldBeforeZoom = screenToWorld(centerX, centerY);

    // Apply zoom
    engine.setZoom(newZoom);

    // Get world coordinates of cursor after zoom
    const worldAfterZoom = screenToWorld(centerX, centerY);

    // Calculate camera adjustment to keep cursor position fixed
    const camera = engine.getCamera();
    const newCameraX = camera.x + (worldBeforeZoom.x - worldAfterZoom.x);
    const newCameraY = camera.y + (worldBeforeZoom.y - worldAfterZoom.y);

    engine.setCamera(newCameraX, newCameraY);

    // Update Redux state
    dispatch(engineSlice.actions.setZoom(newZoom));
    dispatch(engineSlice.actions.setCamera({ x: newCameraX, y: newCameraY }));
  }
);

// Remove particles thunk
export const removeParticlesThunk = createAsyncThunk(
  "engine/removeParticles",
  async ({
    center,
    radius,
  }: {
    center: { x: number; y: number };
    radius: number;
  }) => {
    const engine = getEngine();
    if (!engine) return;

    // Get current particles
    const particles = await engine.getParticles();

    let didChange = false;

    // Find particles within removal area and set mass to 0
    const updatedParticles = particles.map((particle) => {
      const dx = particle.position.x - center.x;
      const dy = particle.position.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        didChange = true;
        return { ...particle, mass: 0 };
      }
      return particle;
    });

    // Set updated particles back to engine
    if (didChange) {
      engine.setParticles(updatedParticles);
    }
  }
);

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
  setMaxNeighbors,
  setMaxParticles,
  setClearColor,
  setSize,
  setCamera,
  setZoom,
  toggleRuntime,
  setRequestedRuntime,
  setActualRuntime,
  updateEngineState,
  resetEngine,
} = engineSlice.actions;

export const engineReducer = engineSlice.reducer;

// Selectors
export const selectEngineState = (state: { engine: EngineState }) =>
  state.engine;
export const selectIsWebGPU = (state: { engine: EngineState }) =>
  state.engine.isWebGPU;
export const selectIsPlaying = (state: { engine: EngineState }) =>
  state.engine.isPlaying;
export const selectIsInitialized = (state: { engine: EngineState }) =>
  state.engine.isInitialized;
export const selectIsInitializing = (state: { engine: EngineState }) =>
  state.engine.isInitializing;
export const selectError = (state: { engine: EngineState }) =>
  state.engine.error;
export const selectConstrainIterations = (state: { engine: EngineState }) =>
  state.engine.constrainIterations;
export const selectGridCellSize = (state: { engine: EngineState }) =>
  state.engine.gridCellSize;
export const selectMaxNeighbors = (state: { engine: EngineState }) =>
  state.engine.maxNeighbors;
export const selectMaxParticles = (state: { engine: EngineState }) =>
  state.engine.maxParticles;
export const selectCamera = (state: { engine: EngineState }) =>
  state.engine.camera;
export const selectZoom = (state: { engine: EngineState }) => state.engine.zoom;
export const selectSize = (state: { engine: EngineState }) => state.engine.size;
export const selectClearColor = (state: { engine: EngineState }) =>
  state.engine.clearColor;
export const selectRequestedRuntime = (state: { engine: EngineState }) =>
  state.engine.requestedRuntime;
export const selectActualRuntime = (state: { engine: EngineState }) =>
  state.engine.actualRuntime;
