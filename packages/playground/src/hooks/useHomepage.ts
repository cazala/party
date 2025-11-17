import { useEffect, useState } from "react";
import { useUI } from "./useUI";
import { useEngine } from "./useEngine";
import { useEnvironment } from "./modules/useEnvironment";
import { useSession } from "./useSession";
import { SessionData } from "../types/session";
import medusaSessionData from "../sessions/medusa.json";
import { useInteraction, useTrails } from "./modules";

export function useHomepage() {
  const { setBarsVisibility } = useUI();
  const {
    isInitialized,
    isInitializing,
    isWebGPU,
    spawnParticles,
    setZoom,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
  } = useEngine();
  const { setGravityStrength } = useEnvironment();
  const { setEnabled, setDecay } = useTrails();
  const { quickLoadSessionData } = useSession();
  const { setStrength, setRadius, setActive, setPosition, setMode } =
    useInteraction();

  const [hasStarted, setHasStarted] = useState(false);
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
          velocityConfig: { speed: 0, direction: "random", angle: 0 },
          innerRadius: 50,
          squareSize: 200,
        });
        quickLoadSessionData(medusaSessionData as SessionData);
        setZoom(0.1);
        setEnabled(true);
        setDecay(10);
        setConstrainIterations(1);
        setCellSize(16);
        setMaxNeighbors(100);
        setInterval(() => {
          setActive(true);
          setStrength(20000);
          setRadius(1000);
          setPosition(0, 0);
          setMode("repel");
        }, 300);
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
    quickLoadSessionData,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    setEnabled,
    setDecay,
    setActive,
    setStrength,
    setRadius,
    setPosition,
    setMode,
  ]);

  return {
    hasStarted,
  };
}
