import { useEngine } from "./hooks/useEngine";
import { useTools } from "./hooks/useTools";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect, useRef } from "react";
import { TopBar } from "./components/TopBar";
import { InitControlsRef } from "./components/InitControls";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./modules/store";
import { useAppDispatch } from "./modules/hooks";
import {
  setParticleCount,
  setFPS,
  playThunk,
  pauseThunk,
  clearThunk,
  setSizeThunk,
  setConstrainIterationsThunk,
  setCellSizeThunk,
  setClearColorThunk,
  registerEngine,
} from "./modules/engine/slice";

import "./styles/index.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 60;

function AppContent() {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initControlsRef = useRef<InitControlsRef>(null);

  const size = useWindowSize();

  // Calculate canvas size
  const canvasWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
  const canvasHeight = size.height - TOPBAR_HEIGHT;
  
  // Initialize engine
  const engine = useEngine({ 
    canvasRef, 
    initialSize: { width: canvasWidth, height: canvasHeight } 
  });
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
    handleZoom,
    useWebGPU,
    engineType,
    isSupported,
    toggleEngineType,
    addParticle,
    screenToWorld,
  } = engine;
  
  // Initialize tools
  const tools = useTools({
    canvasRef,
    addParticle,
    screenToWorld,
    isInitialized,
    initialMode: "cursor",
  });

  // Register engine instance for thunks
  useEffect(() => {
    registerEngine(system);
  }, [system]);

  // Wire mouse input to Interaction module and Tools
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interaction || !isInitialized) return;

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      interaction.setPosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
      tools.handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);
      
      // Handle tools first - if a tool handles the event, don't activate interaction
      tools.handleMouseDown(e);
      
      // Only activate interaction for cursor mode (when no tool is active)
      if (tools.toolMode === "cursor") {
        interaction.setActive(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      tools.handleMouseUp(e);
      interaction.setActive(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      tools.handleContextMenu(e);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [
    canvasRef.current,
    interaction,
    isInitialized,
    useWebGPU,
    isInitializing,
    tools,
    screenToWorld,
  ]);

  // Update canvas size when window size changes
  useEffect(() => {
    if (system && isInitialized) {
      const targetWidth = size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
      const targetHeight = size.height - TOPBAR_HEIGHT;
      dispatch(setSizeThunk({ width: targetWidth, height: targetHeight }));
    }
  }, [system, isInitialized, size, useWebGPU, dispatch]);

  // Trigger initial particle spawn when engine is initialized
  useEffect(() => {
    if (isInitialized && system && initControlsRef.current) {
      const cfg = initControlsRef.current.getState();
      spawnParticles(
        cfg.numParticles,
        cfg.spawnShape,
        cfg.spacing,
        cfg.particleSize,
        cfg.radius,
        cfg.colors.length > 0 ? cfg.colors : undefined,
        cfg.velocityConfig,
        cfg.innerRadius,
        cfg.squareSize,
        cfg.cornerRadius,
        cfg.particleMass
      );
    }
  }, [isInitialized, system, spawnParticles]);


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
    dispatch(playThunk());
  };

  const handleConstrainIterationsChange = (value: number) => {
    dispatch(setConstrainIterationsThunk(value));
  };

  const handleCellSizeChange = (value: number) => {
    dispatch(setCellSizeThunk(value));
  };

  const handleClearColorChange = (color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }) => {
    dispatch(setClearColorThunk(color));
  };

  const handleToggleEngineType = async () => {
    // Use the simple toggle from useEngine
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
        onPlay={() => dispatch(playThunk())}
        onPause={() => dispatch(pauseThunk())}
        onClear={() => dispatch(clearThunk())}
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
