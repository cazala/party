import { useCallback } from "react";
import { useEngine } from "../useEngine";
import { useToolManager } from "./useToolManager";
import { useOverlay } from "./useOverlay";
import { useMouseHandler } from "./useMouseHandler";
import { UseToolsReturn, ToolHandlers } from "./types";

// Individual tool hooks
import { useSpawnTool } from "./individual-tools/useSpawnTool";
import { useCursorTool } from "./individual-tools/useCursorTool";
import { useRemoveTool } from "./individual-tools/useRemoveTool";
import { useJointTool } from "./individual-tools/useJointTool";
import { usePinTool } from "./individual-tools/usePinTool";
import { useGrabTool } from "./individual-tools/useGrabTool";
import { useEmitterTool } from "./individual-tools/useEmitterTool";

export function useTools(): UseToolsReturn {
  const { isInitialized } = useEngine();
  const toolManager = useToolManager();
  const overlay = useOverlay();

  // Initialize all tool hooks
  const spawnTool = useSpawnTool(toolManager.isSpawnMode);
  const cursorTool = useCursorTool(toolManager.isCursorMode);
  const removeTool = useRemoveTool(toolManager.isRemoveMode);
  const jointTool = useJointTool(toolManager.isJointMode);
  const pinTool = usePinTool(toolManager.isPinMode);
  const grabTool = useGrabTool(toolManager.isGrabMode);
  const emitterTool = useEmitterTool(toolManager.isEmitterMode);

  // Create tool handlers map
  const toolHandlers: Record<string, ToolHandlers> = {
    cursor: cursorTool.handlers,
    spawn: spawnTool.handlers,
    remove: removeTool.handlers,
    joint: jointTool.handlers,
    pin: pinTool.handlers,
    grab: grabTool.handlers,
    emitter: emitterTool.handlers,
  };

  // Initialize mouse handler with tool handlers
  useMouseHandler({
    toolMode: toolManager.toolMode,
    isInitialized,
    toolHandlers,
  });

  // Combined render overlay function
  const renderOverlay = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasSize: { width: number; height: number }
    ) => {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      // Render grid first (background layer)
      overlay.renderGrid(ctx, canvasSize);

      // Render active tool overlay
      switch (toolManager.toolMode) {
        case "spawn":
          spawnTool.renderOverlay(ctx, canvasSize);
          break;
        case "cursor":
          cursorTool.renderOverlay(ctx, canvasSize);
          break;
        case "remove":
          removeTool.renderOverlay(ctx, canvasSize);
          break;
        case "joint":
          jointTool.renderOverlay(ctx, canvasSize);
          break;
        case "pin":
          pinTool.renderOverlay(ctx, canvasSize);
          break;
        case "grab":
          grabTool.renderOverlay(ctx, canvasSize);
          break;
        case "emitter":
          emitterTool.renderOverlay(ctx, canvasSize);
          break;
        default:
          // No overlay for unknown tools
          break;
      }
    },
    [
      overlay.renderGrid,
      toolManager.toolMode,
      spawnTool.renderOverlay,
      cursorTool.renderOverlay,
      removeTool.renderOverlay,
      jointTool.renderOverlay,
      pinTool.renderOverlay,
      grabTool.renderOverlay,
      emitterTool.renderOverlay,
    ]
  );

  return {
    // Tool mode management from toolManager
    ...toolManager,

    // Overlay functions - delegate to spawn tool for now (maintains compatibility)
    renderOverlay,
    updateMousePosition: spawnTool.updateMousePosition,
    startDrag: spawnTool.startDrag,
    updateDrag: spawnTool.updateDrag,
    endDrag: spawnTool.endDrag,
  };
}