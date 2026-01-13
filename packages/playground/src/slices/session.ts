import {
  createSlice,
  PayloadAction,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
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
  renameSession as renameSessionInStorage,
  duplicateSession as duplicateSessionInStorage,
  getStorageInfo,
  generateSessionId,
} from "../utils/sessionManager";
import { RESTART_AFFECTED_MODULES } from "../constants/modules";
import { resetToDefaults as resetInitToDefaults, setState as setInitState } from "./init";
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
  setEnvironmentEnabled,
  resetBoundary,
  importBoundarySettings,
  setBoundaryEnabled,
  resetCollisions,
  importCollisionsSettings,
  setCollisionsEnabled,
  resetFluids,
  importFluidsSettings,
  setFluidsEnabled,
  resetBehavior,
  importBehaviorSettings,
  setBehaviorEnabled,
  resetSensors,
  importSensorsSettings,
  setSensorsEnabled,
  resetJoints,
  importJointsSettings,
  setJointsEnabled,
  importTrailsSettings,
  setTrailsEnabled,
  importInteractionSettings,
  setInteractionEnabled,
  importParticlesSettings,
  setParticlesEnabled,
  importLinesSettings,
  setLinesEnabled,
  importGrabSettings,
  setGrabEnabled,
} from "./modules";
import { FluidsMethod } from "@cazala/party";
import { initReducer, selectInitState } from "./init";
import { engineReducer } from "./engine";

const migrateLegacyPicflipIntoFluids = (sessionData: SessionData) => {
  const legacy = (sessionData.modules as any)?.picflip;
  if (!legacy || typeof legacy !== "object") return {};

  // Only migrate if the legacy module was enabled.
  if (!legacy.enabled) return {};

  const legacyRadius = typeof legacy.radius === "number" ? legacy.radius : undefined;
  const legacyDensity = typeof legacy.density === "number" ? legacy.density : undefined;
  const legacyPressure = typeof legacy.pressure === "number" ? legacy.pressure : undefined;
  const legacyFlipRatio = typeof legacy.flipRatio === "number" ? legacy.flipRatio : undefined;

  // Fluids (PIC/FLIP) internal mapping currently uses:
  // radInternal = influenceRadius / 2
  // densityInternal = targetDensity * 3
  // pressureInternal = pressureMultiplier * 30
  //
  // To preserve legacy behavior, invert that mapping:
  const influenceRadius =
    legacyRadius !== undefined ? legacyRadius * 2 : undefined;
  const targetDensity =
    legacyDensity !== undefined ? legacyDensity / 3 : undefined;
  const pressureMultiplier =
    legacyPressure !== undefined ? legacyPressure / 30 : undefined;

  return {
    enabled: true,
    method: FluidsMethod.Picflip,
    ...(influenceRadius !== undefined ? { influenceRadius } : {}),
    ...(targetDensity !== undefined ? { targetDensity } : {}),
    ...(pressureMultiplier !== undefined ? { pressureMultiplier } : {}),
    ...(legacyFlipRatio !== undefined ? { flipRatio: legacyFlipRatio } : {}),
  };
};

const DEFAULT_INIT_SLICE = initReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_INIT = selectInitState({ init: DEFAULT_INIT_SLICE } as any);
const DEFAULT_ENGINE_SLICE = engineReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_ENGINE = {
  constrainIterations: DEFAULT_ENGINE_SLICE.constrainIterations,
  gridCellSize: DEFAULT_ENGINE_SLICE.gridCellSize,
  maxNeighbors: DEFAULT_ENGINE_SLICE.maxNeighbors,
  camera: DEFAULT_ENGINE_SLICE.camera,
  zoom: DEFAULT_ENGINE_SLICE.zoom,
};

function normalizeInit(init: any): any {
  return { ...DEFAULT_INIT, ...(init ?? {}) };
}

function normalizeEngine(engine: any): any {
  return { ...DEFAULT_ENGINE, ...(engine ?? {}) };
}
import {
  clearAllOscillators,
  clearModuleOscillators,
  setOscillator,
  OscillatorData,
} from "./oscillators";

// Helper function to load module settings based on the restart-affected modules list
const loadModuleSettings = (
  dispatch: any,
  sessionData: SessionData,
  includeJoints: boolean = false
) => {
  // Reset and import settings for all restart-affected modules
  if (RESTART_AFFECTED_MODULES.includes("environment")) {
    dispatch(resetEnvironment());
    if (sessionData.modules?.environment) {
      dispatch(importEnvironmentSettings(sessionData.modules.environment));
    } else {
      dispatch(setEnvironmentEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("boundary")) {
    dispatch(resetBoundary());
    if (sessionData.modules?.boundary) {
      dispatch(importBoundarySettings(sessionData.modules.boundary));
    } else {
      dispatch(setBoundaryEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("collisions")) {
    dispatch(resetCollisions());
    if (sessionData.modules?.collisions) {
      dispatch(importCollisionsSettings(sessionData.modules.collisions));
    } else {
      dispatch(setCollisionsEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("fluids")) {
    dispatch(resetFluids());
    const migrated = migrateLegacyPicflipIntoFluids(sessionData);
    const hasPayload = !!sessionData.modules?.fluids || (migrated as any)?.enabled;
    if (hasPayload) {
      const fluidsSettings = {
        ...(sessionData.modules?.fluids ?? {}),
        ...migrated,
      };
      dispatch(importFluidsSettings(fluidsSettings));
    } else {
      dispatch(setFluidsEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("behavior")) {
    dispatch(resetBehavior());
    if (sessionData.modules?.behavior) {
      dispatch(importBehaviorSettings(sessionData.modules.behavior));
    } else {
      dispatch(setBehaviorEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("sensors")) {
    dispatch(resetSensors());
    if (sessionData.modules?.sensors) {
      dispatch(importSensorsSettings(sessionData.modules.sensors));
    } else {
      dispatch(setSensorsEnabled(false));
    }
  }

  // Handle joints separately since quickload doesn't restore joints connections
  if (includeJoints) {
    dispatch(resetJoints());
    if (sessionData.modules?.joints) {
      dispatch(importJointsSettings(sessionData.modules.joints));
    } else {
      dispatch(setJointsEnabled(false));
    }
  } else {
    dispatch(resetJoints());
  }

  if (RESTART_AFFECTED_MODULES.includes("trails")) {
    if (sessionData.modules?.trails) {
      dispatch(importTrailsSettings(sessionData.modules.trails));
    } else {
      dispatch(setTrailsEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("interaction")) {
    if (sessionData.modules?.interaction) {
      dispatch(importInteractionSettings(sessionData.modules.interaction));
    } else {
      dispatch(setInteractionEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("particles")) {
    if (sessionData.modules?.particles) {
      dispatch(importParticlesSettings(sessionData.modules.particles));
    } else {
      dispatch(setParticlesEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("lines")) {
    if (sessionData.modules?.lines) {
      dispatch(importLinesSettings(sessionData.modules.lines));
    } else {
      dispatch(setLinesEnabled(false));
    }
  }

  if (RESTART_AFFECTED_MODULES.includes("grab")) {
    if (sessionData.modules?.grab) {
      dispatch(importGrabSettings(sessionData.modules.grab));
    } else {
      dispatch(setGrabEnabled(false));
    }
  }

};

export interface SessionState {
  currentSessionName: string | null;
  lastSessionName: string | null; // Last saved/loaded session name for prefilling save modal
  isSaving: boolean;
  isLoading: boolean;
  isLoadingOscillators: boolean; // Flag to prevent useOscillators interference during session load
  saveError: string | null;
  loadError: string | null;
  availableSessions: SessionListItem[];
  sessionOrder: string[]; // Custom ordering of session IDs for display
  storageInfo: {
    usedSessions: number;
    totalSize: number;
    formattedSize: string;
    isHighUsage: boolean;
  } | null;
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
  sessionOrder: [],
  storageInfo: null,
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
        (session) => session.name.toLowerCase() === request.name.toLowerCase()
      );

      // Use existing ID if overriding, otherwise generate new one
      const sessionId = existingSession
        ? existingSession.id
        : generateSessionId(request.name);

      const sessionData: SessionData = {
        id: sessionId,
        name: request.name,
        metadata: {
          particleCount: request.particleCount,
          createdAt: existingSession
            ? existingSession.metadata.createdAt
            : new Date().toISOString(),
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
        render: (state as RootState).render,
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

// Async thunk to quick load session (without particles and joints)
export const quickLoadSessionThunk = createAsyncThunk(
  "session/quickLoadSession",
  async (sessionId: string, { dispatch, getState, rejectWithValue }) => {
    try {
      const sessionData = loadSessionFromStorage(sessionId);
      if (!sessionData) {
        throw new Error("Session not found");
      }
      return await applyQuickSessionLoad(dispatch, getState, sessionData);
    } catch (error) {
      // Clear the flag on error to avoid getting stuck
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load session"
      );
    }
  }
);

// Internal helper to apply a full session load from SessionData
const applyFullSessionLoad = async (
  dispatch: any,
  sessionData: SessionData
) => {
  const normalizedInit = normalizeInit((sessionData as any).init);
  const normalizedEngine = normalizeEngine((sessionData as any).engine);

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
  dispatch(resetInitToDefaults());
  dispatch(setInitState(normalizedInit));

  // Load engine settings
  dispatch(setConstrainIterations(normalizedEngine.constrainIterations));
  dispatch(setGridCellSize(normalizedEngine.gridCellSize));
  dispatch(setMaxNeighbors(normalizedEngine.maxNeighbors));

  // Load camera and zoom
  dispatch(setCameraThunk(normalizedEngine.camera));
  dispatch(setZoomThunk(normalizedEngine.zoom));

  // Load module states
  dispatch(resetEnvironment());
  if (sessionData.modules?.environment) {
    dispatch(importEnvironmentSettings(sessionData.modules.environment));
  } else {
    dispatch(setEnvironmentEnabled(false));
  }

  dispatch(resetBoundary());
  if (sessionData.modules?.boundary) {
    dispatch(importBoundarySettings(sessionData.modules.boundary));
  } else {
    dispatch(setBoundaryEnabled(false));
  }

  dispatch(resetCollisions());
  if (sessionData.modules?.collisions) {
    dispatch(importCollisionsSettings(sessionData.modules.collisions));
  } else {
    dispatch(setCollisionsEnabled(false));
  }

  dispatch(resetFluids());
  {
    const migrated = migrateLegacyPicflipIntoFluids(sessionData);
    const hasPayload = !!sessionData.modules?.fluids || (migrated as any)?.enabled;
    if (hasPayload) {
      const fluidsSettings = {
        ...(sessionData.modules?.fluids ?? {}),
        ...migrated,
      };
      dispatch(importFluidsSettings(fluidsSettings));
    } else {
      dispatch(setFluidsEnabled(false));
    }
  }

  dispatch(resetBehavior());
  if (sessionData.modules?.behavior) {
    dispatch(importBehaviorSettings(sessionData.modules.behavior));
  } else {
    dispatch(setBehaviorEnabled(false));
  }

  dispatch(resetSensors());
  if (sessionData.modules?.sensors) {
    dispatch(importSensorsSettings(sessionData.modules.sensors));
  } else {
    dispatch(setSensorsEnabled(false));
  }

  dispatch(resetJoints());
  if (sessionData.modules?.joints) {
    dispatch(importJointsSettings(sessionData.modules.joints));
  } else {
    dispatch(setJointsEnabled(false));
  }

  if (sessionData.modules?.trails) {
    dispatch(importTrailsSettings(sessionData.modules.trails));
  } else {
    dispatch(setTrailsEnabled(false));
  }
  if (sessionData.modules?.interaction) {
    dispatch(importInteractionSettings(sessionData.modules.interaction));
  } else {
    dispatch(setInteractionEnabled(false));
  }
  if (sessionData.modules?.particles) {
    dispatch(importParticlesSettings(sessionData.modules.particles));
  } else {
    dispatch(setParticlesEnabled(false));
  }
  if (sessionData.modules?.lines) {
    dispatch(importLinesSettings(sessionData.modules.lines));
  } else {
    dispatch(setLinesEnabled(false));
  }
  if (sessionData.modules?.grab) {
    dispatch(importGrabSettings(sessionData.modules.grab));
  } else {
    dispatch(setGrabEnabled(false));
  }
  // No standalone picflip module anymore; legacy picflip sessions are migrated into fluids above.

  // Load render settings (full load only)
  if (sessionData.render) {
    try {
      const { importRenderSettings } = await import("./render");
      dispatch(importRenderSettings(sessionData.render));
    } catch (e) {
      // ignore if render slice changes
    }
  }

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
    Object.entries(sessionData.oscillators).forEach(([sliderId, config]) => {
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
    });
  }

  // Clear the flag after loading is complete
  dispatch(sessionSlice.actions.setIsLoadingOscillators(false));

  // Return normalized data so callers (e.g. spawnParticlesThunk(sessionData.init)) always have
  // a complete config even if the incoming payload was minimized for URL size.
  return {
    ...(sessionData as any),
    init: normalizedInit,
    engine: normalizedEngine,
  } as SessionData;
};

// Internal helper to apply a quick session load (no particles/joints changes)
const applyQuickSessionLoad = async (
  dispatch: any,
  getState: any,
  sessionData: SessionData
) => {
  const normalizedEngine = normalizeEngine((sessionData as any).engine);

  // Set flag to prevent useOscillators interference during load
  dispatch(sessionSlice.actions.setIsLoadingOscillators(true));

  const engine = getEngine();

  // Backup current oscillator state for non-restart modules
  const currentOscillators = Object.fromEntries(
    Object.entries((getState() as RootState).oscillators).filter(
      ([sliderId, config]) => {
        let moduleName = config.moduleName;
        if (!moduleName) {
          const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
          if (parts.length >= 2) {
            moduleName = parts[0];
          }
        }
        // Keep oscillators that are NOT restart-affected
        return moduleName && !RESTART_AFFECTED_MODULES.includes(moduleName);
      }
    )
  );

  // Clear existing oscillators only for restart-affected modules
  RESTART_AFFECTED_MODULES.forEach((moduleName) => {
    dispatch(clearModuleOscillators(moduleName));
    if (engine) {
      engine.clearModuleOscillators?.(moduleName);
    }
  });

  // Small delay to ensure clearing is complete before loading
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Sync GPU if needed
  await engine?.getParticles();

  // Load engine settings
  dispatch(setConstrainIterations(normalizedEngine.constrainIterations));
  dispatch(setGridCellSize(normalizedEngine.gridCellSize));
  dispatch(setMaxNeighbors(normalizedEngine.maxNeighbors));

  // Load module states (without joints connections for quickload)
  loadModuleSettings(dispatch, sessionData, false);
  // Do NOT load render settings on quickload (per requirement)

  // Restore oscillators only for restart-affected modules
  const affectedOscillators = Object.entries(sessionData.oscillators).filter(
    ([sliderId, config]) => {
      let moduleName = config.moduleName;
      if (!moduleName) {
        const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
        if (parts.length >= 2) {
          moduleName = parts[0];
        }
      }
      return moduleName && RESTART_AFFECTED_MODULES.includes(moduleName);
    }
  );

  // Load oscillators to Redux state
  affectedOscillators.forEach(([sliderId, config]) => {
    dispatch(setOscillator({ sliderId, config }));
  });

  // Restore oscillator engine elapsed time BEFORE adding oscillators
  if (engine) {
    if (typeof sessionData.oscillatorsElapsedSeconds === "number") {
      engine.setOscillatorsElapsedSeconds(
        sessionData.oscillatorsElapsedSeconds
      );
    }

    // Directly restore oscillators to engine with runtime state
    affectedOscillators.forEach(([sliderId, config]) => {
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
        if (engine.hasOscillator(moduleName, inputName)) {
          engine.removeOscillator(moduleName, inputName);
        }
        const options: any = {
          curveExponent: config.curveExponent ?? 2,
          jitter: config.jitter ?? false,
        };

        if (config.lastValue !== undefined) {
          options.currentValue = config.lastValue;
        }
        if (config.lastDirection !== undefined) {
          options.initialDirection = config.lastDirection;
        }
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
    });
  }

  // Restore non-restart oscillators without runtime state to prevent jumping
  Object.entries(currentOscillators).forEach(([sliderId, config]) => {
    // Strip runtime state properties that cause oscillators to jump during session loads
    const cleanConfig = {
      speedHz: config.speedHz,
      customMin: config.customMin,
      customMax: config.customMax,
      moduleName: config.moduleName,
      inputName: config.inputName,
    };
    dispatch(setOscillator({ sliderId, config: cleanConfig }));
  });

  // Clear the flag after loading is complete
  dispatch(sessionSlice.actions.setIsLoadingOscillators(false));

  return {
    ...(sessionData as any),
    engine: normalizedEngine,
  } as SessionData;
};

// Async thunk to load session by ID (from storage)
export const loadSessionThunk = createAsyncThunk(
  "session/loadSession",
  async (sessionId: string, { dispatch, rejectWithValue }) => {
    try {
      const sessionData = loadSessionFromStorage(sessionId);
      if (!sessionData) {
        throw new Error("Session not found");
      }
      return await applyFullSessionLoad(dispatch, sessionData);
    } catch (error) {
      // Clear the flag on error to avoid getting stuck
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load session"
      );
    }
  }
);

// Async thunk to load session from provided SessionData
export const loadSessionDataThunk = createAsyncThunk(
  "session/loadSessionData",
  async (sessionData: SessionData, { dispatch, rejectWithValue }) => {
    try {
      return await applyFullSessionLoad(dispatch, sessionData);
    } catch (error) {
      // Clear the flag on error to avoid getting stuck
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to load session data"
      );
    }
  }
);

// Async thunk to quick load session from provided SessionData (no particles/joints)
export const quickLoadSessionDataThunk = createAsyncThunk(
  "session/quickLoadSessionData",
  async (sessionData: SessionData, { dispatch, getState, rejectWithValue }) => {
    try {
      return await applyQuickSessionLoad(dispatch, getState, sessionData);
    } catch (error) {
      // Clear the flag on error to avoid getting stuck
      dispatch(sessionSlice.actions.setIsLoadingOscillators(false));
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to quick load session data"
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

// Async thunk to rename session
export const renameSessionThunk = createAsyncThunk(
  "session/renameSession",
  async (
    { sessionId, newName }: { sessionId: string; newName: string },
    { rejectWithValue }
  ) => {
    try {
      renameSessionInStorage(sessionId, newName);
      return { sessionId, newName };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to rename session"
      );
    }
  }
);

// Async thunk to duplicate session
export const duplicateSessionThunk = createAsyncThunk(
  "session/duplicateSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const newSessionId = duplicateSessionInStorage(sessionId);
      return newSessionId;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to duplicate session"
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
    reorderSessions: (state, action: PayloadAction<string[]>) => {
      state.sessionOrder = action.payload;
      // Persist the order to localStorage
      try {
        localStorage.setItem(
          "party-session-order",
          JSON.stringify(action.payload)
        );
      } catch (error) {
        console.warn("Failed to save session order:", error);
      }
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
        // Update storage info
        state.storageInfo = getStorageInfo();
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
      // Load session from provided data
      .addCase(loadSessionDataThunk.pending, (state) => {
        state.isLoading = true;
        state.loadError = null;
      })
      .addCase(loadSessionDataThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSessionName = action.payload.name;
        state.lastSessionName = action.payload.name;
      })
      .addCase(loadSessionDataThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.loadError = action.payload as string;
      })
      // Quick load session (without particles and joints)
      .addCase(quickLoadSessionThunk.pending, (state) => {
        state.isLoading = true;
        state.loadError = null;
      })
      .addCase(quickLoadSessionThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSessionName = action.payload.name;
        state.lastSessionName = action.payload.name;
      })
      .addCase(quickLoadSessionThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.loadError = action.payload as string;
      })
      // Quick load session from provided data (no particles/joints)
      .addCase(quickLoadSessionDataThunk.pending, (state) => {
        state.isLoading = true;
        state.loadError = null;
      })
      .addCase(quickLoadSessionDataThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSessionName = action.payload.name;
        state.lastSessionName = action.payload.name;
      })
      .addCase(quickLoadSessionDataThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.loadError = action.payload as string;
      })
      // Load available sessions
      .addCase(loadAvailableSessionsThunk.fulfilled, (state, action) => {
        state.availableSessions = action.payload;
        // Load custom session order from localStorage
        try {
          const savedOrder = localStorage.getItem("party-session-order");
          if (savedOrder) {
            const order = JSON.parse(savedOrder);
            // Filter out any session IDs that no longer exist
            state.sessionOrder = order.filter((id: string) =>
              action.payload.some((session) => session.id === id)
            );
            // Add any new sessions that aren't in the saved order to the end
            const newSessions = action.payload
              .filter((session) => !state.sessionOrder.includes(session.id))
              .map((session) => session.id);
            state.sessionOrder = [...state.sessionOrder, ...newSessions];
          } else {
            // No custom order, use default date-based order
            state.sessionOrder = action.payload.map((session) => session.id);
          }
        } catch (error) {
          console.warn("Failed to load session order:", error);
          state.sessionOrder = action.payload.map((session) => session.id);
        }
        // Update storage info
        state.storageInfo = getStorageInfo();
      })
      // Delete session
      .addCase(deleteSessionThunk.fulfilled, (state, action) => {
        state.availableSessions = state.availableSessions.filter(
          (s) => s.id !== action.payload
        );
        // Remove from custom order as well
        state.sessionOrder = state.sessionOrder.filter(
          (id) => id !== action.payload
        );
        // Update localStorage
        try {
          localStorage.setItem(
            "party-session-order",
            JSON.stringify(state.sessionOrder)
          );
        } catch (error) {
          console.warn("Failed to update session order after delete:", error);
        }
        // Update storage info
        state.storageInfo = getStorageInfo();
      })
      // Rename session
      .addCase(renameSessionThunk.fulfilled, (state, action) => {
        const { sessionId, newName } = action.payload;
        const sessionIndex = state.availableSessions.findIndex(
          (s) => s.id === sessionId
        );
        if (sessionIndex >= 0) {
          state.availableSessions[sessionIndex].name = newName;
          state.availableSessions[sessionIndex].metadata.lastModified =
            new Date().toISOString();
        }
      })
      // Duplicate session - refresh sessions list to include the new duplicate
      .addCase(duplicateSessionThunk.fulfilled, () => {
        // The duplicate has been created in storage, we'll refresh the full list
        // This ensures we get the new session with proper ordering
        // The actual refresh happens in the useSession hook after the thunk completes
      });
  },
});

export const {
  clearSaveError,
  clearLoadError,
  setCurrentSessionName,
  setLastSessionName,
  setIsLoadingOscillators,
  reorderSessions,
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
export const selectSessionOrder = (state: RootState) =>
  state.session.sessionOrder;
// Memoized selector to prevent unnecessary re-renders
export const selectOrderedSessions = createSelector(
  [
    (state: RootState) => state.session.availableSessions,
    (state: RootState) => state.session.sessionOrder,
  ],
  (sessions, order) => {
    // Return sessions in custom order, with any missing sessions at the end
    const orderedSessions = order
      .map((id) => sessions.find((session) => session.id === id))
      .filter((session): session is SessionListItem => session !== undefined);

    const unorderedSessions = sessions.filter(
      (session) => !order.includes(session.id)
    );

    return [...orderedSessions, ...unorderedSessions];
  }
);
export const selectStorageInfo = (state: RootState) =>
  state.session.storageInfo;
