import { useCallback, useEffect } from "react";
import { useEngine } from "../../useEngine";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function useCursorTool(isActive: boolean) {
  const { canvasRef, interaction, screenToWorld, isInitialized } = useEngine();

  // Cursor tool doesn't need overlay rendering
  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // No overlay rendering for cursor tool
  }, []);

  // Handle interaction module when cursor tool is active
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    const canvas = canvasRef.current;
    if (!canvas || !interaction) return;

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      interaction.setPosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);
      interaction.setActive(true);
    };

    const onMouseUp = () => {
      interaction.setActive(false);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    };
  }, [isActive, isInitialized, canvasRef, interaction, screenToWorld]);

  // Cursor tool handlers - no-ops since interaction is handled above
  const handlers: ToolHandlers = {
    onMouseDown: () => {
      // Mouse handling is managed by the useEffect above
    },
    onMouseMove: () => {
      // Mouse handling is managed by the useEffect above
    },
    onMouseUp: () => {
      // Mouse handling is managed by the useEffect above
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}