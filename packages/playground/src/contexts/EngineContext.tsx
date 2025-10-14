import React, { createContext, useRef, ReactNode, useEffect } from "react";
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
  Particle,
  Joints,
  Lines,
  Grab,
} from "@cazala/party";
import { useEngineInternal } from "../hooks/useEngineInternal";
import { useWindowSize } from "../hooks/useWindowSize";
import { useAppDispatch } from "../hooks/useAppDispatch";
import {
  setSizeThunk,
  registerEngine,
  SpawnParticlesConfig,
} from "../slices/engine";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;
const TOOLBAR_HEIGHT = 60;

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
  particle: Particle | null;
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

  // Calculate canvas dimensions
  const canvasWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
  const canvasHeight = size.height - TOPBAR_HEIGHT - TOOLBAR_HEIGHT;

  // Initialize engine using the internal hook
  const engineState = useEngineInternal({
    canvasRef,
    initialSize: { width: canvasWidth, height: canvasHeight },
  });

  const { engine, isInitialized } = engineState;

  // Register engine instance for thunks
  useEffect(() => {
    registerEngine(engine);
  }, [engine]);

  // Update canvas size when window size changes
  useEffect(() => {
    if (engine && isInitialized) {
      const targetWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = size.height - TOPBAR_HEIGHT - TOOLBAR_HEIGHT;
      dispatch(setSizeThunk({ width: targetWidth, height: targetHeight }));
    }
  }, [engine, isInitialized, size, dispatch]);

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
    ...engineState,
  };

  return (
    <EngineContext.Provider value={contextValue}>
      {children}
    </EngineContext.Provider>
  );
}
