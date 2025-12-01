import { useCallback, useEffect, useState, useRef } from "react";
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
import { useInteraction, useTrails, useBoundary, useCollisions, useFluids, useBehavior, useSensors, useJoints } from "./modules";
import { useRender } from "./useRender";
import { useOscillators } from "./useOscillators";
import { useReset } from "../contexts/ResetContext";
import { RESTART_AFFECTED_MODULES } from "../constants/modules";
import { isMobileDevice, calculateMaxParticles } from "../utils/deviceCapabilities";

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
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setMaxParticles,
    maxParticles: currentMaxParticles,
  } = useEngine();
  const { initState } = useInit();
  const { setGravityStrength, setMode: setGravityMode, setCustomAngleDegrees, reset: resetEnvironment } = useEnvironment();
  const { setEnabled: setTrailsEnabled, setDecay } = useTrails();
  const { quickLoadSessionData } = useSession();
  const { setStrength, setRadius, setActive, setPosition, setMode } =
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
  const [interactionInterval, setInteractionInterval] = useState<number | null>(null);
  const [gyroData, setGyroData] = useState<{ beta: number; gamma: number; angle: number } | null>({ beta: 0, gamma: 0, angle: 90 });
  const currentSpawnConfigRef = useRef<SpawnParticlesConfig | null>(null);
  const [targetMaxParticles, setTargetMaxParticles] = useState<number | null>(null);
  const [targetTransitionDuration, setTargetTransitionDuration] = useState<number>(300);
  const interpolationAnimationFrameRef = useRef<number | null>(null);
  const currentMaxParticlesRef = useRef<number | null>(null);

  // Calculate device capabilities on mount
  useEffect(() => {
    if (deviceMaxParticles === 0) {
      calculateMaxParticles().then((maxParticles) => {
        setDeviceMaxParticles(maxParticles);
        setDemoParticleCount(maxParticles); // Homepage demo uses 2x device capability
      });
    }
  }, [deviceMaxParticles]);

  useEffect(() => {
    if (!hasStarted && isInitialized && !isInitializing) {
      if (demoParticleCount > 0) {
        setHasStarted(true);
        setBarsVisibility(false);
        setInvertColors(true);
        if (isWebGPU) {
          // Calculate maxParticles for homepage demo based on device capabilities
          const spawnConfig = {
            numParticles: demoParticleCount,
            shape: isMobileDevice() ? "random" as const : "circle" as const,
            particleSize: 3,
            spacing: 0,
            radius: 500,
            colors: ["#ffffff"],
            velocityConfig: { speed: 100, direction: "random" as const, angle: 0 },
            innerRadius: 50,
            squareSize: 200,
          };
          currentSpawnConfigRef.current = spawnConfig;
          spawnParticles(spawnConfig);
          setZoom(isMobileDevice() ? 0.2 : 0.3);
          setCamera({ x: 0, y: 0 });
          setTrailsEnabled(true);
          setDecay(10);
          setConstrainIterations(1);
          setCellSize(16);
          setMaxNeighbors(100);
        } else {
          setGravityStrength(1000);
          setGravityMode("custom");
          setCustomAngleDegrees(90);
        }
      }
    }
  }, [
    hasStarted,
    isInitialized,
    isInitializing,
    isWebGPU,
    setBarsVisibility,
    setGravityStrength,
    setGravityMode,
    setCustomAngleDegrees,
    spawnParticles,
    setZoom,
    setCamera,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setTrailsEnabled,
    setDecay,
    setInvertColors,
    demoParticleCount,
  ]);

  const play = useCallback((useInteraction: boolean = true) => {
    if (!hasStarted || !isWebGPU) return;

    setIsPlaying(true);

    // Only start the interaction interval if useInteraction is true (homepage demo)
    if (useInteraction) {
      const intervalId = window.setInterval(() => {
        setActive(true);
        setStrength(100000);
        setRadius(700);
        setPosition(0, 0);
        setMode("repel");
        setCamera({ x: 0, y: 0 });
      }, 16);
      setInteractionInterval(intervalId);
    }
  }, [hasStarted, isWebGPU, quickLoadSessionData, setActive, setStrength, setRadius, setPosition, setMode, setCamera]);

  const stop = useCallback(() => {
    setIsPlaying(false);

    // Clear the interaction interval
    if (interactionInterval !== null) {
      clearInterval(interactionInterval);
      setInteractionInterval(null);
    }

    // Deactivate interaction
    setActive(false);
    setStrength(10000);

    // Reset engine settings
    setZoom(1);
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
    interactionInterval,
    setActive,
    setStrength,
    setZoom,
    setTrailsEnabled,
    setInvertColors,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setCamera,
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
  ]);

  // Rotate demos with transitions at random intervals between 20-30 seconds
  useEffect(() => {
    if (!hasStarted || !isWebGPU || !isPlaying) return;

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

    let timeoutId: number;
    const sequence: DemoSequenceItem[] = [
      {
        sessionData: demo3SessionData as SessionData,
        duration: isMobileDevice() ? 12000 : 15000,
        maxParticles: highPerformanceMaxParticles,
        transitionDuration: 5000, // 5s for increasing particles
      },
      {
        sessionData: demo1SessionData as SessionData,
        duration: 15000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0, // 300ms for decreasing particles
      },
      {
        sessionData: demo4SessionData as SessionData,
        duration: 30000,
        maxParticles: highPerformanceMaxParticles,
        transitionDuration: 5000,
      },
      {
        sessionData: demo1SessionData as SessionData,
        duration: 10000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo5SessionData as SessionData,
        duration: 20000,
        maxParticles: lowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo6SessionData as SessionData,
        duration: 20000,
        maxParticles: veryLowPerformanceMaxParticles,
        transitionDuration: 0,
      },
      {
        sessionData: demo2SessionData as SessionData,
        duration: 25000,
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

      timeoutId = setTimeout(() => {
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
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasStarted, isWebGPU, isPlaying, quickLoadSessionData, setTrailsEnabled, deviceMaxParticles]);

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

  // Gyroscope/device orientation handler for CPU mode
  useEffect(() => {
    // Early return for WebGPU mode - but still return a cleanup function
    if (!hasStarted || isWebGPU) {
      return () => { }; // Return empty cleanup to maintain hook consistency
    }

    // Check if HTTPS is required (device orientation requires secure context)
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
    if (!isSecureContext) {
      console.warn('[Gyroscope] Device orientation requires HTTPS or localhost');
      setGyroData({ beta: 0, gamma: 0, angle: 90 });
      return () => { }; // Return empty cleanup to maintain hook consistency
    }

    let hasReceivedEvent = false;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (!hasReceivedEvent) {
        hasReceivedEvent = true;
        console.log('[Gyroscope] First event received', event);
      }

      // event.beta: front-to-back tilt (-180 to 180, 0 when upright)
      // event.gamma: left-to-right tilt (-90 to 90, 0 when upright)
      // We want to convert this to a gravity angle where:
      // - 90° = down (phone upright)
      // - Tilting changes the angle accordingly

      // Check if values are actually available (some devices may not provide them)
      if (event.beta === null && event.gamma === null) {
        // Values are null, but don't return - keep trying
        console.warn('[Gyroscope] Beta and gamma are null - device may not support orientation or needs user interaction');
        setGyroData({ beta: 0, gamma: 0, angle: 90 });
        return;
      }

      const beta = event.beta ?? 0; // Front-to-back tilt (-180 to 180, 0 when upright)
      const gamma = event.gamma ?? 0; // Left-to-right tilt (-90 to 90, 0 when upright)

      // Log first few events to debug
      if (!hasReceivedEvent) {
        console.log('[Gyroscope] First event values:', { beta, gamma, rawBeta: event.beta, rawGamma: event.gamma });
      }

      // Convert device orientation to gravity angle
      // Angle system: 0° = right, 90° = down, 180° = left, 270° = up
      // When device is upright (beta=0, gamma=0): angle should be 90° (down)

      // Get screen orientation to adjust for device rotation
      let orientationOffset = 0;
      if (window.orientation !== undefined) {
        // window.orientation: 0 = portrait, 90 = landscape right, -90 = landscape left, 180 = portrait upside down
        orientationOffset = window.orientation;
      } else if (screen.orientation && screen.orientation.angle !== undefined) {
        // screen.orientation.angle: 0 = portrait, 90 = landscape, 180 = portrait upside down, 270 = landscape
        orientationOffset = screen.orientation.angle;
      }

      // Calculate gravity angle from device tilt
      // beta: front-to-back tilt (positive = forward, negative = backward)
      // gamma: left-to-right tilt (positive = right, negative = left)

      // Gravity should point in the direction the device is tilted
      // Use atan2 to get the angle from beta and gamma
      let angleDeg = 90; // Default to down (90°)

      if (Math.abs(beta) > 1 || Math.abs(gamma) > 1) {
        // Device is tilted, calculate angle from tilt
        // atan2(gamma, beta) gives angle in standard math coordinates:
        // - beta=90, gamma=0 → 0° (forward/right)
        // - beta=-90, gamma=0 → 180° (backward/left)
        // - beta=0, gamma=90 → 90° (right/up)
        // - beta=0, gamma=-90 → -90° (left/down)

        const tiltAngleRad = Math.atan2(gamma, beta);
        let tiltAngleDeg = (tiltAngleRad * 180) / Math.PI;

        // Convert from standard math coordinates to our system
        // Standard: 0°=right, 90°=up, 180°=left, 270°=down
        // Ours: 0°=right, 90°=down, 180°=left, 270°=up
        // We need to flip vertically: ourAngle = (90 - standardAngle) % 360
        angleDeg = ((90 - tiltAngleDeg + 360) % 360);

        // Adjust for screen orientation
        // When device is rotated, we need to rotate the gravity angle accordingly
        // orientationOffset tells us how much the screen is rotated
        // We subtract it to compensate (negative because screen rotation is opposite to gravity rotation)
        angleDeg = ((angleDeg - orientationOffset + 360) % 360);
      } else {
        // Device is upright, gravity points down (90°) relative to screen
        // Adjust for screen orientation
        angleDeg = ((90 - orientationOffset + 360) % 360);
      }

      // Update debug data
      setGyroData({ beta, gamma, angle: angleDeg });

      // Update gravity angle
      setCustomAngleDegrees(angleDeg);
    };

    let timeoutId: number | null = null;
    let listenerAdded = false;

    // Check if device orientation is supported
    if (typeof DeviceOrientationEvent !== 'undefined') {
      console.log('[Gyroscope] Device orientation API available');
      console.log('[Gyroscope] Secure context:', isSecureContext);
      console.log('[Gyroscope] Protocol:', location.protocol);
      console.log('[Gyroscope] Hostname:', location.hostname);

      // Request permission on iOS 13+
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('[Gyroscope] Requesting permission (iOS 13+)');
        (DeviceOrientationEvent as any)
          .requestPermission()
          .then((response: string) => {
            console.log('[Gyroscope] Permission response:', response);
            if (response === 'granted') {
              console.log('[Gyroscope] Permission granted, adding listener');
              window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
              listenerAdded = true;
            } else {
              console.warn('[Gyroscope] Permission denied - user needs to grant permission');
              console.warn('[Gyroscope] On iOS: Settings > Safari > Motion & Orientation Access');
              setGyroData({ beta: 0, gamma: 0, angle: 90 });
            }
          })
          .catch((error: any) => {
            console.warn('[Gyroscope] Permission request failed:', error);
            setGyroData({ beta: 0, gamma: 0, angle: 90 });
          });
      } else {
        // Non-iOS or older iOS, add listener directly
        console.log('[Gyroscope] Adding listener directly (non-iOS or older iOS)');
        window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
        listenerAdded = true;

        // Set a timeout to check if we're receiving events
        timeoutId = window.setTimeout(() => {
          if (!hasReceivedEvent) {
            console.warn('[Gyroscope] No events received after 2 seconds');
            console.warn('[Gyroscope] Possible issues:');
            console.warn('  1. User interaction required (try tapping the screen)');
            console.warn('  2. Permission not granted (iOS: Settings > Safari > Motion & Orientation)');
            console.warn('  3. HTTPS required (must be https:// or localhost)');
            console.warn('[Gyroscope] Try clicking "Request Permission" button in the debug label');
          }
        }, 2000);
      }
    } else {
      console.warn('[Gyroscope] Device orientation not supported');
      console.warn('[Gyroscope] DeviceOrientationEvent is undefined');
      setGyroData({ beta: 0, gamma: 0, angle: 90 });
    }

    // Always return a cleanup function
    return () => {
      if (listenerAdded) {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasStarted, isWebGPU, setCustomAngleDegrees]);

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
    gyroData, // Export for debug label
    reduceParticles,
  };
}

