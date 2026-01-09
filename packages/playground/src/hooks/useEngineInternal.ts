import { useCallback, useEffect, useRef } from "react";
import {
  Environment,
  Boundary,
  Collisions,
  Fluids,
  Behavior,
  Sensors,
  Trails,
  Interaction,
  Engine,
  Particles,
  Joints,
  Lines,
  Grab,
} from "@cazala/party";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  selectIsWebGPU,
  selectIsPlaying,
  selectIsInitialized,
  selectIsInitializing,
  selectError,
  selectConstrainIterations,
  selectGridCellSize,
  selectMaxNeighbors,
  selectMaxParticles,
  selectCamera,
  selectZoom,
  selectSize,
  selectClearColor,
  selectRequestedRuntime,
  selectActualRuntime,
  playThunk,
  pauseThunk,
  clearThunk,
  setSizeThunk,
  setCameraThunk,
  setZoomThunk,
  setConstrainIterationsThunk,
  setCellSizeThunk,
  setMaxNeighborsThunk,
  setMaxParticlesThunk,
  setClearColorThunk,
  toggleRuntime as toggleRuntimeAction,
  addParticleThunk,
  spawnParticlesThunk,
  handleWheelThunk,
  registerEngine,
  setWebGPU,
  setInitialized,
  setInitializing,
  setError,
  setMaxParticles as setMaxParticlesAction,
  setConstrainIterations as setConstrainIterationsAction,
  setGridCellSize as setGridCellSizeAction,
  setClearColor as setClearColorAction,
  setCamera as setCameraAction,
  setZoom as setZoomAction,
  setRequestedRuntime as setRequestedRuntimeAction,
  setActualRuntime as setActualRuntimeAction,
  SpawnParticlesConfig,
  engineSlice,
  RequestedRuntimeType,
} from "../slices/engine";
import {
  selectModules,
  importEnvironmentSettings,
  importBoundarySettings,
  importCollisionsSettings,
  importFluidsSettings,
  importBehaviorSettings,
  importSensorsSettings,
  importTrailsSettings,
  importInteractionSettings,
  importParticlesSettings,
  importLinesSettings,
  importJointsSettings,
} from "../slices/modules";

export interface UseEngineProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  initialSize?: { width: number; height: number };
}

// Internal version used by EngineProvider
export function useEngineInternal({ canvasRef, initialSize }: UseEngineProps) {
  const dispatch = useAppDispatch();

  // All state from Redux
  const isWebGPU = useAppSelector(selectIsWebGPU);
  const isPlaying = useAppSelector(selectIsPlaying);
  const isInitialized = useAppSelector(selectIsInitialized);
  const isInitializing = useAppSelector(selectIsInitializing);
  const error = useAppSelector(selectError);
  const constrainIterations = useAppSelector(selectConstrainIterations);
  const gridCellSize = useAppSelector(selectGridCellSize);
  const maxNeighbors = useAppSelector(selectMaxNeighbors);
  const maxParticles = useAppSelector(selectMaxParticles);
  const camera = useAppSelector(selectCamera);
  const zoom = useAppSelector(selectZoom);
  const size = useAppSelector(selectSize);
  const clearColor = useAppSelector(selectClearColor);
  const modulesState = useAppSelector(selectModules);
  const requestedRuntime = useAppSelector(selectRequestedRuntime);
  const actualRuntime = useAppSelector(selectActualRuntime);

  // Engine and module references
  const engineRef = useRef<Engine | null>(null);
  const environmentRef = useRef<Environment | null>(null);
  const boundaryRef = useRef<Boundary | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const fluidsRef = useRef<Fluids | null>(null);
  const behaviorRef = useRef<Behavior | null>(null);
  const sensorsRef = useRef<Sensors | null>(null);
  const trailsRef = useRef<Trails | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const particlesRef = useRef<Particles | null>(null);
  const jointsRef = useRef<Joints | null>(null);
  const linesRef = useRef<Lines | null>(null);
  const grabRef = useRef<Grab | null>(null);

  // Engine type string for canvas key (deprecated, use actualRuntime instead)
  const runtime: "cpu" | "webgpu" | "webgl2" = actualRuntime;

  // Initialize engine
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let isInitializing = false; // Guard to prevent multiple simultaneous initializations

    const initEngine = async () => {
      // Prevent multiple simultaneous initializations
      if (isInitializing) {
        return;
      }
      
      isInitializing = true;
      // Preserve state from existing engine before cleanup
      let preservedState: any = null;
      if (engineRef.current) {
        dispatch(setInitialized(false));
        dispatch(setInitializing(true));

        try {
          // Capture current state for preservation during engine type toggle
          const currentEngine = engineRef.current;
          preservedState = {
            particles: await currentEngine.getParticles(),
            constrainIterations: currentEngine.getConstrainIterations(),
            cellSize: currentEngine.getCellSize(),
            clearColor: currentEngine.getClearColor(),
            camera: currentEngine.getCamera(),
            zoom: currentEngine.getZoom(),
            size: currentEngine.getSize(),
            modulesState: { ...modulesState },
          };

          // IMPORTANT: Await destroy so we don't overlap WebGPU device lifetimes.
          // Cap wait time so UI doesn't hang if GPU is wedged.
          await Promise.race([
            currentEngine.destroy(),
            new Promise((resolve) => setTimeout(resolve, 400)),
          ]);

          engineRef.current = null;
          environmentRef.current = null;
          boundaryRef.current = null;
          collisionsRef.current = null;
          fluidsRef.current = null;
          behaviorRef.current = null;
          sensorsRef.current = null;
          trailsRef.current = null;
          interactionRef.current = null;
          particlesRef.current = null;
          particlesRef.current = null;
          jointsRef.current = null;
          linesRef.current = null;
          registerEngine(null);
        } catch (err) {
          console.warn("Error cleaning up previous engine:", err);
          preservedState = null; // Reset if there was an error
        }

        // Give a delay for WebGPU context cleanup
        // Increased delay to ensure adapter and device are fully released
        // This is critical for preventing adapter acquisition failures on reload
        console.log("[Engine] Waiting 200ms for WebGPU context cleanup");
        await new Promise((resolve) => setTimeout(resolve, 200));
        console.log("[Engine] Cleanup delay complete");
      }
      if (!canvasRef.current) {
        isInitializing = false; // Reset guard
        return;
      }

      const canvas = canvasRef.current;

      // Ensure the canvas is properly mounted and has the correct attributes
      if (!canvas.isConnected || !canvas.parentElement) {
        // Canvas not properly mounted yet, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (!canvasRef.current || !canvasRef.current.isConnected) {
          isInitializing = false; // Reset guard
          return; // Canvas still not ready
        }
      }

      // Get canvas dimensions - use explicit size if provided, otherwise canvas attributes
      let canvasWidth =
        initialSize?.width || canvas.width || canvas.offsetWidth;
      let canvasHeight =
        initialSize?.height || canvas.height || canvas.offsetHeight;

      // If canvas doesn't have dimensions yet, use defaults
      if (canvasWidth === 0 || canvasHeight === 0) {
        canvasWidth = 800;
        canvasHeight = 600;
      }

      // Validate and clamp canvas dimensions (must be within unsigned long range: 0 to 2^32-1)
      // This prevents negative dimensions and ensures valid WebGPU texture sizes
      if (canvasWidth < 0 || canvasWidth > 4294967295 || canvasHeight < 0 || canvasHeight > 4294967295) {
        canvasWidth = Math.max(1, Math.min(Math.abs(canvasWidth), 16384)); // Clamp to reasonable max, use abs for negatives
        canvasHeight = Math.max(1, Math.min(Math.abs(canvasHeight), 16384));
      }

      // Safari workaround: Ensure canvas has explicit width/height attributes
      // before WebGPU initialization, as Safari requires this
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

      // Ensure canvas is visible (Safari requirement for WebGPU)
      const canvasStyle = window.getComputedStyle(canvas);
      if (canvasStyle.display === "none" || canvasStyle.visibility === "hidden") {
        console.warn("[Engine] Canvas is not visible, this may cause WebGPU initialization issues in Safari");
      }

      dispatch(setInitializing(true));
      dispatch(setError(null));

      try {

        // Use default maxParticles for playground (100k)
        const maxParticles = 100000;
        
        // Store maxParticles in Redux state (null means no limit)
        dispatch(setMaxParticlesAction(null));

        // Create modules first
        const environment = new Environment({
          enabled: false,
        });
        const boundary = new Boundary({
          enabled: false,
        });
        const collisions = new Collisions({ enabled: false });
        const fluids = new Fluids({ enabled: false });
        const behavior = new Behavior({ enabled: false });
        const sensors = new Sensors({ enabled: false });
        const interaction = new Interaction({ enabled: false });
        const trails = new Trails({ enabled: false });
        const joints = new Joints({ enabled: false });
        const lines = new Lines({ enabled: false });
        const grab = new Grab({ enabled: false });

        // Create particles renderer
        const particles = new Particles();

        const forces = [
          environment,
          boundary,
          collisions,
          behavior,
          fluids,
          sensors,
          interaction,
          joints,
          grab,
        ];
        const render = [trails, lines, particles];

        // Create engine with device-appropriate maxParticles
        const engine = new Engine({
          canvas,
          forces,
          render,
          runtime: requestedRuntime,
          maxParticles,
        });
        
        // Initialize with timeout to prevent indefinite hanging
        const initPromise = engine.initialize();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Engine initialization timed out after 15 seconds")), 15000)
        );
        
        await Promise.race([initPromise, timeoutPromise]);

        // Set references
        engineRef.current = engine;
        environmentRef.current = environment;
        boundaryRef.current = boundary;
        collisionsRef.current = collisions;
        fluidsRef.current = fluids;
        behaviorRef.current = behavior;
        sensorsRef.current = sensors;
        trailsRef.current = trails;
        interactionRef.current = interaction;
        particlesRef.current = particles;
        jointsRef.current = joints;
        linesRef.current = lines;
        grabRef.current = grab;
        // Register engine for thunks
        registerEngine(engine);

        // Set initial size using the dimensions we calculated earlier
        engine.setSize(canvasWidth, canvasHeight);
        dispatch(setSizeThunk({ width: canvasWidth, height: canvasHeight }));

        // Sync initial engine defaults to Redux state
        const actualConstrainIterations = engine.getConstrainIterations();
        const actualCellSize = engine.getCellSize();
        const actualClearColor = engine.getClearColor();
        const actualCamera = engine.getCamera();
        const actualZoom = engine.getZoom();
        const engineActualRuntime = engine.getActualRuntime();

        // Update Redux with actual engine defaults (sync only, don't call engine methods)
        // Note: clearColor will be restored from preservedState below when toggling runtime
        dispatch(setConstrainIterationsAction(actualConstrainIterations));
        dispatch(setGridCellSizeAction(actualCellSize));
        dispatch(setCameraAction({ x: actualCamera.x, y: actualCamera.y }));
        dispatch(setZoomAction(actualZoom));
        // Update runtime state: set actualRuntime from engine, keep isWebGPU in sync
        dispatch(setActualRuntimeAction(engineActualRuntime));
        dispatch(setWebGPU(engineActualRuntime === "webgpu"));
        if (!preservedState) {
          dispatch(setClearColorAction(actualClearColor));
        }

        // Restore preserved state if we had one (during engine type toggle)
        if (preservedState) {
          // Restore particles if we had them
          if (preservedState.particles && preservedState.particles.length > 0) {
            engine.setParticles(preservedState.particles);
          }

          // Restore engine settings
          engine.setConstrainIterations(preservedState.constrainIterations);
          engine.setCellSize(preservedState.cellSize);
          engine.setClearColor(preservedState.clearColor);
          engine.setCamera(preservedState.camera.x, preservedState.camera.y);
          engine.setZoom(preservedState.zoom);
          engine.setSize(preservedState.size.width, preservedState.size.height);

          // Also restore Redux clear color so the apply-config effect does not overwrite it
          dispatch(setClearColorAction(preservedState.clearColor));

          // Restore module states in Redux
          if (preservedState.modulesState) {
            const modules = preservedState.modulesState;
            dispatch(importEnvironmentSettings(modules.environment));
            dispatch(importBoundarySettings(modules.boundary));
            dispatch(importCollisionsSettings(modules.collisions));
            dispatch(importFluidsSettings(modules.fluids));
            dispatch(importBehaviorSettings(modules.behavior));
            dispatch(importSensorsSettings(modules.sensors));
            dispatch(importTrailsSettings(modules.trails));
            dispatch(importInteractionSettings(modules.interaction));
            dispatch(importJointsSettings(modules.joints));
            dispatch(importLinesSettings(modules.lines));
            dispatch(importParticlesSettings(modules.particles));
          }
        }

        // Mark as initialized
        dispatch(setInitialized(true));
        dispatch(setInitializing(false));
        isInitializing = false; // Reset guard

        // Start the engine after ensuring everything is ready
        // Use requestAnimationFrame to ensure the engine is fully initialized
        // and the canvas is ready before starting the animation loop
        requestAnimationFrame(() => {
          // Double-check engine is still available (in case cleanup happened)
          if (engineRef.current === engine) {
            try {
              engine.play();
              dispatch(engineSlice.actions.setPlaying(true));
            } catch (err) {
              console.error("[Engine] Error starting engine:", err);
              dispatch(setError(err instanceof Error ? err.message : "Failed to start engine"));
            }
          }
        });

        // Setup cleanup
        cleanup = () => {
          if (engineRef.current) {
            // React cleanup can't be async; fire-and-forget.
            void engineRef.current.destroy();
          }
          engineRef.current = null;
          environmentRef.current = null;
          boundaryRef.current = null;
          collisionsRef.current = null;
          fluidsRef.current = null;
          behaviorRef.current = null;
          sensorsRef.current = null;
          trailsRef.current = null;
          interactionRef.current = null;
          particlesRef.current = null;
          jointsRef.current = null;
          linesRef.current = null;
          registerEngine(null);
        };
      } catch (err) {
        isInitializing = false; // Reset guard on error
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("[Engine] Initialization error:", err);
        dispatch(setError(errorMessage));
        dispatch(setInitializing(false));
        
        // The Engine class should handle fallback automatically for auto mode
      }
    };

    initEngine();

    return cleanup || undefined;
  }, [canvasRef, requestedRuntime, dispatch]);

  // One-time page unload cleanup (must NOT depend on isWebGPU / dispatch or it will break runtime toggle).
  // This is important because in dev (React strict mode / hot reload) and on rapid reloads,
  // React teardown is not always enough to prevent overlapping WebGPU device lifetimes.
  useEffect(() => {
    const handlePageHide = () => {
      const eng = engineRef.current;
      if (!eng) return;
      try {
        void eng.destroy();
      } catch (err) {
        console.warn("[Engine] Error during pagehide cleanup:", err);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply configuration changes to existing engine (without recreating it)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !isInitialized) return;

    // Apply current Redux settings to the engine
    try {
      engine.setConstrainIterations(constrainIterations);
      engine.setCellSize(gridCellSize);
      engine.setClearColor(clearColor);
      engine.setMaxNeighbors(maxNeighbors);
    } catch (err) {
      console.warn("Error applying engine configuration:", err);
    }
  }, [
    isInitialized,
    constrainIterations,
    gridCellSize,
    clearColor,
    maxNeighbors,
  ]);

  // Apply module states from Redux to engine modules
  useEffect(() => {
    if (!isInitialized) return;

    // Safari: avoid applying module config until canvas size is non-trivial
    if (!size || size.width < 4 || size.height < 4) return;

    const environment = environmentRef.current;
    const boundary = boundaryRef.current;
    const collisions = collisionsRef.current;
    const fluids = fluidsRef.current;
    const behavior = behaviorRef.current;
    const sensors = sensorsRef.current;
    const trails = trailsRef.current;
    const interaction = interactionRef.current;
    const particles = particlesRef.current;
    const joints = jointsRef.current;
    const lines = linesRef.current;
    try {
      // Apply module enabled/disabled states from Redux to module instances
      if (environment && environment.setEnabled) {
        environment.setEnabled(modulesState.environment.enabled);
      }

      if (boundary && boundary.setEnabled) {
        boundary.setEnabled(modulesState.boundary.enabled);
      }

      if (collisions && collisions.setEnabled) {
        collisions.setEnabled(modulesState.collisions.enabled);
      }

      if (fluids && fluids.setEnabled) {
        fluids.setEnabled(modulesState.fluids.enabled);
      }

      if (behavior && behavior.setEnabled) {
        behavior.setEnabled(modulesState.behavior.enabled);
      }

      if (sensors && sensors.setEnabled) {
        sensors.setEnabled(modulesState.sensors.enabled);
      }

      if (trails && trails.setEnabled) {
        trails.setEnabled(modulesState.trails.enabled);
      }

      if (interaction && interaction.setEnabled) {
        interaction.setEnabled(modulesState.interaction.enabled);
      }

      if (particles && particles.setEnabled) {
        particles.setEnabled(modulesState.particles.enabled);
      }

      if (joints && joints.setEnabled) {
        joints.setEnabled(modulesState.joints.enabled);
      }

      if (lines && lines.setEnabled) {
        lines.setEnabled(modulesState.lines.enabled);
      }
    } catch (err) {
      console.warn("Error applying module states:", err);
    }
  }, [
    isInitialized,
    size.width,
    size.height,
    modulesState.environment.enabled,
    modulesState.boundary.enabled,
    modulesState.collisions.enabled,
    modulesState.fluids.enabled,
    modulesState.behavior.enabled,
    modulesState.sensors.enabled,
    modulesState.trails.enabled,
    modulesState.interaction.enabled,
    modulesState.particles.enabled,
    modulesState.joints.enabled,
    modulesState.lines.enabled,
  ]);

  // Action functions (wrapped thunks)
  const play = useCallback(() => {
    dispatch(playThunk());
  }, [dispatch]);

  const pause = useCallback(() => {
    dispatch(pauseThunk());
  }, [dispatch]);

  const clear = useCallback(() => {
    dispatch(clearThunk());
  }, [dispatch]);

  const setSize = useCallback(
    (newSize: { width: number; height: number }) => {
      dispatch(setSizeThunk(newSize));
    },
    [dispatch]
  );

  const setCamera = useCallback(
    (newCamera: { x: number; y: number }) => {
      dispatch(setCameraThunk(newCamera));
    },
    [dispatch]
  );

  const setZoom = useCallback(
    (newZoom: number) => {
      dispatch(setZoomThunk(newZoom));
    },
    [dispatch]
  );

  const setConstrainIterations = useCallback(
    (iterations: number) => {
      dispatch(setConstrainIterationsThunk(iterations));
    },
    [dispatch]
  );

  const setCellSize = useCallback(
    (cellSize: number) => {
      dispatch(setCellSizeThunk(cellSize));
    },
    [dispatch]
  );

  const setClearColor = useCallback(
    (color: { r: number; g: number; b: number; a: number }) => {
      dispatch(setClearColorThunk(color));
    },
    [dispatch]
  );
  const setMaxNeighbors = useCallback(
    (value: number) => {
      dispatch(setMaxNeighborsThunk(value));
    },
    [dispatch]
  );

  const setMaxParticles = useCallback(
    (value: number | null) => {
      dispatch(setMaxParticlesThunk(value));
    },
    [dispatch]
  );

  const addParticle = useCallback(
    (particle: {
      position: { x: number; y: number };
      velocity: { x: number; y: number };
      size: number;
      mass: number;
      color: { r: number; g: number; b: number; a: number };
    }) => {
      dispatch(addParticleThunk(particle));
    },
    [dispatch]
  );

  const spawnParticles = useCallback(
    (config: SpawnParticlesConfig) => {
      dispatch(spawnParticlesThunk(config));
    },
    [dispatch]
  );

  const toggleRuntime = useCallback(async () => {
    // Preserve current state before toggling (deprecated - use setRequestedRuntime instead)
    dispatch(toggleRuntimeAction());
  }, [dispatch]);

  const setRequestedRuntime = useCallback(
    (newRuntime: RequestedRuntimeType) => {
      dispatch(setRequestedRuntimeAction(newRuntime));
    },
    [dispatch]
  );

  // Utility functions
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const engine = engineRef.current;
      if (!engine) return { x: sx, y: sy };

      const canvas = canvasRef.current;
      if (!canvas) return { x: sx, y: sy };

      const rect = canvas.getBoundingClientRect();
      const zoom = engine.getZoom();
      const camera = engine.getCamera();

      // Convert screen coordinates to world coordinates
      const worldX = camera.x + (sx - rect.width / 2) / zoom;
      const worldY = camera.y + (sy - rect.height / 2) / zoom;

      return { x: worldX, y: worldY };
    },
    [canvasRef]
  );

  const handleWheel = useCallback(
    (deltaY: number, centerX: number, centerY: number) => {
      dispatch(
        handleWheelThunk({
          deltaY,
          centerX,
          centerY,
          screenToWorld,
        })
      );
    },
    [dispatch, screenToWorld]
  );

  const isSupported = useCallback((module: any) => {
    // Module compatibility check
    return module !== null;
  }, []);

  // Getter functions that call engine methods directly
  const getCount = useCallback(() => {
    return engineRef.current?.getCount() || 0;
  }, []);

  const getFPS = useCallback(() => {
    return engineRef.current?.getFPS() || 0;
  }, []);

  return {
    // State values (from Redux selectors)
    isWebGPU,
    isPlaying,
    isInitialized,
    isInitializing,
    error,
    constrainIterations,
    gridCellSize,
    clearColor,
    size,
    camera,
    zoom,
    runtime,
    requestedRuntime,
    actualRuntime,
    maxNeighbors,
    maxParticles,

    // Action functions (wrapped thunks)
    play,
    pause,
    clear,
    setSize,
    setCamera,
    setZoom,
    setConstrainIterations,
    setCellSize,
    setClearColor,
    setMaxNeighbors,
    setMaxParticles,
    addParticle,
    spawnParticles,
    toggleRuntime,
    setRequestedRuntime,

    // Utility functions
    handleWheel,
    screenToWorld,
    isSupported,
    getCount,
    getFPS,

    // Module references (direct access to engine instances)
    engine: engineRef.current,
    environment: environmentRef.current,
    boundary: boundaryRef.current,
    collisions: collisionsRef.current,
    fluids: fluidsRef.current,
    behavior: behaviorRef.current,
    sensors: sensorsRef.current,
    trails: trailsRef.current,
    interaction: interactionRef.current,
    particles: particlesRef.current,
    joints: jointsRef.current,
    lines: linesRef.current,
    grab: grabRef.current,
  };
}
