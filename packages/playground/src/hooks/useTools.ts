import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import {
  setTool,
  toggleTool,
  resetTool,
  selectActiveTool,
  selectIsSpawnMode,
  selectIsRemoveMode,
  selectIsJointMode,
  selectIsGrabMode,
  selectIsPinMode,
  selectIsEmitterMode,
  selectIsCursorMode,
  ToolMode,
} from "../slices/tools";
import { useEngine } from "../hooks/useEngine";

export interface UseToolsReturn {
  // Tool mode management
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  resetToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
  isEmitterMode: boolean;
  isCursorMode: boolean;
}

export function useTools(): UseToolsReturn {
  const dispatch = useAppDispatch();
  const { canvasRef, addParticle, screenToWorld, isInitialized, interaction } =
    useEngine();

  // Redux selectors
  const toolMode = useAppSelector(selectActiveTool);
  const isSpawnMode = useAppSelector(selectIsSpawnMode);
  const isRemoveMode = useAppSelector(selectIsRemoveMode);
  const isJointMode = useAppSelector(selectIsJointMode);
  const isGrabMode = useAppSelector(selectIsGrabMode);
  const isPinMode = useAppSelector(selectIsPinMode);
  const isEmitterMode = useAppSelector(selectIsEmitterMode);
  const isCursorMode = useAppSelector(selectIsCursorMode);

  // Redux action dispatchers
  const setToolMode = useCallback(
    (mode: ToolMode) => {
      dispatch(setTool(mode));
    },
    [dispatch]
  );

  const toggleToolMode = useCallback(() => {
    dispatch(toggleTool());
  }, [dispatch]);

  const resetToolMode = useCallback(() => {
    dispatch(resetTool());
  }, [dispatch]);
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
      const color = { r: 1, g: 1, b: 1, a: 1 }; // White color (normalized 0-1)

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

  // Wire mouse input to Interaction module and Tools
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interaction || !isInitialized) return;

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      interaction.setPosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
      handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);

      // Handle tools first - if a tool handles the event, don't activate interaction
      handleMouseDown(e);

      // Only activate interaction for cursor mode (when no tool is active)
      if (toolMode === "cursor") {
        interaction.setActive(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      handleMouseUp(e);
      interaction.setActive(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      handleContextMenu(e);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [
    canvasRef.current,
    interaction,
    isInitialized,
    toolMode,
    screenToWorld,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  ]);

  return {
    // Tool mode management
    toolMode,
    setToolMode,
    toggleToolMode,
    resetToolMode,
    isSpawnMode,
    isRemoveMode,
    isJointMode,
    isGrabMode,
    isPinMode,
    isEmitterMode,
    isCursorMode,
  };
}
