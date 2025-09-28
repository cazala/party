import { useCallback } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function useGrabTool(_isActive: boolean) {
  // TODO: Implement grab tool overlay rendering
  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // TODO: Render grab tool overlay (selection area, grabbed particles, etc.)
  }, []);

  // TODO: Implement grab tool handlers
  const handlers: ToolHandlers = {
    onMouseDown: () => {
      // TODO: Handle grab tool mouse down (start selection or grab particles)
    },
    onMouseMove: () => {
      // TODO: Handle grab tool mouse move (update selection area or move grabbed particles)
    },
    onMouseUp: () => {
      // TODO: Handle grab tool mouse up (finish selection or release grabbed particles)
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}