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
  const { setGravityStrength } = useEnvironment();
  const { setEnabled, setDecay } = useTrails();
  const { quickLoadSessionData } = useSession();
  const { setStrength, setRadius, setActive, setPosition, setMode } =
    useInteraction();
  const { setInvertColors } = useRender();

  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interactionInterval, setInteractionInterval] = useState<number | null>(null);

  useEffect(() => {
    if (!hasStarted && isInitialized && !isInitializing) {
      setHasStarted(true);
      setBarsVisibility(false);

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
        setZoom(0.2);
        setCamera({ x: 0, y: 0 });
        setEnabled(true);
        setDecay(10);
        setConstrainIterations(1);
        setCellSize(16);
        setMaxNeighbors(100);
        setInvertColors(true);
      } else {
        setGravityStrength(1000);
      }
    }
  }, [
    hasStarted,
    isInitialized,
    isInitializing,
    isWebGPU,
    setBarsVisibility,
    setGravityStrength,
    spawnParticles,
    setZoom,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setEnabled,
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
      const demos = [demo1SessionData, demo2SessionData, demo3SessionData, demo4SessionData] as SessionData[];
      const transition: SessionData = transitionSessionData as SessionData;

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
          setEnabled(false);
        } else {
          setEnabled(true);
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

  return {
    hasStarted,
    isPlaying,
    play,
    stop,
  };
}
