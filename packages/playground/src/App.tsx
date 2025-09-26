import {
  useEngine,
  EngineProvider,
  EngineCanvas,
} from "./contexts/EngineContext";
import { useTools } from "./hooks/useTools";
import { useCallback, useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { Provider } from "react-redux";
import { store } from "./modules/store";
import { useInit } from "./hooks/useInit";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const { initState } = useInit();

  // Get engine state and actions from context
  const {
    canvasRef,
    system,
    isInitialized,
    spawnParticles,
    handleZoom,
    engineType,
    play,
  } = useEngine();

  // Trigger initial particle spawn when engine is initialized
  useEffect(() => {
    if (isInitialized && system) {
      spawnParticles(initState);
    }
  }, [isInitialized, system, spawnParticles, initState]);

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

  return (
    <div className="app">
      <TopBar />
      <div className="app-content">
        <SystemSidebar />
        <div className="canvas-playground">
          <Toolbar style={{ display: "block" }} />
          <div className="canvas-container">
            <EngineCanvas />
          </div>
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
