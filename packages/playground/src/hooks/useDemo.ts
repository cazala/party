import { useCallback, useEffect, useRef, useState } from "react";
import { useUI } from "./useUI";
import { useEngine } from "./useEngine";
import { useInit } from "./useInit";
import { useEnvironment } from "./modules/useEnvironment";
import { useSession } from "./useSession";
import { SessionData } from "../types/session";
import { SpawnParticlesConfig } from "../slices/engine";
import demo1SessionData from "../sessions/demo1.json";
import demo2SessionData from "../sessions/demo2.json";
import demo3SessionData from "../sessions/demo3.json";
import demo4SessionData from "../sessions/demo4.json";
import demo5SessionData from "../sessions/demo5.json";
import demo6SessionData from "../sessions/demo6.json";
import demo7SessionData from "../sessions/demo7.json";
import { useInteraction, useTrails, useBoundary, useCollisions, useFluids, useBehavior, useSensors, useJoints } from "./modules";
import { useRender } from "./useRender";
import { useOscillators } from "./useOscillators";
import { useReset } from "../contexts/ResetContext";
import { RESTART_AFFECTED_MODULES } from "../constants/modules";
import { isMobileDevice, calculateMaxParticles } from "../utils/deviceCapabilities";

const HOMEPAGE_INTERACTION = { strength: 100_000, radius: isMobileDevice() ? 700 : 800, mode: "repel" as const };

interface DemoSequenceItem {
  sessionData: SessionData;
  duration: number; // Demo duration in ms
  maxParticles: number; // Target maxParticles for this demo
  transitionDuration: number; // Interpolation duration in ms
}

export function useDemo() {
  const { setBarsVisibility } = useUI();
  const {
    isInitialized,
    isInitializing,
    isWebGPU,
    spawnParticles,
    setZoom,
    setCamera,
    camera,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setMaxParticles,
    maxParticles: currentMaxParticles,
    engine: engineInstance,
    interaction: engineInteraction,
  } = useEngine();
  const { initState } = useInit();
  const { reset: resetEnvironment } = useEnvironment();
  const { setEnabled: setTrailsEnabled, setDecay } = useTrails();
  const { quickLoadSessionData } = useSession();
  const { setStrength, setRadius, setActive, setPosition, setMode, setEnabled: setInteractionEnabled, isEnabled: isInteractionEnabled } =
    useInteraction();
  const { setInvertColors } = useRender();
  const { clearModuleOscillators } = useOscillators();
  const { setIsResetting } = useReset();
  const { reset: resetBoundary } = useBoundary();
  const { reset: resetCollisions } = useCollisions();
  const { reset: resetFluids } = useFluids();
  const { reset: resetBehavior } = useBehavior();
  const { reset: resetSensors } = useSensors();
  const { reset: resetJoints } = useJoints();

  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [deviceMaxParticles, setDeviceMaxParticles] = useState<number>(0); // Device capability (from calculateMaxParticles)
  const [demoParticleCount, setDemoParticleCount] = useState(0); // 2x deviceMaxParticles for homepage demo
  const currentSpawnConfigRef = useRef<SpawnParticlesConfig | null>(null);
  const [targetMaxParticles, setTargetMaxParticles] = useState<number | null>(null);
  const [targetTransitionDuration, setTargetTransitionDuration] = useState<number>(300);
  const interpolationAnimationFrameRef = useRef<number | null>(null);
  const currentMaxParticlesRef = useRef<number | null>(null);
  const prevIsWebGPURef = useRef<boolean>(isWebGPU);
  const startupAbortRef = useRef<AbortController | null>(null);
  const startupStateRef = useRef<"idle" | "starting" | "running">("idle");
  const interactionTickCountRef = useRef(0);
  const interactionIntervalRef = useRef<number | null>(null);
  const demoTimeoutRef = useRef<number | null>(null);

  // The engine can be re-created (strict mode, runtime toggle, hot reload, etc.).
  // Any setInterval callback that closes over engine/module references can keep writing to the OLD engine.
  // Keep "live refs" so the interval always targets the latest engine/module.
  const engineInstanceRef = useRef(engineInstance);
  const engineInteractionRef = useRef(engineInteraction);
  const cameraRef = useRef(camera);
  const isInteractionEnabledRef = useRef(isInteractionEnabled);
  const setInteractionEnabledRef = useRef(setInteractionEnabled);
  const setModeRef = useRef(setMode);
  const setStrengthRef = useRef(setStrength);
  const setRadiusRef = useRef(setRadius);
  const setPositionRef = useRef(setPosition);
  const setActiveRef = useRef(setActive);

  useEffect(() => {
    engineInstanceRef.current = engineInstance;
  }, [engineInstance]);
  useEffect(() => {
    engineInteractionRef.current = engineInteraction;
  }, [engineInteraction]);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    isInteractionEnabledRef.current = isInteractionEnabled;
    setInteractionEnabledRef.current = setInteractionEnabled;
  }, [isInteractionEnabled, setInteractionEnabled]);
  useEffect(() => {
    setModeRef.current = setMode;
    setStrengthRef.current = setStrength;
    setRadiusRef.current = setRadius;
    setPositionRef.current = setPosition;
    setActiveRef.current = setActive;
  }, [setMode, setStrength, setRadius, setPosition, setActive]);

  // Ensure we don't keep intervals/timeouts alive across unmounts.
  useEffect(() => {
    return () => {
      if (interactionIntervalRef.current !== null) {
        try {
          clearInterval(interactionIntervalRef.current);
        } catch {
          // ignore
        }
        interactionIntervalRef.current = null;
      }
      if (demoTimeoutRef.current !== null) {
        try {
          clearTimeout(demoTimeoutRef.current);
        } catch {
          // ignore
        }
        demoTimeoutRef.current = null;
      }
    };
  }, []);

  // Calculate device capabilities on mount
  useEffect(() => {
    if (deviceMaxParticles === 0) {
      calculateMaxParticles().then((maxParticles) => {
        setDeviceMaxParticles(maxParticles);
        setDemoParticleCount(maxParticles); // Homepage demo uses 2x device capability
      });
    }
  }, [deviceMaxParticles]);

  const abortStartup = useCallback((reason: string) => {
    if (startupAbortRef.current) {
      startupAbortRef.current.abort(reason);
      startupAbortRef.current = null;
    }
  }, []);

  const ensureHomepageInteractionRunning = useCallback(() => {
    // Ensure module isn't disabled by a loaded session.
    if (!isInteractionEnabledRef.current) {
      setInteractionEnabledRef.current(true);
    }

    const getCameraCenter = () => {
      try {
        return engineInstanceRef.current?.getCamera() ?? cameraRef.current;
      } catch {
        return cameraRef.current;
      }
    };

    const applyOnce = () => {
      const center = getCameraCenter();
      const ei = engineInteractionRef.current;
      if (ei) {
        if (!ei.isEnabled()) ei.setEnabled(true);
        ei.setMode(HOMEPAGE_INTERACTION.mode);
        ei.setStrength(HOMEPAGE_INTERACTION.strength);
        ei.setRadius(HOMEPAGE_INTERACTION.radius);
        ei.setPosition(center.x, center.y);
        ei.setActive(true);
      } else {
        setModeRef.current(HOMEPAGE_INTERACTION.mode);
        setStrengthRef.current(HOMEPAGE_INTERACTION.strength);
        setRadiusRef.current(HOMEPAGE_INTERACTION.radius);
        setPositionRef.current(center.x, center.y);
        setActiveRef.current(true);
      }
    };

    applyOnce();

    // Ensure an interval is running to keep it pinned to camera center.
    if (interactionIntervalRef.current === null) {
      interactionTickCountRef.current = 0;
      const intervalId = window.setInterval(() => {
        interactionTickCountRef.current += 1;
        const center = getCameraCenter();

        const ei = engineInteractionRef.current;
        if (ei) {
          if (!ei.isEnabled()) ei.setEnabled(true);
          ei.setMode(HOMEPAGE_INTERACTION.mode);
          ei.setStrength(HOMEPAGE_INTERACTION.strength);
          ei.setRadius(HOMEPAGE_INTERACTION.radius);
          ei.setPosition(center.x, center.y);
          ei.setActive(true);
        } else {
          setModeRef.current(HOMEPAGE_INTERACTION.mode);
          setStrengthRef.current(HOMEPAGE_INTERACTION.strength);
          setRadiusRef.current(HOMEPAGE_INTERACTION.radius);
          setPositionRef.current(center.x, center.y);
          setActiveRef.current(true);
        }
      }, 16);
      interactionIntervalRef.current = intervalId;
    }
  }, []);

  // Extract demo start logic to separate callback, but make it async so we can add sleeps & frames.
  const startDemo = useCallback(async (signal: AbortSignal) => {
    if (signal.aborted) return;
    const nextFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // IMPORTANT ordering:
    // - perf constraints first (so the big spawn doesn't lock the sim)
    // - camera/zoom next (so spawning uses the intended view/bounds)
    // - spawn particles last
    const zoom = isMobileDevice() ? 0.2 : 0.3;
    setConstrainIterations(1);
    setCellSize(16);
    setMaxNeighbors(100);
    await nextFrame();
    await nextFrame();
    await nextFrame();
    if (signal.aborted) return;

    setZoom(zoom);
    await nextFrame();
    if (signal.aborted) return;

    setCamera({ x: 0, y: 0 });
    await nextFrame();
    if (signal.aborted) return;

    // Start homepage interaction ASAP (right after view is configured), so it doesn't "kick in late".
    ensureHomepageInteractionRunning();
    await nextFrame();

    // Calculate maxParticles for homepage demo based on device capabilities
    const spawnConfig = {
      numParticles: demoParticleCount,
      shape: "circle" as const,
      particleSize: 3,
      spacing: 0,
      radius: isMobileDevice() ? 600 : 500,
      colors: ["#ffffff"],
      velocityConfig: { speed: 100, direction: "random" as const, angle: 0 },
      innerRadius: 50,
      squareSize: 200,
    };
    currentSpawnConfigRef.current = spawnConfig;

    spawnParticles(spawnConfig);
    await nextFrame();
    if (signal.aborted) return;

    setTrailsEnabled(true);
    setDecay(10);
    await nextFrame();
  }, [
    demoParticleCount,
    spawnParticles,
    setZoom,
    setCamera,
    setTrailsEnabled,
    setDecay,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
  ]);

  const play = useCallback(
    (useInteraction: boolean = true) => {
      // Prevent multiple simultaneous play calls.
      if (!isWebGPU || !isInitialized || isInitializing || isPlaying) return;

      setIsPlaying(true);
      if (!hasStarted) setHasStarted(true);

      if (useInteraction) {
        ensureHomepageInteractionRunning();
      }
    },
    [
      ensureHomepageInteractionRunning,
      hasStarted,
      isInitialized,
      isInitializing,
      isPlaying,
      isWebGPU,
    ]
  );

  useEffect(() => {
    // NOTE: Homepage vs playground is handled by App-level state (see App.tsx isHomepage).
    // This effect should run once when the app boots and the engine becomes ready.
    if (startupStateRef.current !== "idle") return;

    const shouldAutostart =
      !hasStarted &&
      !isPlaying &&
      isInitialized &&
      !isInitializing &&
      demoParticleCount > 0 &&
      isWebGPU;

    if (!shouldAutostart) return;

    // Fire a single “transactional” startup: either we start demo fully, or we don't start at all.
    // This avoids partial states where sessions rotate but the homepage spawn/zoom/interval didn't happen.
    startupStateRef.current = "starting";
    abortStartup("restarting autostart");
    const abortController = new AbortController();
    startupAbortRef.current = abortController;

    (async () => {
      // Latch immediately to prevent re-entrant autostarts on state changes during startup.
      startupStateRef.current = "starting";

      // UI setup
      setBarsVisibility(false);
      setInvertColors(true);
      // Mandatory: yield at least one frame for layout/engine refs to settle.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (abortController.signal.aborted) return;

      // Mark started only when we are actually about to spawn/setup.
      setHasStarted(true);

      // Make sure any previous intervals/timeouts are cleared before starting.
      if (interactionIntervalRef.current !== null) {
        clearInterval(interactionIntervalRef.current);
        interactionIntervalRef.current = null;
      }
      if (demoTimeoutRef.current !== null) {
        clearTimeout(demoTimeoutRef.current);
        demoTimeoutRef.current = null;
      }

      await startDemo(abortController.signal);
      if (abortController.signal.aborted) return;

      // Start demo automation LAST (session rotation + optional “center interaction”)
      // so we never run rotations without having spawned the initial particles.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      play(true);

      startupStateRef.current = "running";
    })().catch((err) => {
      // If something goes wrong during startup, allow a future attempt to retry.
      startupStateRef.current = "idle";
      // eslint-disable-next-line no-console
      console.warn("[useDemo] autostart failed", err);
    });
  }, [
    abortStartup,
    demoParticleCount,
    hasStarted,
    isInitialized,
    isInitializing,
    isPlaying,
    isWebGPU,
    play,
    setBarsVisibility,
    setInvertColors,
    startDemo,
  ]);

  // Ensure any pending startup is cancelled on unmount.
  useEffect(() => {
    return () => abortStartup("useDemo unmount");
  }, [abortStartup]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    abortStartup("stop()");
    startupStateRef.current = "idle";

    // Clear the interaction interval
    if (interactionIntervalRef.current !== null) {
      clearInterval(interactionIntervalRef.current);
      interactionIntervalRef.current = null;
    }
    // Clear any scheduled demo rotation timeout
    if (demoTimeoutRef.current !== null) {
      clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
    // Cancel any pending maxParticles interpolation animation
    if (interpolationAnimationFrameRef.current !== null) {
      cancelAnimationFrame(interpolationAnimationFrameRef.current);
      interpolationAnimationFrameRef.current = null;
    }
    // Reset transition targets so nothing keeps animating after stop
    setTargetMaxParticles(null);

    // Deactivate interaction
    setActive(false);
    setStrength(10000);

    // Reset engine settings
    setZoom(1);
    // Restore the normal playground maxParticles (100k). Demos adjust this dynamically.
    setMaxParticles(100000);
    setTrailsEnabled(false);
    setInvertColors(false);
    setConstrainIterations(50);
    setCellSize(16);
    setMaxNeighbors(1000);
    setCamera({ x: 0, y: 0 });

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

    // Respawn particles with current init module values
    spawnParticles(initState);
  }, [
    setActive,
    setStrength,
    setZoom,
    setMaxParticles,
    setTrailsEnabled,
    setInvertColors,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setCamera,
    setTargetMaxParticles,
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
    initState,
    abortStartup,
    isPlaying,
  ]);

  // Runtime toggle safety:
  // If WebGPU runtime changes (webgpu <-> cpu), stop demo automation so it doesn't
  // unexpectedly resume 30s later and overwrite the user's playground settings.
  useEffect(() => {
    const prev = prevIsWebGPURef.current;
    if (prev === isWebGPU) return;

    // Only stop if anything demo-related is active. This preserves normal behavior on initial mount.
    if (
      isPlaying ||
      interactionIntervalRef.current !== null ||
      demoTimeoutRef.current !== null
    ) {
      stop();
    }

    prevIsWebGPURef.current = isWebGPU;
  }, [isWebGPU, isPlaying, stop]);

  // Rotate demos with transitions at random intervals between 20-30 seconds
  useEffect(() => {
    // Demo sequence runs whenever demo is playing (homepage auto-demo OR Demo button).
    // It is explicitly stopped on runtime toggles via the isWebGPU watcher above.
    if (!isWebGPU || !isInitialized || isInitializing || !isPlaying) return;

    if (isMobileDevice()) {
      demo3SessionData.modules.environment.gravityStrength = 1000;
    }

    // Wait for device capabilities to be calculated
    if (deviceMaxParticles === 0) {
      return;
    }

    // Calculate particle counts based on device capabilities
    const highPerformanceMaxParticles = deviceMaxParticles; // For less demanding demos
    const lowPerformanceMaxParticles = deviceMaxParticles / 4 | 0; // For more demanding demos (Demo1, Demo5, Demo2)
    const veryLowPerformanceMaxParticles = deviceMaxParticles / 6 | 0; // For very demanding demos (Demo6)
    const mediumPerformanceMaxParticles = deviceMaxParticles / 2.5 | 0;

    const sequence: DemoSequenceItem[] = [
      {
        sessionData: demo3SessionData as SessionData,
        duration: isMobileDevice() ? 12000 : 15000,
        maxParticles: highPerformanceMaxParticles,
        transitionDuration: 5000, // 5s for increasing particles
      },
      {
        sessionData: demo1SessionData as SessionData,
        duration: isMobileDevice() ? 12000 : 15000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0, // 300ms for decreasing particles
      },
      {
        sessionData: demo4SessionData as SessionData,
        duration: 15000,
        maxParticles: highPerformanceMaxParticles,
        transitionDuration: 5000,
      },
      {
        sessionData: demo5SessionData as SessionData,
        duration: 15000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo6SessionData as SessionData,
        duration: 15000,
        maxParticles: veryLowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo7SessionData as SessionData,
        duration: 20000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo2SessionData as SessionData,
        duration: 20000,
        maxParticles: isMobileDevice() ? veryLowPerformanceMaxParticles : mediumPerformanceMaxParticles,
        transitionDuration: 2500,
      },
      
    ];

    let currentIndex = 0;

    // Set initial maxParticles for first demo
    const initialItem = sequence[0];
    if (initialItem) {
      setTargetMaxParticles(initialItem.maxParticles);
      setTargetTransitionDuration(initialItem.transitionDuration);
    }

    void quickLoadSessionData(initialItem?.sessionData);

    const scheduleNext = () => {
      const currentItem = sequence[currentIndex];
      if (!currentItem) return;

      // Clear any existing timeout before creating a new one
      if (demoTimeoutRef.current !== null) {
        clearTimeout(demoTimeoutRef.current);
        demoTimeoutRef.current = null;
      }

      demoTimeoutRef.current = window.setTimeout(() => {
        currentIndex++;

        // If we've completed the sequence, restart
        if (currentIndex >= sequence.length) {
          currentIndex = 0;
        }

        const nextItem = sequence[currentIndex];
        if (!nextItem) return;

        const sessionData = nextItem.sessionData;
        if (sessionData?.name === "Demo5" || sessionData?.name === "Demo6") {
          setTrailsEnabled(false);
        } else {
          setTrailsEnabled(true);
        }

        // Set target maxParticles and transition duration
        setTargetMaxParticles(nextItem.maxParticles);
        setTargetTransitionDuration(nextItem.transitionDuration);

        void quickLoadSessionData(sessionData);

        scheduleNext();
      }, currentItem.duration);
    };

    scheduleNext();

    return () => {
      if (demoTimeoutRef.current !== null) {
        clearTimeout(demoTimeoutRef.current);
        demoTimeoutRef.current = null;
      }
    };
  }, [isWebGPU, isInitialized, isInitializing, isPlaying, quickLoadSessionData, setTrailsEnabled, deviceMaxParticles]);

  // Update ref when currentMaxParticles changes (for interpolation start value)
  useEffect(() => {
    currentMaxParticlesRef.current = currentMaxParticles;
  }, [currentMaxParticles]);

  // Interpolate maxParticles smoothly when target changes
  useEffect(() => {
    if (targetMaxParticles === null) {
      return;
    }

    // Cancel any existing animation
    if (interpolationAnimationFrameRef.current !== null) {
      cancelAnimationFrame(interpolationAnimationFrameRef.current);
      interpolationAnimationFrameRef.current = null;
    }

    // If transition duration is 0, set immediately without animation
    if (targetTransitionDuration === 0) {
      setMaxParticles(targetMaxParticles);
      setTargetMaxParticles(null);
      return;
    }

    const startValue = currentMaxParticlesRef.current ?? deviceMaxParticles * 2;
    const target = targetMaxParticles;
    const startTime = performance.now();
    const duration = targetTransitionDuration;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // Clamp to 0-1

      // Use easeInOutCubic for smooth interpolation
      const easedProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentValue = Math.round(startValue + (target - startValue) * easedProgress);
      setMaxParticles(currentValue);

      if (progress < 1) {
        interpolationAnimationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Interpolation complete - ensure we end exactly at target
        setMaxParticles(target);
        setTargetMaxParticles(null);
        interpolationAnimationFrameRef.current = null;
      }
    };

    interpolationAnimationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (interpolationAnimationFrameRef.current !== null) {
        cancelAnimationFrame(interpolationAnimationFrameRef.current);
        interpolationAnimationFrameRef.current = null;
      }
    };
  }, [targetMaxParticles, targetTransitionDuration, deviceMaxParticles, setMaxParticles]);

  const reduceParticles = useCallback(() => {
    if (!currentSpawnConfigRef.current || !isWebGPU) return;

    const config = currentSpawnConfigRef.current;
    const newCount = Math.floor(config.numParticles / 2);

    if (newCount > 0) {
      const newConfig = {
        ...config,
        numParticles: newCount,
      };
      currentSpawnConfigRef.current = newConfig;
      spawnParticles(newConfig);
    }
  }, [isWebGPU, spawnParticles]);

  return {
    hasStarted,
    isPlaying,
    play,
    stop,
    reduceParticles,
  };
}

