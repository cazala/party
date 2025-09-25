import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import {
  selectEngineState,
  selectIsWebGPU,
  selectIsPlaying,
  selectIsInitialized,
  selectIsInitializing,
  selectError,
  selectParticleCount,
  selectFPS,
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
  setClearColorThunk,
  toggleEngineType as toggleEngineTypeAction,
  addParticleThunk,
  spawnParticlesThunk,
  handleZoomThunk,
  registerEngine,
  setParticleCount,
  setFPS,
  setWebGPU,
  setInitialized,
  setInitializing,
  setError,
  setConstrainIterations as setConstrainIterationsAction,
  setGridCellSize as setGridCellSizeAction, 
  setClearColor,
  setCamera as setCameraAction,
  setZoom as setZoomAction,
} from "../modules/engine/slice";
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
} from "@cazala/party";

export interface UseEngineProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  initialSize?: { width: number; height: number };
}

// Internal version used by EngineProvider
export function useEngineInternal({ canvasRef, initialSize }: UseEngineProps) {
  const dispatch = useAppDispatch();
  
  // All state from Redux
  const engineState = useAppSelector(selectEngineState);
  const isWebGPU = useAppSelector(selectIsWebGPU);
  const isPlaying = useAppSelector(selectIsPlaying);
  const isInitialized = useAppSelector(selectIsInitialized);
  const isInitializing = useAppSelector(selectIsInitializing);
  const error = useAppSelector(selectError);
  const particleCount = useAppSelector(selectParticleCount);
  const fps = useAppSelector(selectFPS);
  const camera = useAppSelector(selectCamera);
  const zoom = useAppSelector(selectZoom);
  const size = useAppSelector(selectSize);
  const clearColor = useAppSelector(selectClearColor);
  
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
  
  // Local state for engine initialization
  const [isAutoMode, setIsAutoMode] = useState(true);
  
  // Engine type string for canvas key
  const engineType = isWebGPU ? "webgpu" : "cpu";
  
  // Initialize engine
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    const initEngine = async () => {
      console.log('🔄 useEngine: initEngine called', { isWebGPU, canvasRef: !!canvasRef.current });
      
      // Cleanup any existing engine first
      if (engineRef.current) {
        dispatch(setInitialized(false));
        dispatch(setInitializing(true));
        
        try {
          engineRef.current.destroy();
          engineRef.current = null;
          environmentRef.current = null;
          boundaryRef.current = null;
          collisionsRef.current = null;
          fluidsRef.current = null;
          behaviorRef.current = null;
          sensorsRef.current = null;
          trailsRef.current = null;
          interactionRef.current = null;
          registerEngine(null);
        } catch (err) {
          console.warn("Error cleaning up previous engine:", err);
        }
        
        // Give a small delay for WebGPU context cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      
      // Ensure the canvas is properly mounted and has the correct attributes
      if (!canvas.isConnected || !canvas.parentElement) {
        // Canvas not properly mounted yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!canvasRef.current || !canvasRef.current.isConnected) {
          return; // Canvas still not ready
        }
      }
      
      // Get canvas dimensions - use explicit size if provided, otherwise canvas attributes
      let canvasWidth = initialSize?.width || canvas.width || canvas.offsetWidth;
      let canvasHeight = initialSize?.height || canvas.height || canvas.offsetHeight;
      
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
          if (navigator.gpu && await navigator.gpu.requestAdapter()) {
            shouldUseWebGPU = true;
          }
        }
        
        dispatch(setWebGPU(shouldUseWebGPU));
        
        // Create modules first
        const environment = new Environment({
          gravityStrength: 0,
          dirX: 0,
          dirY: 1,
          inertia: 0,
          friction: 0,
          damping: 0,
        });
        const boundary = new Boundary({
          restitution: 0.6,
          friction: 0.1,
          mode: "bounce",
        });
        const collisions = new Collisions({ restitution: 0.8 });
        const fluids = new Fluids({ enabled: false });
        const behavior = new Behavior({ enabled: false });
        const sensors = new Sensors({ enabled: false });
        const interaction = new Interaction({
          enabled: false,
          strength: 10000,
          radius: 500,
        });
        const trails = new Trails({ enabled: false });
        
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
        ];
        const render = [trails, particle];
        
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
        const actualParticleCount = engine.getCount();
        const actualFPS = engine.getFPS();
        
        // Update Redux with actual engine defaults (sync only, don't call engine methods)
        dispatch(setConstrainIterationsAction(actualConstrainIterations));
        dispatch(setGridCellSizeAction(actualCellSize));
        dispatch(setClearColor(actualClearColor));
        dispatch(setCameraAction({ x: actualCamera.x, y: actualCamera.y }));
        dispatch(setZoomAction(actualZoom));
        dispatch(setParticleCount(actualParticleCount));
        dispatch(setFPS(actualFPS));
        dispatch(setWebGPU(shouldUseWebGPU));
        
        // Mark as initialized
        dispatch(setInitialized(true));
        dispatch(setInitializing(false));
        
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
          registerEngine(null);
        };
        
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : "Unknown error"));
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
      engine.setConstrainIterations(engineState.constrainIterations);
      engine.setCellSize(engineState.gridCellSize);
      engine.setClearColor(clearColor);
    } catch (err) {
      console.warn("Error applying engine configuration:", err);
    }
  }, [isInitialized, engineState.constrainIterations, engineState.gridCellSize, clearColor]);
  
  // Periodic updates for particle count and FPS
  useEffect(() => {
    if (!engineRef.current || !isInitialized) return;

    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (engine) {
        const currentParticleCount = engine.getCount();
        const currentFPS = engine.getFPS();
        
        dispatch(setParticleCount(currentParticleCount));
        dispatch(setFPS(currentFPS));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isInitialized, dispatch]);
  
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
  
  const setSize = useCallback((newSize: { width: number; height: number }) => {
    dispatch(setSizeThunk(newSize));
  }, [dispatch]);
  
  const setCamera = useCallback((newCamera: { x: number; y: number }) => {
    dispatch(setCameraThunk(newCamera));
  }, [dispatch]);
  
  const setZoom = useCallback((newZoom: number) => {
    dispatch(setZoomThunk(newZoom));
  }, [dispatch]);
  
  const setConstrainIterations = useCallback((iterations: number) => {
    dispatch(setConstrainIterationsThunk(iterations));
  }, [dispatch]);
  
  const setCellSize = useCallback((cellSize: number) => {
    dispatch(setCellSizeThunk(cellSize));
  }, [dispatch]);
  
  const setClearColorAction = useCallback((color: { r: number; g: number; b: number; a: number }) => {
    dispatch(setClearColorThunk(color));
  }, [dispatch]);
  
  const addParticle = useCallback((particle: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    size: number;
    mass: number;
    color: { r: number; g: number; b: number; a: number };
  }) => {
    dispatch(addParticleThunk(particle));
  }, [dispatch]);
  
  const spawnParticles = useCallback((
    numParticles: number,
    shape: "grid" | "random" | "circle" | "donut" | "square",
    spacing: number,
    particleSize: number,
    radius?: number,
    colors?: string[],
    velocityConfig?: {
      speed: number;
      direction: "random" | "in" | "out" | "custom" | "clockwise" | "counter-clockwise";
      angle: number;
    },
    innerRadius?: number,
    squareSize?: number,
    cornerRadius?: number,
    particleMass?: number
  ) => {
    dispatch(spawnParticlesThunk({
      numParticles,
      shape,
      spacing,
      particleSize,
      radius,
      colors,
      velocityConfig,
      innerRadius,
      squareSize,
      cornerRadius,
      particleMass,
    }));
  }, [dispatch]);
  
  const toggleEngineType = useCallback(async () => {
    // Simply toggle the Redux state and let useEffect handle engine recreation
    setIsAutoMode(false);
    dispatch(toggleEngineTypeAction());
  }, [dispatch]);
  
  // Utility functions
  const screenToWorld = useCallback((sx: number, sy: number) => {
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
  }, [canvasRef]);
  
  const handleZoom = useCallback((deltaY: number, centerX: number, centerY: number) => {
    dispatch(handleZoomThunk({
      deltaY,
      centerX,
      centerY,
      screenToWorld,
    }));
  }, [dispatch, screenToWorld]);
  
  const isSupported = useCallback((module: any) => {
    // Module compatibility check
    return module !== null;
  }, []);
  
  // Getter functions that return current values
  const getParticleCount = useCallback(() => particleCount, [particleCount]);
  const getFPS = useCallback(() => fps, [fps]);
  
  
  return {
    // State values (from Redux selectors)
    isWebGPU,
    isPlaying,
    isInitialized,
    isInitializing,
    error,
    particleCount,
    fps,
    clearColor,
    size,
    camera,
    zoom,
    engineType,
    useWebGPU: isWebGPU, // Alias for consistency
    
    // Action functions (wrapped thunks)
    play,
    pause,
    clear,
    setSize,
    setCamera,
    setZoom,
    setConstrainIterations,
    setCellSize,
    setClearColor: setClearColorAction,
    addParticle,
    spawnParticles,
    toggleEngineType,
    
    // Utility functions
    handleZoom,
    screenToWorld,
    isSupported,
    getParticleCount,
    getFPS,
    
    // Module references (direct access to engine instances)
    system: engineRef.current,
    environment: environmentRef.current,
    boundary: boundaryRef.current,
    collisions: collisionsRef.current,
    fluids: fluidsRef.current,
    behavior: behaviorRef.current,
    sensors: sensorsRef.current,
    trails: trailsRef.current,
    interaction: interactionRef.current,
  };
}