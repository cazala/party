import { useCallback, useEffect, useRef, useState } from "react";
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
  Particle,
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
  selectCamera,
  selectZoom,
  selectSize,
  selectClearColor,
  playThunk,
  pauseThunk,
  clearThunk,
  setSizeThunk,
  setCameraThunk,
  setZoomThunk,
  setConstrainIterationsThunk,
  setCellSizeThunk,
  setMaxNeighborsThunk,
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
  setConstrainIterations as setConstrainIterationsAction,
  setGridCellSize as setGridCellSizeAction,
  setClearColor as setClearColorAction,
  setCamera as setCameraAction,
  setZoom as setZoomAction,
  SpawnParticlesConfig,
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
  importParticleSettings,
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
  const camera = useAppSelector(selectCamera);
  const zoom = useAppSelector(selectZoom);
  const size = useAppSelector(selectSize);
  const clearColor = useAppSelector(selectClearColor);
  const modulesState = useAppSelector(selectModules);

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
  const particleRef = useRef<Particle | null>(null);
  const jointsRef = useRef<Joints | null>(null);
  const linesRef = useRef<Lines | null>(null);
  const grabRef = useRef<Grab | null>(null);

  // Local state for engine initialization
  const [isAutoMode, setIsAutoMode] = useState(true);

  // Engine type string for canvas key
  const runtime: "cpu" | "webgpu" = isWebGPU ? "webgpu" : "cpu";

  // Initialize engine
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const initEngine = async () => {
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

          currentEngine.destroy();
          engineRef.current = null;
          environmentRef.current = null;
          boundaryRef.current = null;
          collisionsRef.current = null;
          fluidsRef.current = null;
          behaviorRef.current = null;
          sensorsRef.current = null;
          trailsRef.current = null;
          interactionRef.current = null;
          particleRef.current = null;
          jointsRef.current = null;
          linesRef.current = null;
          registerEngine(null);
        } catch (err) {
          console.warn("Error cleaning up previous engine:", err);
          preservedState = null; // Reset if there was an error
        }

        // Give a small delay for WebGPU context cleanup
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;

      // Ensure the canvas is properly mounted and has the correct attributes
      if (!canvas.isConnected || !canvas.parentElement) {
        // Canvas not properly mounted yet, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (!canvasRef.current || !canvasRef.current.isConnected) {
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

      dispatch(setInitializing(true));
      dispatch(setError(null));

      try {
        // Determine engine type
        let shouldUseWebGPU = isAutoMode ? false : isWebGPU;

        if (isAutoMode) {
          // Auto-detect WebGPU support
          if (navigator.gpu && (await navigator.gpu.requestAdapter())) {
            shouldUseWebGPU = true;
          }
        }

        dispatch(setWebGPU(shouldUseWebGPU));

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

        // Create particle renderer
        const particle = new Particle();

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
        const render = [trails, lines, particle];

        // Create engine
        const engine = new Engine({
          canvas,
          forces,
          render,
          runtime: isAutoMode ? "auto" : shouldUseWebGPU ? "webgpu" : "cpu",
        });

        await engine.initialize();

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
        particleRef.current = particle;
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

        // Update Redux with actual engine defaults (sync only, don't call engine methods)
        dispatch(setConstrainIterationsAction(actualConstrainIterations));
        dispatch(setGridCellSizeAction(actualCellSize));
        dispatch(setClearColorAction(actualClearColor));
        dispatch(setCameraAction({ x: actualCamera.x, y: actualCamera.y }));
        dispatch(setZoomAction(actualZoom));
        dispatch(setWebGPU(shouldUseWebGPU));

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
            dispatch(importParticleSettings(modules.particle));
          }
        }

        // Mark as initialized
        dispatch(setInitialized(true));
        dispatch(setInitializing(false));

        dispatch(playThunk());

        // Setup cleanup
        cleanup = () => {
          engine.destroy();
          engineRef.current = null;
          environmentRef.current = null;
          boundaryRef.current = null;
          collisionsRef.current = null;
          fluidsRef.current = null;
          behaviorRef.current = null;
          sensorsRef.current = null;
          trailsRef.current = null;
          interactionRef.current = null;
          particleRef.current = null;
          jointsRef.current = null;
          linesRef.current = null;
          registerEngine(null);
        };
      } catch (err) {
        dispatch(
          setError(err instanceof Error ? err.message : "Unknown error")
        );
        dispatch(setInitializing(false));
      }
    };

    initEngine();

    return cleanup || undefined;
  }, [canvasRef, isWebGPU, dispatch]);

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

    const environment = environmentRef.current;
    const boundary = boundaryRef.current;
    const collisions = collisionsRef.current;
    const fluids = fluidsRef.current;
    const behavior = behaviorRef.current;
    const sensors = sensorsRef.current;
    const trails = trailsRef.current;
    const interaction = interactionRef.current;
    const particle = particleRef.current;
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

      if (particle && particle.setEnabled) {
        particle.setEnabled(modulesState.particle.enabled);
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
    modulesState.environment.enabled,
    modulesState.boundary.enabled,
    modulesState.collisions.enabled,
    modulesState.fluids.enabled,
    modulesState.behavior.enabled,
    modulesState.sensors.enabled,
    modulesState.trails.enabled,
    modulesState.interaction.enabled,
    modulesState.particle.enabled,
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
    // Preserve current state before toggling
    setIsAutoMode(false);
    dispatch(toggleRuntimeAction());
  }, [dispatch]);

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
    maxNeighbors,

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
    addParticle,
    spawnParticles,
    toggleRuntime,

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
    particle: particleRef.current,
    joints: jointsRef.current,
    lines: linesRef.current,
    grab: grabRef.current,
  };
}
