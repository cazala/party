import { usePlayground } from "./hooks/usePlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect, useRef } from "react";
import { TopBar } from "./components/TopBar";
import { InitControlsRef } from "./components/InitControls";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./modules/store";
import { useAppDispatch, useAppSelector } from "./modules/hooks";
import {
  setConstrainIterations,
  setGridCellSize,
  setClearColor,
  setParticleCount,
  setFPS,
  setWebGPU,
  toggleEngineType as toggleEngineTypeAction,
  selectEngineState,
} from "./modules/engine/slice";

import "./styles/index.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 60;

function AppContent() {
  const dispatch = useAppDispatch();
  const engineState = useAppSelector(selectEngineState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initControlsRef = useRef<InitControlsRef>(null);

  const {
    system,
    isInitialized,
    isInitializing,
    error,
    spawnParticles,
    environment,
    boundary,
    collisions,
    fluids,
    behavior,
    sensors,
    trails,
    interaction,
    play,
    pause,
    clear,
    handleZoom,
    useWebGPU,
    engineType,
    isSupported,
    toggleEngineType,
  } = usePlayground({ canvasRef });

  const size = useWindowSize();

  // Update canvas size when window size changes
  useEffect(() => {
    if (system && isInitialized) {
      const targetWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = size.height - TOPBAR_HEIGHT;
      system.setSize(targetWidth, targetHeight);
    }
  }, [system, isInitialized, size, useWebGPU]);

  // Spawn initial particles when initialized
  useEffect(() => {
    if (isInitialized && system) {
      play();
    }
  }, [isInitialized, system, play]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !handleZoom || !isInitialized) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      handleZoom(e.deltaY, centerX, centerY);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [handleZoom, isInitialized, engineType]); // Add engineType and isInitialized to dependencies

  // Add a timeout for initialization
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized && !error) {
        console.error("WebGPU initialization timeout");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized, error]);

  // Sync slider values with actual engine values when initialized or engine type changes
  useEffect(() => {
    if (system && isInitialized && !isInitializing) {
      const newConstrainIterations = system.getConstrainIterations();
      const newCellSize = system.getCellSize();
      const newClearColor = system.getClearColor();

      // Update Redux state with engine values
      dispatch(setConstrainIterations(newConstrainIterations));
      dispatch(setGridCellSize(newCellSize));
      dispatch(setClearColor(newClearColor));
      dispatch(setWebGPU(useWebGPU));
    }
  }, [system, isInitialized, isInitializing, useWebGPU, dispatch]);

  // Periodic updates for particle count and FPS
  useEffect(() => {
    if (!system || !isInitialized) return;

    const interval = setInterval(() => {
      const particleCount = system.getCount();
      const fps = system.getFPS();
      
      dispatch(setParticleCount(particleCount));
      dispatch(setFPS(fps));
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [system, isInitialized, dispatch]);

  // Sync constraint iterations from Redux to engine when Redux state changes
  useEffect(() => {
    if (system && isInitialized && !isInitializing) {
      const currentEngineValue = system.getConstrainIterations();
      if (currentEngineValue !== engineState.constrainIterations) {
        system.setConstrainIterations(engineState.constrainIterations);
      }
    }
  }, [system, isInitialized, isInitializing, engineState.constrainIterations]);

  let content = null;

  const handleRestart = () => {
    // Re-spawn particles using current INIT panel config
    const cfg = initControlsRef.current?.getState();
    if (!cfg) return;
    spawnParticles(
      cfg.numParticles,
      cfg.spawnShape,
      cfg.spacing,
      cfg.particleSize,
      cfg.radius,
      cfg.colors,
      cfg.velocityConfig,
      cfg.innerRadius,
      cfg.squareSize,
      cfg.cornerRadius,
      cfg.particleMass
    );
    play();
  };

  const handleConstrainIterationsChange = (value: number) => {
    dispatch(setConstrainIterations(value));
    if (system && isInitialized) {
      system.setConstrainIterations(value);
    }
  };

  const handleCellSizeChange = (value: number) => {
    dispatch(setGridCellSize(value));
    if (system && isInitialized) {
      system.setCellSize(value);
    }
  };

  const handleClearColorChange = (color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }) => {
    dispatch(setClearColor(color));
    if (system && isInitialized) {
      system.setClearColor(color);
    }
  };

  const handleToggleEngineType = async () => {
    // First dispatch the Redux action to update state and set default constraint iterations
    dispatch(toggleEngineTypeAction());
    // Then call the engine toggle which will reinitialize with the new values
    await toggleEngineType();
  };

  const handleColorPickerChange = (hex: string) => {
    const newColor = hexToRgba(hex, 1); // Always use alpha = 1
    handleClearColorChange(newColor);
  };

  // Utility function for color conversion
  const hexToRgba = (hex: string, alpha: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
          a: alpha,
        }
      : { r: 0, g: 0, b: 0, a: 1 };
  };

  return (
    <div className="app">
      <TopBar
        system={null}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={handleRestart}
      />
      <div
        className="app-content"
        style={{
          marginTop: "60px",
          height: "calc(100vh - 60px)",
        }}
      >
        <SystemSidebar
          content={content}
          initControlsRef={initControlsRef}
          spawnParticles={spawnParticles}
          onConstrainIterationsChange={handleConstrainIterationsChange}
          onCellSizeChange={handleCellSizeChange}
          onClearColorChange={handleColorPickerChange}
          onToggleEngineType={handleToggleEngineType}
        />
        <div className="canvas-container">
          <Toolbar style={{ display: "block" }} />
          <canvas
            key={engineType} // Force canvas recreation when engine type changes
            ref={canvasRef}
            id="canvas"
            className={""}
            width={size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH}
            height={size.height - TOPBAR_HEIGHT}
          />
        </div>
        <div className="right-sidebar" style={{ display: "block" }}>
          <ModulesSidebar
            environment={environment}
            boundary={boundary}
            collisions={collisions}
            fluids={fluids}
            behavior={behavior}
            sensors={sensors}
            trails={trails}
            interaction={interaction}
            isSupported={isSupported}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
