import { useState, useCallback } from "react";

export type ToolMode = "spawn" | "remove" | "joint" | "grab" | "pin";

export interface UseToolModeReturn {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
}

export function useToolMode(
  initialMode: ToolMode = "spawn"
): UseToolModeReturn {
  const [toolMode, setToolMode] = useState<ToolMode>(initialMode);

  const toggleToolMode = useCallback(() => {
    setToolMode((current) => {
      if (current === "spawn") return "remove";
      if (current === "remove") return "joint";
      if (current === "joint") return "grab";
      if (current === "grab") return "pin";
      return "spawn";
    });
  }, []);

  return {
    toolMode,
    setToolMode,
    toggleToolMode,
    isSpawnMode: toolMode === "spawn",
    isRemoveMode: toolMode === "remove",
    isJointMode: toolMode === "joint",
    isGrabMode: toolMode === "grab",
    isPinMode: toolMode === "pin",
  };
}
