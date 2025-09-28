import { useCallback } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function useRemoveTool(_isActive: boolean) {
  // TODO: Implement remove tool overlay rendering
  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // TODO: Render remove tool overlay (crosshair, selected particles, etc.)
  }, []);

  // TODO: Implement remove tool handlers
  const handlers: ToolHandlers = {
    onMouseDown: () => {
      // TODO: Handle remove tool mouse down (select particles to remove)
    },
    onMouseMove: () => {
      // TODO: Handle remove tool mouse move (highlight particles under cursor)
    },
    onMouseUp: () => {
      // TODO: Handle remove tool mouse up (remove selected particles)
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}