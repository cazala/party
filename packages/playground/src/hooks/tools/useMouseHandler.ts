import { useCallback, useEffect } from "react";
import { useEngine } from "../useEngine";
import { ToolMode } from "../../slices/tools";
import { ToolHandlers } from "./types";

interface MouseHandlerProps {
  toolMode: ToolMode;
  isInitialized: boolean;
  toolHandlers: Record<ToolMode, ToolHandlers>;
}

export function useMouseHandler({ 
  toolMode, 
  isInitialized, 
  toolHandlers 
}: MouseHandlerProps) {
  const { canvasRef } = useEngine();

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseDown) {
        handlers.onMouseDown(e);
      }
    },
    [toolMode, isInitialized, canvasRef, toolHandlers]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseMove) {
        handlers.onMouseMove(e);
      }
    },
    [toolMode, isInitialized, canvasRef, toolHandlers]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isInitialized) return;

      const handlers = toolHandlers[toolMode];
      if (handlers?.onMouseUp) {
        handlers.onMouseUp(e);
      }
    },
    [toolMode, isInitialized, toolHandlers]
  );

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // Wire mouse input to tools (interaction module is handled by cursor tool)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInitialized) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      handleMouseDown(e);
    };

    const onMouseUp = (e: MouseEvent) => {
      handleMouseUp(e);
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
    isInitialized,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}