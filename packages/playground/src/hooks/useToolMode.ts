import { useState, useCallback } from "react";

export type ToolMode =
  | "cursor"
  | "spawn"
  | "remove"
  | "joint"
  | "grab"
  | "pin"
  | "emitter";

export interface UseToolModeReturn {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
  isEmitterMode: boolean;
}

export function useToolMode(
  initialMode: ToolMode = "cursor"
): UseToolModeReturn {
  const [toolMode, setToolMode] = useState<ToolMode>(initialMode);

  const toggleToolMode = useCallback(() => {
    setToolMode((current) => {
      if (current === "spawn") return "joint";
      if (current === "joint") return "grab";
      if (current === "grab") return "pin";
      if (current === "pin") return "remove";
      if (current === "remove") return "emitter";
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
    isEmitterMode: toolMode === "emitter",
  };
}
