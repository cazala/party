import React, {
  createContext,
  useContext,
  useRef,
  ReactNode,
  useEffect,
} from "react";
import { useEngineInternal } from "../hooks/useEngine";
import { useWindowSize } from "../hooks/useWindowSize";
import { useAppDispatch } from "../modules/hooks";
import {
  setSizeThunk,
  registerEngine,
  SpawnParticlesConfig,
} from "../modules/engine/slice";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 60;

// Define the context interface - same as what useEngine returns
interface EngineContextType {
  // Canvas ref for direct access if needed
  canvasRef: React.RefObject<HTMLCanvasElement>;
  // All the engine state and actions
  isWebGPU: boolean;
  isPlaying: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  particleCount: number;
  fps: number;
  clearColor: { r: number; g: number; b: number; a: number };
  size: { width: number; height: number };
  camera: { x: number; y: number };
  zoom: number;
  engineType: string;
  useWebGPU: boolean;

  // Action functions
  play: () => void;
  pause: () => void;
  clear: () => void;
  setSize: (newSize: { width: number; height: number }) => void;
  setCamera: (newCamera: { x: number; y: number }) => void;
  setZoom: (newZoom: number) => void;
  setConstrainIterations: (iterations: number) => void;
  setCellSize: (cellSize: number) => void;
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
  toggleEngineType: () => Promise<void>;

  // Utility functions
  handleZoom: (deltaY: number, centerX: number, centerY: number) => void;
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  isSupported: (module: any) => boolean;
  getParticleCount: () => number;
  getFPS: () => number;

  // Module references
  system: any;
  environment: any;
  boundary: any;
  collisions: any;
  fluids: any;
  behavior: any;
  sensors: any;
  trails: any;
  interaction: any;
}

const EngineContext = createContext<EngineContextType | null>(null);

interface EngineProviderProps {
  children: ReactNode;
}

export function EngineProvider({ children }: EngineProviderProps) {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useWindowSize();

  // Calculate canvas dimensions
  const canvasWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
  const canvasHeight = size.height - TOPBAR_HEIGHT;

  // Initialize engine using the internal hook
  const engineState = useEngineInternal({
    canvasRef,
    initialSize: { width: canvasWidth, height: canvasHeight },
  });

  const { system, isInitialized } = engineState;

  // Register engine instance for thunks
  useEffect(() => {
    registerEngine(system);
  }, [system]);

  // Update canvas size when window size changes
  useEffect(() => {
    if (system && isInitialized) {
      const targetWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = size.height - TOPBAR_HEIGHT;
      dispatch(setSizeThunk({ width: targetWidth, height: targetHeight }));
    }
  }, [system, isInitialized, size, dispatch]);

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

export function useEngine(): EngineContextType {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error("useEngine must be used within an EngineProvider");
  }
  return context;
}

// Export the canvas component that should be used in the app
export function EngineCanvas({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { canvasRef, size, engineType } = useEngine();

  return (
    <canvas
      key={engineType} // Force canvas recreation when engine type changes
      ref={canvasRef}
      id="canvas"
      className={className}
      style={style}
      width={size.width}
      height={size.height}
    />
  );
}
