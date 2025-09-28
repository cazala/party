import { useCallback } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function useJointTool(_isActive: boolean) {
  // TODO: Implement joint tool overlay rendering
  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // TODO: Render joint tool overlay (connection preview, selected particles, etc.)
  }, []);

  // TODO: Implement joint tool handlers
  const handlers: ToolHandlers = {
    onMouseDown: () => {
      // TODO: Handle joint tool mouse down (select first particle)
    },
    onMouseMove: () => {
      // TODO: Handle joint tool mouse move (preview joint connection)
    },
    onMouseUp: () => {
      // TODO: Handle joint tool mouse up (create joint between particles)
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}