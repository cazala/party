import { useCallback, useState } from "react";

export type ToolMode =
  | "cursor"
  | "spawn"
  | "remove"
  | "joint"
  | "grab"
  | "pin"
  | "emitter";

export interface UseToolsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  addParticle?: (particle: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    size: number;
    mass: number;
    color: { r: number; g: number; b: number; a: number };
  }) => void;
  screenToWorld?: (sx: number, sy: number) => { x: number; y: number };
  isInitialized: boolean;
  initialMode?: ToolMode;
}

export interface UseToolsReturn {
  // Tool mode management
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
  isEmitterMode: boolean;
  // Mouse event handlers
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  handleContextMenu: (e: MouseEvent) => void;
}

export function useTools({
  canvasRef,
  addParticle,
  screenToWorld,
  isInitialized,
  initialMode = "cursor",
}: UseToolsProps): UseToolsReturn {
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
  const handleSpawnTool = useCallback(
    (e: MouseEvent) => {
      if (!canvasRef.current || !addParticle || !screenToWorld) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);

      // Default spawn parameters
      const size = 5;
      const mass = 1;
      const color = { r: 255, g: 255, b: 255, a: 255 };

      addParticle({
        position: { x, y },
        velocity: { x: 0, y: 0 },
        size,
        mass,
        color,
      });
    },
    [canvasRef, addParticle, screenToWorld]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized) return;

      switch (toolMode) {
        case "spawn":
          handleSpawnTool(e);
          break;
        case "remove":
          // TODO: Implement remove tool
          break;
        case "joint":
          // TODO: Implement joint tool
          break;
        case "grab":
          // TODO: Implement grab tool
          break;
        case "pin":
          // TODO: Implement pin tool
          break;
        case "emitter":
          // TODO: Implement emitter tool
          break;
        case "cursor":
        default:
          // No tool-specific action for cursor mode
          break;
      }
    },
    [toolMode, isInitialized, handleSpawnTool]
  );

  const handleMouseMove = useCallback(
    (_e: MouseEvent) => {
      if (!isInitialized) return;

      switch (toolMode) {
        case "grab":
          // TODO: Handle grab tool mouse move
          break;
        case "joint":
          // TODO: Handle joint tool mouse move (preview)
          break;
        default:
          // Most tools don't need mouse move handling
          break;
      }
    },
    [toolMode, isInitialized]
  );

  const handleMouseUp = useCallback(
    (_e: MouseEvent) => {
      if (!isInitialized) return;

      switch (toolMode) {
        case "grab":
          // TODO: Handle grab tool mouse up
          break;
        case "joint":
          // TODO: Handle joint tool mouse up
          break;
        default:
          // Most tools don't need mouse up handling
          break;
      }
    },
    [toolMode, isInitialized]
  );

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    // Tool mode management
    toolMode,
    setToolMode,
    toggleToolMode,
    isSpawnMode: toolMode === "spawn",
    isRemoveMode: toolMode === "remove",
    isJointMode: toolMode === "joint",
    isGrabMode: toolMode === "grab",
    isPinMode: toolMode === "pin",
    isEmitterMode: toolMode === "emitter",
    // Mouse event handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}