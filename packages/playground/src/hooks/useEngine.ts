import { useContext } from "react";
import { EngineContext, EngineContextType } from "../contexts/EngineContext";

export function useEngine(): EngineContextType {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error("useEngine must be used within an EngineProvider");
  }

  return context;
}
