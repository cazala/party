import { useEffect, useCallback, useState } from "react";
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
import { Homepage } from "./components/Homepage";
import { Stats } from "./components/Stats";
import { CpuGyroDemoController } from "./components/CpuGyroDemoController";
import { useUI } from "./hooks/useUI";
import { useRender } from "./hooks/useRender";
import { useDemo } from "./hooks/useDemo";
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
} from "./hooks/modules";
import { RESTART_AFFECTED_MODULES } from "./constants/modules";
import { store } from "./slices/store";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const { barsVisible, restoreBarsFromFullscreenMode, setBarsVisibility } = useUI();
  const { invertColors, setInvertColors } = useRender();
  const { hasStarted, isPlaying: isDemoPlaying, stop, play: playDemo } = useDemo();
  const { spawnParticles, play: playEngine } = useEngine();
  const { clearModuleOscillators } = useOscillators();
  const { setIsResetting } = useReset();
  // fix2 pattern: homepage vs playground is an explicit state, not derived from barsVisible
  const [isHomepage, setIsHomepage] = useState(true);

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


  const handlePlay = useCallback(() => {
    // Stop the demo
    stop();

    // Enter playground mode
    setIsHomepage(false);

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
    setIsHomepage,
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

  // Race condition fix: Auto-play is now handled in useDemo hook via canStart flag

  return (
    <div
      className={`app ${barsVisible && hasStarted ? "bars-visible" : "bars-hidden"
        }`}
    >
      <CpuGyroDemoController isHomepage={isHomepage} />
      <TopBar
        isDemoPlaying={isDemoPlaying}
        stopDemo={stop}
        playDemo={() => playDemo(false)}
      />
      <GlobalHotkeys />
      <div className="app-content">
        <SystemSidebar />
        <div className="playground">
          <Toolbar />
          <div
            className={`canvas-container ${invertColors ? "invert-colors" : ""
              }`}
          >
              <Canvas className="canvas" isPlaying={isDemoPlaying} />
              <Overlay isPlaying={isDemoPlaying} />
            <Homepage onPlay={handlePlay} isVisible={isHomepage} />
            <Stats isVisible={isHomepage} />
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
