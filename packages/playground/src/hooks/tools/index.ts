import { useCallback, useEffect } from "react";
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

export function useTools(): UseToolsReturn {
  const { isInitialized, canvasRef } = useEngine();
  const toolManager = useToolManager();
  const overlay = useOverlay();

  // Initialize all tool hooks
  const spawnTool = useSpawnTool(toolManager.isSpawnMode);
  const interactionTool = useInteractTool(toolManager.isInteractionMode);
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

  // Also seed overlay position immediately on tool changes based on last known mouse
  useEffect(() => {
    const canvas = canvasRef?.current as HTMLCanvasElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx =
      typeof (window as any)._lastMouseX === "number"
        ? (window as any)._lastMouseX
        : rect.width / 2;
    const my =
      typeof (window as any)._lastMouseY === "number"
        ? (window as any)._lastMouseY
        : rect.height / 2;
    switch (toolManager.toolMode) {
      case "spawn":
        spawnTool.updateMousePosition(mx, my);
        break;
      case "remove":
        (removeTool as any).setMousePosition?.(mx, my);
        break;
      case "pin":
        (pinTool as any).setMousePosition?.(mx, my);
        break;
      case "draw":
        (drawTool as any).setMousePosition?.(mx, my);
        break;
      case "shape":
        (shapeTool as any).setMousePosition?.(mx, my);
        break;
      default:
        break;
    }
  }, [toolManager.toolMode, canvasRef, spawnTool.updateMousePosition]);

  // Seed overlay mouse coordinates immediately when tool changes (via custom event)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (!detail) return;
      switch (toolManager.toolMode) {
        case "spawn":
          spawnTool.updateMousePosition(detail.x, detail.y);
          break;
        case "remove":
          (removeTool as any).setMousePosition?.(detail.x, detail.y);
          break;
        case "pin":
          (pinTool as any).setMousePosition?.(detail.x, detail.y);
          break;
        case "draw":
          (drawTool as any).setMousePosition?.(detail.x, detail.y);
          break;
        case "shape":
          (shapeTool as any).setMousePosition?.(detail.x, detail.y);
          break;
        default:
          break;
      }
    };
    window.addEventListener(
      "party-overlay-update-mouse",
      handler as EventListener
    );
    return () =>
      window.removeEventListener(
        "party-overlay-update-mouse",
        handler as EventListener
      );
  }, [
    toolManager.toolMode,
    spawnTool.updateMousePosition,
    removeTool.renderOverlay,
    pinTool.renderOverlay,
    drawTool.renderOverlay,
    shapeTool.renderOverlay,
  ]);

  // Create tool-aware overlay functions that only delegate to spawn tool in spawn mode
  const updateMousePosition = useCallback(
    (mouseX: number, mouseY: number) => {
      if (toolManager.isSpawnMode) {
        spawnTool.updateMousePosition(mouseX, mouseY);
      }
    },
    [toolManager.isSpawnMode, spawnTool.updateMousePosition]
  );

  const startDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed?: boolean
    ) => {
      if (toolManager.isSpawnMode) {
        spawnTool.startDrag(mouseX, mouseY, ctrlPressed, shiftPressed);
      }
    },
    [toolManager.isSpawnMode, spawnTool.startDrag]
  );

  const updateDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed?: boolean
    ) => {
      if (toolManager.isSpawnMode) {
        spawnTool.updateDrag(mouseX, mouseY, ctrlPressed, shiftPressed);
      }
    },
    [toolManager.isSpawnMode, spawnTool.updateDrag]
  );

  const endDrag = useCallback(() => {
    if (toolManager.isSpawnMode) {
      spawnTool.endDrag();
    }
  }, [toolManager.isSpawnMode, spawnTool.endDrag]);

  return {
    // Tool mode management from toolManager
    ...toolManager,

    // Overlay functions - now tool-aware
    renderOverlay,
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,

    // Grab tool specific state
    isGrabbing: grabTool.isGrabbing,
  };
}
