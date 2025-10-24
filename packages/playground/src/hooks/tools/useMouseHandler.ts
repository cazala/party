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
  toolHandlers,
}: MouseHandlerProps) {
  const { canvasRef } = useEngine();
  const handlerId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

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
    const canvas = canvasRef.current as
      | (HTMLCanvasElement & { dataset?: DOMStringMap })
      | null;
    if (!canvas || !isInitialized) return;

    // Deduplicate: only one instance attaches listeners to the canvas at a time
    const ownerKey = "partyMouseHandlerOwner";
    const ds = canvas.dataset ?? (canvas.dataset = {} as any);
    if (ds[ownerKey]) {
      // Another instance already attached; skip attaching listeners
      return;
    }
    ds[ownerKey] = handlerId;

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
      // Only the owner should remove listeners
      if (canvas.dataset && canvas.dataset[ownerKey] === handlerId) {
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseUp);
        canvas.removeEventListener("contextmenu", onContextMenu);
        delete canvas.dataset[ownerKey];
      }
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
