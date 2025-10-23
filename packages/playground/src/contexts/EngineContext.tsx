import React, { createContext, useRef, ReactNode, useEffect, useMemo } from "react";
import {
  Engine,
  Environment,
  Boundary,
  Collisions,
  Fluids,
  Behavior,
  Sensors,
  Trails,
  Interaction,
  Particles,
  Joints,
  Lines,
  Grab,
} from "@cazala/party";
import { useEngineInternal } from "../hooks/useEngineInternal";
import { useWindowSize } from "../hooks/useWindowSize";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import {
  setSizeThunk,
  registerEngine,
  SpawnParticlesConfig,
} from "../slices/engine";
import { loadAvailableSessionsThunk } from "../slices/session";
import { selectBarsVisible, LAYOUT_CONSTANTS } from "../slices/ui";

// Define the context interface - same as what useEngine returns
export interface EngineContextType {
  // Canvas ref for direct access if needed
  canvasRef: React.RefObject<HTMLCanvasElement>;

  // All the engine state and actions
  isWebGPU: boolean;
  isPlaying: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  constrainIterations: number;
  gridCellSize: number;
  maxNeighbors: number;
  clearColor: { r: number; g: number; b: number; a: number };
  size: { width: number; height: number };
  canvasDimensions: { width: number; height: number };
  camera: { x: number; y: number };
  zoom: number;
  runtime: "cpu" | "webgpu";

  // Action functions
  play: () => void;
  pause: () => void;
  clear: () => void;
  setSize: (newSize: { width: number; height: number }) => void;
  setCamera: (newCamera: { x: number; y: number }) => void;
  setZoom: (newZoom: number) => void;
  setConstrainIterations: (iterations: number) => void;
  setCellSize: (cellSize: number) => void;
  setMaxNeighbors: (value: number) => void;
  setClearColor: (color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }) => void;
  addParticle: (particle: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    size: number;
    mass: number;
    color: { r: number; g: number; b: number; a: number };
  }) => void;
  spawnParticles: (config: SpawnParticlesConfig) => void;
  toggleRuntime: () => Promise<void>;

  // Utility functions
  handleWheel: (deltaY: number, centerX: number, centerY: number) => void;
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  isSupported: (module: any) => boolean;
  getCount: () => number;
  getFPS: () => number;

  // Module references
  engine: Engine | null;
  environment: Environment | null;
  boundary: Boundary | null;
  collisions: Collisions | null;
  fluids: Fluids | null;
  behavior: Behavior | null;
  sensors: Sensors | null;
  trails: Trails | null;
  interaction: Interaction | null;
  particles: Particles | null;
  joints: Joints | null;
  lines: Lines | null;
  grab: Grab | null;
}

export const EngineContext = createContext<EngineContextType | null>(null);

interface EngineProviderProps {
  children: ReactNode;
}

export function EngineProvider({ children }: EngineProviderProps) {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useWindowSize();
  const barsVisible = useAppSelector(selectBarsVisible);

  // Memoize canvas dimensions calculation to prevent unnecessary re-renders
  const canvasDimensions = useMemo(() => {
    if (barsVisible) {
      return {
        width: size.width - LAYOUT_CONSTANTS.LEFT_SIDEBAR_WIDTH - LAYOUT_CONSTANTS.RIGHT_SIDEBAR_WIDTH,
        height: size.height - LAYOUT_CONSTANTS.TOPBAR_HEIGHT - LAYOUT_CONSTANTS.TOOLBAR_HEIGHT,
      };
    } else {
      // Full window when bars are hidden
      return {
        width: size.width,
        height: size.height,
      };
    }
  }, [size.width, size.height, barsVisible]);

  // Initialize engine using the internal hook
  const engineState = useEngineInternal({
    canvasRef,
    initialSize: canvasDimensions,
  });

  const { engine, isInitialized } = engineState;

  // Register engine instance for thunks
  useEffect(() => {
    registerEngine(engine);
  }, [engine]);

  // Load available sessions when engine is first initialized
  useEffect(() => {
    if (isInitialized && engine) {
      dispatch(loadAvailableSessionsThunk());
    }
  }, [isInitialized, engine, dispatch]);

  // Update engine size to match canvas dimensions (visual space)
  useEffect(() => {
    if (engine && isInitialized) {
      // Keep engine size synchronized with canvas dimensions to ensure
      // consistent coordinate systems between visual and simulation space
      const currentEngineSize = engine.getSize();
      
      // Update engine size if canvas dimensions changed
      if (currentEngineSize.width !== canvasDimensions.width || 
          currentEngineSize.height !== canvasDimensions.height) {
        dispatch(setSizeThunk(canvasDimensions));
      }
    }
  }, [engine, isInitialized, canvasDimensions, dispatch]);

  // Add a timeout for initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized) {
        console.error("WebGPU initialization timeout");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized]);

  // Create the context value
  const contextValue: EngineContextType = {
    canvasRef,
    canvasDimensions,
    ...engineState,
  };

  return (
    <EngineContext.Provider value={contextValue}>
      {children}
    </EngineContext.Provider>
  );
}
