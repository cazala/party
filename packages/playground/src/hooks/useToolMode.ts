import { useState, useCallback } from "react";

export type ToolMode = "spawn" | "remove";

export interface UseToolModeReturn {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
}

export function useToolMode(initialMode: ToolMode = "spawn"): UseToolModeReturn {
  const [toolMode, setToolMode] = useState<ToolMode>(initialMode);

  const toggleToolMode = useCallback(() => {
    setToolMode(current => current === "spawn" ? "remove" : "spawn");
  }, []);

  return {
    toolMode,
    setToolMode,
    toggleToolMode,
    isSpawnMode: toolMode === "spawn",
    isRemoveMode: toolMode === "remove",
  };
}