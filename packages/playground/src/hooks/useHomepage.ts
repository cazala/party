import { useCallback, useEffect, useState } from "react";
import { useUI } from "./useUI";
import { useEngine } from "./useEngine";
import { useEnvironment } from "./modules/useEnvironment";
import { useSession } from "./useSession";
import { SessionData } from "../types/session";
import transitionSessionData from "../sessions/demo1.json";
import demo1SessionData from "../sessions/demo2.json";
import demo2SessionData from "../sessions/demo3.json";
import demo3SessionData from "../sessions/demo4.json";
import demo4SessionData from "../sessions/demo5.json";
import { useInteraction, useTrails } from "./modules";
import { useRender } from "./useRender";
import { isMobileDevice } from "../utils/deviceCapabilities";

export function useHomepage() {
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
  } = useEngine();
  const { setGravityStrength, setMode: setGravityMode, setCustomAngleDegrees } = useEnvironment();
  const { setEnabled: setTrailsEnabled, setDecay } = useTrails();
  const { quickLoadSessionData } = useSession();
  const { setStrength, setRadius, setActive, setPosition, setMode } =
    useInteraction();
  const { setInvertColors } = useRender();

  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactionInterval, setInteractionInterval] = useState<number | null>(null);
  const [gyroData, setGyroData] = useState<{ beta: number; gamma: number; angle: number } | null>({ beta: 0, gamma: 0, angle: 90 });

  useEffect(() => {
    if (!hasStarted && isInitialized && !isInitializing) {
      setHasStarted(true);
      setBarsVisibility(false);
      setInvertColors(true);
      if (isWebGPU) {
        spawnParticles({
          numParticles: 40000,
          shape: "random",
          spacing: 20,
          particleSize: 3,
          radius: 100,
          colors: ["#ffffff"],
          velocityConfig: { speed: 100, direction: "random", angle: 0 },
          innerRadius: 50,
          squareSize: 200,
        });
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
  ]);

  const play = useCallback(() => {
    if (!hasStarted || !isWebGPU) return;

    setIsPlaying(true);

    // Start with a random demo
    const demos = [demo1SessionData, demo2SessionData, demo3SessionData];
    const randomDemo = demos[Math.floor(Math.random() * demos.length)] as SessionData;
    quickLoadSessionData(randomDemo);

    // Start the interaction interval
    const intervalId = window.setInterval(() => {
      setActive(true);
      setStrength(100000);
      setRadius(700);
      setPosition(0, 0);
      setMode("repel");
      setCamera({ x: 0, y: 0 });
    }, 16);
    setInteractionInterval(intervalId);
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
  }, [interactionInterval, setActive]);

  // Rotate demos with transitions at random intervals between 20-30 seconds
  useEffect(() => {
    if (!hasStarted || !isWebGPU || !isPlaying) return;

    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const createDemoSequence = () => {
      const transition: SessionData = transitionSessionData as SessionData;
      if (isMobileDevice()) {
        return [demo2SessionData, transition, demo1SessionData, transition, demo3SessionData,  demo4SessionData] as SessionData[];
      }
      const demos = [demo1SessionData, demo2SessionData, demo3SessionData, demo4SessionData] as SessionData[];

      const shuffledDemos = shuffleArray(demos);
      // Interleave demos with transitions: demo → transition → demo → transition → demo
      const sequence: SessionData[] = [];
      shuffledDemos.forEach((demo, index) => {
        sequence.push(demo as SessionData);
        if (index < shuffledDemos.length - 1) {
          sequence.push(transition);
        }
      });
      return [...sequence, transition];
    };

    const getRandomDelay = () => Math.random() * (30000 - 10000) + 10000; // 10-30 seconds

    let timeoutId: number;
    let currentSequence = createDemoSequence();
    let currentIndex = 0; // Start at 0 to begin the sequence

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        currentIndex++;

        // If we've completed the sequence, create a new one
        if (currentIndex >= currentSequence.length) {
          currentSequence = createDemoSequence();
          currentIndex = 0;
        }

        const sessionData = currentSequence[currentIndex];
        if (sessionData.name === "Demo5") {
          setTrailsEnabled(false);
        } else {
          setTrailsEnabled(true);
        }

        quickLoadSessionData(sessionData);

        scheduleNext();
      }, getRandomDelay());
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasStarted, isWebGPU, isPlaying, quickLoadSessionData]);

  // Gyroscope/device orientation handler for CPU mode
  useEffect(() => {
    // Early return for WebGPU mode - but still return a cleanup function
    if (!hasStarted || isWebGPU) {
      return () => {}; // Return empty cleanup to maintain hook consistency
    }

    // Check if HTTPS is required (device orientation requires secure context)
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
    if (!isSecureContext) {
      console.warn('[Gyroscope] Device orientation requires HTTPS or localhost');
      setGyroData({ beta: 0, gamma: 0, angle: 90 });
      return () => {}; // Return empty cleanup to maintain hook consistency
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

  return {
    hasStarted,
    isPlaying,
    play,
    stop,
    gyroData, // Export for debug label
  };
}
