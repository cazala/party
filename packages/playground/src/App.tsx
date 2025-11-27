import { useEffect, useRef, useCallback } from "react";
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
import { MaxParticlesLabel } from "./components/MaxParticlesLabel";
import { GyroscopeDebugLabel } from "./components/GyroscopeDebugLabel";
import { Homepage } from "./components/Homepage";
import { useUI } from "./hooks/useUI";
import { useRender } from "./hooks/useRender";
import { useHomepage } from "./hooks/useHomepage";
import { useEngine } from "./hooks/useEngine";
import { useOscillators } from "./hooks/useOscillators";
import { useReset } from "./contexts/ResetContext";
import {
  useEnvironment,
  useBoundary,
  useCollisions,
  useFluids,
  useBehavior,
  useSensors,
  useJoints,
  useTrails,
} from "./hooks/modules";
import { RESTART_AFFECTED_MODULES } from "./constants/modules";
import { store } from "./slices/store";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const { barsVisible, restoreBarsFromFullscreenMode, setBarsVisibility } = useUI();
  const { invertColors, setInvertColors } = useRender();
  const { hasStarted, isPlaying, play, stop, gyroData } = useHomepage();
  const { spawnParticles, play: playEngine, setZoom } = useEngine();
  const { setEnabled: setTrailsEnabled } = useTrails();
  const { clearModuleOscillators } = useOscillators();
  const { setIsResetting } = useReset();

  const {
    reset: resetEnvironment,
  } = useEnvironment();
  const {
    reset: resetBoundary,
  } = useBoundary();
  const {
    reset: resetCollisions,
  } = useCollisions();
  const {
    reset: resetFluids,
  } = useFluids();
  const {
    reset: resetBehavior,
  } = useBehavior();
  const {
    reset: resetSensors,
  } = useSensors();
  const {
    reset: resetJoints,
  } = useJoints();

  const hasAutoPlayed = useRef(false);

  const handlePlay = useCallback(() => {
    // Stop the demo
    stop();

    // Show sidebars (enter playground mode)
    setBarsVisibility(true);

    // Reset all modules (like clicking the Reset button)
    setIsResetting(true);
    
    // Clear oscillators for each module first
    RESTART_AFFECTED_MODULES.forEach(moduleName => {
      clearModuleOscillators(moduleName);
    });
    
    // Then reset all module states
    resetEnvironment();
    resetBoundary();
    resetCollisions();
    resetFluids();
    resetBehavior();
    resetSensors();
    resetJoints();
    
    // Clear reset flag after a brief delay
    setTimeout(() => setIsResetting(false), 10);

    // Restart simulation with default configuration
    spawnParticles({
      numParticles: 900,
      shape: "grid",
      spacing: 12,
      particleSize: 5,
      radius: 100,
      innerRadius: 50,
      squareSize: 200,
      cornerRadius: 0,
      colors: [],
      velocityConfig: { speed: 0, direction: "random", angle: 0 },
      particleMass: 1,
      gridJoints: false,
    });
    
    // Start the engine
    playEngine();
  }, [
    stop,
    setBarsVisibility,
    setInvertColors,
    setIsResetting,
    clearModuleOscillators,
    resetEnvironment,
    resetBoundary,
    resetCollisions,
    resetFluids,
    resetBehavior,
    resetSensors,
    resetJoints,
    spawnParticles,
    playEngine,
  ]);

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
            <Canvas className="canvas" isPlaying={isPlaying} />
            <Overlay isPlaying={isPlaying} />
            <Homepage onPlay={handlePlay} isVisible={!barsVisible} />
            <MaxParticlesLabel />
            <GyroscopeDebugLabel gyroData={gyroData} />
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
