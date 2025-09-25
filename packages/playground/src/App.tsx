import {
  useEngine,
  EngineProvider,
  EngineCanvas,
} from "./contexts/EngineContext";
import { useTools } from "./hooks/useTools";
import { useEffect, useRef } from "react";
import { TopBar } from "./components/TopBar";
import { InitControlsRef } from "./components/InitControls";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./modules/store";
import { useAppDispatch } from "./modules/hooks";
import { setParticleCount, setFPS, playThunk } from "./modules/engine/slice";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const dispatch = useAppDispatch();
  const initControlsRef = useRef<InitControlsRef>(null);

  // Get engine state and actions from context
  const {
    canvasRef,
    system,
    isInitialized,
    isInitializing,
    error,
    spawnParticles,
    interaction,
    handleZoom,
    useWebGPU,
    engineType,
    addParticle,
    screenToWorld,
  } = useEngine();

  // Initialize tools
  const tools = useTools({
    canvasRef,
    addParticle,
    screenToWorld,
    isInitialized,
    initialMode: "cursor",
  });

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

  return (
    <div className="app">
      <TopBar onReset={handleRestart} />
      <div
        className="app-content"
        style={{
          marginTop: "60px",
          height: "calc(100vh - 60px)",
        }}
      >
        <SystemSidebar initControlsRef={initControlsRef} />
        <div className="canvas-container">
          <Toolbar style={{ display: "block" }} />
          <EngineCanvas className="" />
        </div>
        <div className="right-sidebar" style={{ display: "block" }}>
          <ModulesSidebar />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <EngineProvider>
        <AppContent />
      </EngineProvider>
    </Provider>
  );
}

export default App;
