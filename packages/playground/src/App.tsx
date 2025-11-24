import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { EngineProvider } from "./contexts/EngineContext";
import { ResetProvider } from "./contexts/ResetContext";
import { Canvas } from "./components/Canvas";
import { Overlay } from "./components/Overlay";
import { TopBar } from "./components/TopBar";
import { ModulesSidebar } from "./components/ModulesSidebar";
import { Toolbar } from "./components/ToolBar";
import { SystemSidebar } from "./components/SystemSidebar";
import { GlobalHotkeys } from "./components/GlobalHotkeys";
import { useUI } from "./hooks/useUI";
import { useRender } from "./hooks/useRender";
import { useHomepage } from "./hooks/useHomepage";
import { store } from "./slices/store";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const { barsVisible, restoreBarsFromFullscreenMode } = useUI();
  const { invertColors } = useRender();
  const { hasStarted, isPlaying, play, stop } = useHomepage();
  const hasAutoPlayed = useRef(false);

  // Handle fullscreen change events (when user exits via ESC or browser controls)
  useEffect(() => {
    const handleFullscreenChange = () => {
      // If we exited fullscreen and bars are not visible, restore them with proper locking
      if (!document.fullscreenElement && !barsVisible) {
        restoreBarsFromFullscreenMode();
      }
    };

    // Add event listeners for all browser variants
    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];

    events.forEach((event) => {
      document.addEventListener(event, handleFullscreenChange);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleFullscreenChange);
      });
    };
  }, [restoreBarsFromFullscreenMode, barsVisible]);

  // Start playing demos automatically when ready (only once)
  useEffect(() => {
    if (hasStarted && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      play();
    }
  }, [hasStarted, play]);

  return (
    <div
      className={`app ${
        barsVisible && hasStarted ? "bars-visible" : "bars-hidden"
      }`}
    >
      <TopBar />
      <GlobalHotkeys />
      <div className="app-content">
        <SystemSidebar />
        <div className="playground">
          <Toolbar />
          <div
            className={`canvas-container ${
              invertColors ? "invert-colors" : ""
            }`}
          >
            <Canvas />
            <Overlay />
            {isPlaying && (
              <button
                onClick={stop}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  padding: "10px 20px",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  zIndex: 1000,
                }}
              >
                Stop Demo
              </button>
            )}
          </div>
        </div>
        <div className="right-sidebar">
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
        <ResetProvider>
          <AppContent />
        </ResetProvider>
      </EngineProvider>
    </Provider>
  );
}

export default App;
