import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { Provider } from "react-redux";
import { EngineProvider } from "./contexts/EngineContext";
import { ResetProvider } from "./contexts/ResetContext";
import {
  ShareableSessionUrlProvider,
} from "./contexts/ShareableSessionUrlContext";
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
import { InAppBrowserBlocker } from "./components/InAppBrowserBlocker";
import { useUI } from "./hooks/useUI";
import { useRender } from "./hooks/useRender";
import { useDemo } from "./hooks/useDemo";
import { useEngine } from "./hooks/useEngine";
import { useOscillators } from "./hooks/useOscillators";
import { useReset } from "./contexts/ResetContext";
import { useAppDispatch } from "./hooks/useAppDispatch";
import { useAppSelector } from "./hooks/useAppSelector";
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
import { setTool } from "./slices/tools";
import { isMobileDevice } from "./utils/deviceCapabilities";
import { buildShareableSessionData } from "./utils/shareableSession";
import {
  buildPlayPath,
  buildPlaySessionPath,
  parseCurrentPlayRoute,
} from "./utils/playUrl";
import { openedWithSharedSessionUrl } from "./utils/urlSharedSession";

import "./styles/index.css";
import "./App.css";

function AppContent() {
  const openedWithSessionUrl = useMemo(() => openedWithSharedSessionUrl(), []);

  const dispatch = useAppDispatch();
  const { barsVisible, restoreBarsFromFullscreenMode, setBarsVisibility } = useUI();
  const { invertColors } = useRender();
  const { hasStarted, isPlaying: isDemoPlaying, stop, play: playDemo, reduceParticles } =
    useDemo({ canAutostart: !openedWithSessionUrl });
  const {
    spawnParticles,
    play: playEngine,
    getCount,
  } = useEngine();
  const { clearModuleOscillators } = useOscillators();
  const { isResetting, setIsResetting } = useReset();
  // fix2 pattern: homepage vs playground is an explicit state, not derived from barsVisible
  const [isHomepage, setIsHomepage] = useState(() => !openedWithSessionUrl);
  const [isWebGPUWarningDismissed, setIsWebGPUWarningDismissed] = useState(false);

  // Persisted session slices (the only ones that should drive share URL regeneration)
  const modules = useAppSelector((s) => s.modules);
  const init = useAppSelector((s) => s.init);
  const engineState = useAppSelector((s) => s.engine);
  const render = useAppSelector((s) => (s as any).render);
  const oscillators = useAppSelector((s) => s.oscillators);

  const particleCount = getCount();

  const shareSessionJson = useMemo(() => {
    const state = {
      // Only the slices used by buildShareableSessionData are required here.
      modules,
      init,
      engine: engineState,
      render,
      oscillators,
    } as any;

    const sessionData = buildShareableSessionData({
      state,
      particleCount,
    });

    return JSON.stringify(sessionData);
  }, [
    modules,
    init,
    engineState,
    render,
    oscillators,
    particleCount,
  ]);

  const shareBaselineJsonRef = useRef<string | null>(null);
  const hasStartedSharingRef = useRef<boolean>(openedWithSessionUrl);
  const pendingBaselineAfterResetRef = useRef<boolean>(false);
  const sawResettingRef = useRef<boolean>(false);

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

  // Normalize unknown paths into "/play" (replace semantics).
  useEffect(() => {
    const route = parseCurrentPlayRoute();
    if (route.kind === "other") {
      window.history.replaceState(null, "", buildPlayPath());
      setIsHomepage(true);
    }
  }, []);

  // Shared-session URL entry is handled *once* during the first InitControls spawn.
  // Here we only ensure UI mode is correct and demo doesn't run.
  useEffect(() => {
    if (!openedWithSessionUrl) return;
    setIsHomepage(false);
    if (isMobileDevice()) {
      setBarsVisibility(false);
      dispatch(setTool("interaction"));
    } else {
      setBarsVisibility(true);
    }
  }, [openedWithSessionUrl, setIsHomepage, setBarsVisibility, dispatch]);

  // After any "reset-to-/play" request, wait for resetting to complete, then
  // establish a new baseline so the URL stays at "/play" until the next change.
  useEffect(() => {
    if (isResetting) {
      sawResettingRef.current = true;
      return;
    }
    if (!pendingBaselineAfterResetRef.current) return;
    if (!sawResettingRef.current) return;
    sawResettingRef.current = false;
    pendingBaselineAfterResetRef.current = false;
    shareBaselineJsonRef.current = shareSessionJson;
    hasStartedSharingRef.current = false;
  }, [isResetting, shareSessionJson]);

  // Regenerate /play/:session on persisted session changes (replace semantics).
  useEffect(() => {
    if (isHomepage) return;
    if (isResetting) return;

    // We only start sharing after we have a baseline (set on entering playground or after reset),
    // unless we were opened from a session URL.
    if (!hasStartedSharingRef.current && !shareBaselineJsonRef.current) return;

    const shouldStartSharing =
      !hasStartedSharingRef.current &&
      shareBaselineJsonRef.current !== null &&
      shareSessionJson !== shareBaselineJsonRef.current;

    if (!hasStartedSharingRef.current && !shouldStartSharing) return;
    if (shouldStartSharing) hasStartedSharingRef.current = true;

    const nextPath = buildPlaySessionPath(shareSessionJson);
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, [isHomepage, isResetting, shareSessionJson]);

  const resetUrlToPlay = useCallback(() => {
    // Replace URL immediately; baseline will be refreshed once reset completes.
    window.history.replaceState(null, "", buildPlayPath());
    pendingBaselineAfterResetRef.current = true;
    hasStartedSharingRef.current = false;
  }, []);

  const exitToHomepage = useCallback(() => {
    // Ensure we return to the same behavior as a fresh app load (homepage/demo autostart).
    window.location.replace(buildPlayPath());
  }, []);

  const handlePlay = useCallback(() => {
    // Stop the demo
    stop();

    // Enter playground mode
    setIsHomepage(false);

    // Show sidebars (enter playground mode)
    setBarsVisibility(true);

    // Ensure URL is the regular /play until the user makes a new change.
    resetUrlToPlay();

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
    resetUrlToPlay,
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
    <ShareableSessionUrlProvider value={{ resetUrlToPlay, exitToHomepage }}>
      <div
      className={`app ${
        barsVisible && (hasStarted || !isHomepage) ? "bars-visible" : "bars-hidden"
          }`}
      >
        <InAppBrowserBlocker />
        <CpuGyroDemoController
          isHomepage={isHomepage}
          isWebGPUWarningDismissed={isWebGPUWarningDismissed}
        />
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
              <Homepage
                onPlay={handlePlay}
                isVisible={isHomepage}
                isWebGPUWarningDismissed={isWebGPUWarningDismissed}
                onDismissWebGPUWarning={() => setIsWebGPUWarningDismissed(true)}
              />
              <Stats
                isVisible={isHomepage}
                hasStarted={hasStarted}
                isPlaying={isDemoPlaying}
                reduceParticles={reduceParticles}
              />
            </div>
          </div>
          <div className="right-sidebar">
            <ModulesSidebar />
          </div>
        </div>
      </div>
    </ShareableSessionUrlProvider>
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
