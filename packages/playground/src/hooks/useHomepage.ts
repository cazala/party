import { useEffect, useState } from "react";
import { useUI } from "./useUI";
import { useEngine } from "./useEngine";
import { useEnvironment } from "./modules/useEnvironment";

export function useHomepage() {
  const { setBarsVisibility } = useUI();
  const { isInitialized, isInitializing, isWebGPU } = useEngine();
  const { setGravityStrength, setCustomAngleDegrees } = useEnvironment();

  const [hasStarted, setHasStarted] = useState(false);
  useEffect(() => {
    if (!hasStarted && isInitialized && !isInitializing) {
      setHasStarted(true);
      setBarsVisibility(false);

      if (isWebGPU) {
        setGravityStrength(0);
      } else {
        setGravityStrength(1000);
        setCustomAngleDegrees(180);
      }
    }
  }, [
    hasStarted,
    isInitialized,
    isInitializing,
    isWebGPU,
    setBarsVisibility,
    setGravityStrength,
    setCustomAngleDegrees,
  ]);

  return {
    hasStarted,
  };
}
