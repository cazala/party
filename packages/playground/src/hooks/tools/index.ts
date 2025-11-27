import { useCallback } from "react";
import { useEngine } from "../useEngine";
import { useToolManager } from "./useToolManager";
import { useOverlay } from "./useOverlay";
import { useMouseHandler } from "./useMouseHandler";
import { UseToolsReturn, ToolHandlers } from "./types";

// Individual tool hooks
import { useSpawnTool } from "./individual-tools/useSpawnTool";
import { useInteractTool } from "./individual-tools/useInteractTool";
import { useRemoveTool } from "./individual-tools/useRemoveTool";
import { useJointTool } from "./individual-tools/useJointTool";
import { usePinTool } from "./individual-tools/usePinTool";
import { useGrabTool } from "./individual-tools/useGrabTool";
import { useDrawTool } from "./individual-tools/useDrawTool";
import { useShapeTool } from "./individual-tools/useShapeTool";

export function useTools(isHomepage: boolean = false): UseToolsReturn {
  const { isInitialized } = useEngine();
  const toolManager = useToolManager();
  const overlay = useOverlay();

  // Initialize all tool hooks
  const spawnTool = useSpawnTool(toolManager.isSpawnMode);
  const interactionTool = useInteractTool(toolManager.isInteractionMode, isHomepage);
  const removeTool = useRemoveTool(toolManager.isRemoveMode);
  const jointTool = useJointTool(toolManager.isJointMode);
  const pinTool = usePinTool(toolManager.isPinMode);
  const grabTool = useGrabTool(toolManager.isGrabMode);
  const drawTool = useDrawTool(toolManager.isDrawMode);
  const shapeTool = useShapeTool(toolManager.isShapeMode);

  // Create tool handlers map
  const toolHandlers: Record<string, ToolHandlers> = {
    interaction: interactionTool.handlers,
    spawn: spawnTool.handlers,
    remove: removeTool.handlers,
    joint: jointTool.handlers,
    pin: pinTool.handlers,
    grab: grabTool.handlers,
    draw: drawTool.handlers,
    shape: shapeTool.handlers,
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
      canvasSize: { width: number; height: number },
      isMouseOver: boolean,
      mouse?: { x: number; y: number }
    ) => {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      // Render grid first (background layer)
      overlay.renderGrid(ctx, canvasSize);

      // Render active tool overlay only when mouse is over canvas
      if (isMouseOver) {
        switch (toolManager.toolMode) {
          case "spawn":
            spawnTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "interaction":
            interactionTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "remove":
            removeTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "joint":
            jointTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "pin":
            pinTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "grab":
            grabTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "draw":
            drawTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          case "shape":
            shapeTool.renderOverlay(ctx, canvasSize, mouse);
            break;
          default:
            // No overlay for unknown tools
            break;
        }
      }
    },
    [
      overlay.renderGrid,
      toolManager.toolMode,
      spawnTool.renderOverlay,
      interactionTool.renderOverlay,
      removeTool.renderOverlay,
      jointTool.renderOverlay,
      pinTool.renderOverlay,
      grabTool.renderOverlay,
      drawTool.renderOverlay,
      shapeTool.renderOverlay,
    ]
  );

  // Remove per-tool mouse seeding; overlays use provided mouse param

  // No custom mouse event seeding needed when overlays rely on passed mouse

  // Remove spawn-specific mouse delegation from the public API

  return {
    // Tool mode management from toolManager
    ...toolManager,

    // Overlay functions - now tool-aware
    renderOverlay,

    // Grab tool specific state
    isGrabbing: grabTool.isGrabbing,
  };
}
