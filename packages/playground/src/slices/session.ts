import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import {
  SessionData,
  SessionSaveRequest,
  SessionListItem,
} from "../types/session";
import { RootState } from "./store";
import {
  saveSession as saveSessionToStorage,
  loadSession as loadSessionFromStorage,
  getAllSessions as getAllSessionsFromStorage,
  deleteSession as deleteSessionFromStorage,
  generateSessionId,
} from "../utils/sessionManager";

// Import action creators from other slices
import { setState as setInitState } from "./init";
import {
  setConstrainIterations,
  setGridCellSize,
  setMaxNeighbors,
  setCameraThunk,
  setZoomThunk,
  getEngine,
} from "./engine";
import {
  resetEnvironment,
  importEnvironmentSettings,
  resetBoundary,
  importBoundarySettings,
  resetCollisions,
  importCollisionsSettings,
  resetFluids,
  importFluidsSettings,
  resetBehavior,
  importBehaviorSettings,
  resetSensors,
  importSensorsSettings,
  resetJoints,
  importJointsSettings,
  importTrailsSettings,
  importInteractionSettings,
  importParticlesSettings,
  importLinesSettings,
  importGrabSettings,
} from "./modules";
import {
  clearAllOscillators,
  setOscillator,
  OscillatorData,
} from "./oscillators";

export interface SessionState {
  currentSessionName: string | null;
  lastSessionName: string | null; // Last saved/loaded session name for prefilling save modal
  isSaving: boolean;
  isLoading: boolean;
  isLoadingOscillators: boolean; // Flag to prevent useOscillators interference during session load
  saveError: string | null;
  loadError: string | null;
  availableSessions: SessionListItem[];
}

const initialState: SessionState = {
  currentSessionName: null,
  lastSessionName: null,
  isSaving: false,
  isLoading: false,
  isLoadingOscillators: false,
  saveError: null,
  loadError: null,
  availableSessions: [],
};

// Async thunk to save current session
export const saveCurrentSessionThunk = createAsyncThunk(
  "session/saveCurrentSession",
  async (request: SessionSaveRequest, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const engine = getEngine();

      // Capture oscillator runtime state from engine
      const oscillatorsWithRuntimeState: Record<string, OscillatorData> = {};

      for (const [sliderId, config] of Object.entries(state.oscillators)) {
        // Start with the Redux config
        let enhancedConfig = { ...config };

        // Try to get runtime state from engine if this oscillator has module/input mapping
        let moduleName = config.moduleName;
        let inputName = config.inputName;

        // If no explicit module/input, try to infer from sliderId
        if (!moduleName || !inputName) {
          const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
          if (parts.length >= 2) {
            moduleName = moduleName || parts[0];
            inputName = inputName || parts[1];
          }
        }

        // Get runtime state from engine if we can resolve module/input
        if (
          engine &&
          moduleName &&
          inputName &&
          engine.hasOscillator(moduleName, inputName)
        ) {
          try {
            const runtimeState = engine.getOscillator(moduleName, inputName);
            if (runtimeState) {
              // Get current module value to compare
              // Read current module value (unused now; kept for potential future consistency checks)
              engine.getModule(moduleName)?.readValue(inputName);

              // Merge runtime state with Redux config
              enhancedConfig = {
                ...enhancedConfig,
                lastValue: runtimeState.lastValue,
                lastDirection: runtimeState.lastDirection,
                phaseOffset: runtimeState.phaseOffset,
                active: runtimeState.active,
              };
            }
          } catch (error) {}
        }

        oscillatorsWithRuntimeState[sliderId] = enhancedConfig;
      }

      // Determine if we should save particle data (≤1000 particles)
      const shouldSaveParticleData = request.particleCount <= 1000;
      let particles: any[] | undefined;

      if (shouldSaveParticleData && engine) {
        try {
          particles = await engine.getParticles();
        } catch (error) {
          console.warn("Failed to get particles for session save:", error);
          // If we can't get particles, fall back to init-only mode
        }
      }

      // Check if a session with this name already exists
      const existingSession = state.session.availableSessions.find(
        session => session.name.toLowerCase() === request.name.toLowerCase()
      );
      
      // Use existing ID if overriding, otherwise generate new one
      const sessionId = existingSession ? existingSession.id : generateSessionId(request.name);

      const sessionData: SessionData = {
        id: sessionId,
        name: request.name,
        metadata: {
          particleCount: request.particleCount,
          createdAt: existingSession ? existingSession.metadata.createdAt : new Date().toISOString(),
          lastModified: new Date().toISOString(),
          hasParticleData: shouldSaveParticleData && !!particles,
        },
        modules: state.modules,
        init: state.init,
        engine: {
          constrainIterations: state.engine.constrainIterations,
          gridCellSize: state.engine.gridCellSize,
          maxNeighbors: state.engine.maxNeighbors,
          camera: state.engine.camera,
          zoom: state.engine.zoom,
        },
        oscillators: oscillatorsWithRuntimeState,
        oscillatorsElapsedSeconds: engine?.getOscillatorsElapsedSeconds(),
        particles,
      };

      saveSessionToStorage(sessionData);
      return sessionData;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to save session"
      );
    }
  }
);

// Async thunk to load session
export const loadSessionThunk = createAsyncThunk(
  "session/loadSession",
  async (sessionId: string, { dispatch, rejectWithValue }) => {
    try {
      const sessionData = loadSessionFromStorage(sessionId);
      if (!sessionData) {
        throw new Error("Session not found");
      }

      // Set flag to prevent useOscillators interference during load
      dispatch(sessionSlice.actions.setIsLoadingOscillators(true));

      // Clear existing oscillators from both Redux and engine
      dispatch(clearAllOscillators());
      const engine = getEngine();
      if (engine) {
        engine.clearOscillators();
      }

      // Small delay to ensure clearing is complete before loading
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Load init state
      dispatch(setInitState(sessionData.init));

      // Load engine settings
      dispatch(setConstrainIterations(sessionData.engine.constrainIterations));
      dispatch(setGridCellSize(sessionData.engine.gridCellSize));
      dispatch(setMaxNeighbors(sessionData.engine.maxNeighbors));

      // Load camera and zoom
      dispatch(setCameraThunk(sessionData.engine.camera));
      dispatch(setZoomThunk(sessionData.engine.zoom));

      // Load module states
      dispatch(resetEnvironment());
      dispatch(importEnvironmentSettings(sessionData.modules.environment));

      dispatch(resetBoundary());
      dispatch(importBoundarySettings(sessionData.modules.boundary));

      dispatch(resetCollisions());
      dispatch(importCollisionsSettings(sessionData.modules.collisions));

      dispatch(resetFluids());
      dispatch(importFluidsSettings(sessionData.modules.fluids));

      dispatch(resetBehavior());
      dispatch(importBehaviorSettings(sessionData.modules.behavior));

      dispatch(resetSensors());
      dispatch(importSensorsSettings(sessionData.modules.sensors));

      dispatch(resetJoints());
      dispatch(importJointsSettings(sessionData.modules.joints));

      dispatch(importTrailsSettings(sessionData.modules.trails));
      dispatch(importInteractionSettings(sessionData.modules.interaction));
      dispatch(importParticlesSettings(sessionData.modules.particles));
      dispatch(importLinesSettings(sessionData.modules.lines));
      dispatch(importGrabSettings(sessionData.modules.grab));

      // Load oscillators to Redux state
      Object.entries(sessionData.oscillators).forEach(([sliderId, config]) => {
        dispatch(setOscillator({ sliderId, config }));
      });

      // Restore oscillator engine elapsed time BEFORE adding oscillators
      if (engine) {
        if (typeof sessionData.oscillatorsElapsedSeconds === "number") {
          engine.setOscillatorsElapsedSeconds(
            sessionData.oscillatorsElapsedSeconds
          );
        } else {
          // For old sessions without time, reset to 0 to make saved phase offsets deterministic
          engine.setOscillatorsElapsedSeconds(0);
        }

        // Directly restore oscillators to engine with runtime state to avoid timing issues
        Object.entries(sessionData.oscillators).forEach(
          ([sliderId, config]) => {
            // Resolve module/input from explicit fields or from sliderId
            let moduleName = config.moduleName;
            let inputName = config.inputName;

            if (!moduleName || !inputName) {
              const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
              if (parts.length >= 2) {
                moduleName = moduleName || parts[0];
                inputName = inputName || parts[1];
              }
            }

            if (moduleName && inputName) {
              // Explicitly remove any existing oscillator first to ensure clean state
              if (engine.hasOscillator(moduleName, inputName)) {
                engine.removeOscillator(moduleName, inputName);
              }
              const options: any = {
                curveExponent: config.curveExponent ?? 2,
                jitter: config.jitter ?? false,
              };

              // Simple approach: just use current value and direction, let engine calculate fresh phase
              if (config.lastValue !== undefined) {
                options.currentValue = config.lastValue;
              }
              if (config.lastDirection !== undefined) {
                options.initialDirection = config.lastDirection;
              }
              // Pass saved phaseOffset if present, since elapsed time is restored
              if (config.phaseOffset !== undefined) {
                options.phaseOffset = config.phaseOffset;
              }

              engine.addOscillator({
                moduleName,
                inputName,
                min: config.customMin,
                max: config.customMax,
                speedHz: config.speedHz,
                options,
              });
            }
          }
        );
      }

      // Clear the flag after loading is complete
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));

      return sessionData;
    } catch (error) {
      // Clear the flag on error to avoid getting stuck
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load session"
      );
    }
  }
);

// Async thunk to load available sessions
export const loadAvailableSessionsThunk = createAsyncThunk(
  "session/loadAvailableSessions",
  async (_, { rejectWithValue }) => {
    try {
      return getAllSessionsFromStorage();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load sessions"
      );
    }
  }
);

// Async thunk to delete session
export const deleteSessionThunk = createAsyncThunk(
  "session/deleteSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      deleteSessionFromStorage(sessionId);
      return sessionId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to delete session"
      );
    }
  }
);

export const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    clearSaveError: (state) => {
      state.saveError = null;
    },
    clearLoadError: (state) => {
      state.loadError = null;
    },
    setCurrentSessionName: (state, action: PayloadAction<string | null>) => {
      state.currentSessionName = action.payload;
    },
    setLastSessionName: (state, action: PayloadAction<string | null>) => {
      state.lastSessionName = action.payload;
    },
    setIsLoadingOscillators: (state, action: PayloadAction<boolean>) => {
      state.isLoadingOscillators = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Save session
      .addCase(saveCurrentSessionThunk.pending, (state) => {
        state.isSaving = true;
        state.saveError = null;
      })
      .addCase(saveCurrentSessionThunk.fulfilled, (state, action) => {
        state.isSaving = false;
        state.currentSessionName = action.payload.name;
        state.lastSessionName = action.payload.name;
        // Add to available sessions
        const newSession: SessionListItem = {
          id: action.payload.id,
          name: action.payload.name,
          metadata: action.payload.metadata,
        };
        state.availableSessions = [
          newSession,
          ...state.availableSessions.filter((s) => s.id !== newSession.id),
        ];
      })
      .addCase(saveCurrentSessionThunk.rejected, (state, action) => {
        state.isSaving = false;
        state.saveError = action.payload as string;
      })
      // Load session
      .addCase(loadSessionThunk.pending, (state) => {
        state.isLoading = true;
        state.loadError = null;
      })
      .addCase(loadSessionThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSessionName = action.payload.name;
        state.lastSessionName = action.payload.name;
      })
      .addCase(loadSessionThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.loadError = action.payload as string;
      })
      // Load available sessions
      .addCase(loadAvailableSessionsThunk.fulfilled, (state, action) => {
        state.availableSessions = action.payload;
      })
      // Delete session
      .addCase(deleteSessionThunk.fulfilled, (state, action) => {
        state.availableSessions = state.availableSessions.filter(
          (s) => s.id !== action.payload
        );
      });
  },
});

export const {
  clearSaveError,
  clearLoadError,
  setCurrentSessionName,
  setLastSessionName,
  setIsLoadingOscillators,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

// Selectors
export const selectSessionState = (state: RootState) => state.session;
export const selectCurrentSessionName = (state: RootState) =>
  state.session.currentSessionName;
export const selectIsSaving = (state: RootState) => state.session.isSaving;
export const selectIsLoading = (state: RootState) => state.session.isLoading;
export const selectSaveError = (state: RootState) => state.session.saveError;
export const selectLoadError = (state: RootState) => state.session.loadError;
export const selectAvailableSessions = (state: RootState) =>
  state.session.availableSessions;
export const selectLastSessionName = (state: RootState) =>
  state.session.lastSessionName;
export const selectIsLoadingOscillators = (state: RootState) =>
  state.session.isLoadingOscillators;
