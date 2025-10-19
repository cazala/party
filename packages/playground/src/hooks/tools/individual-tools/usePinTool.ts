import { useCallback, useRef } from "react";
import type { IParticle as Particle } from "@cazala/party";
import { drawDashedCircle, drawDashedLine, drawDot } from "../shared";
import { useEngine } from "../../useEngine";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { ToolHandlers, ToolRenderFunction } from "../types";

// Module-level state to avoid multiple hook instance desync (pattern like draw tool)
type PinToolState = {
  mouseX: number;
  mouseY: number;
  isAdjustingSize: boolean;
  adjustStartX: number;
  adjustStartY: number;
  currentScreenRadius: number;
};
const pinToolState: PinToolState = {
  mouseX: 0,
  mouseY: 0,
  isAdjustingSize: false,
  adjustStartX: 0,
  adjustStartY: 0,
  currentScreenRadius: 25,
};

export function usePinTool(isActive: boolean) {
  const { engine, screenToWorld, zoom } = useEngine();
  const { executeCommand } = useHistory();

  // Drag state
  const isDragging = useRef(false);

  // Fixed screen radius for pin circle (25px)
  const SCREEN_RADIUS = 25;
  pinToolState.currentScreenRadius ||= SCREEN_RADIUS;

  // Gesture batching for undo/redo
  const gestureActiveRef = useRef(false);
  const unpinModeRef = useRef(false);
  const affectedIndicesRef = useRef<Set<number>>(new Set());
  const previousPinnedRef = useRef<Map<number, boolean>>(new Map());
  const commitInProgressRef = useRef(false);

  // Render dashed circle overlay
  const renderOverlay: ToolRenderFunction = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      _canvasSize: { width: number; height: number },
      mouse
    ) => {
      if (!isActive) return;

      const radius = pinToolState.currentScreenRadius;
      const currentX = mouse?.x ?? pinToolState.mouseX;
      const currentY = mouse?.y ?? pinToolState.mouseY;

      if (pinToolState.isAdjustingSize) {
        const startX = pinToolState.adjustStartX;
        const startY = pinToolState.adjustStartY;
        const mouseX = currentX;
        const mouseY = currentY;
        drawDashedCircle(
          ctx,
          { x: mouseX, y: mouseY },
          radius,
          "rgba(255,255,255,0.6)",
          2,
          [4, 4]
        );
        drawDashedLine(
          ctx,
          { x: startX, y: startY },
          { x: mouseX, y: mouseY },
          "rgba(255,255,255,0.8)",
          2,
          [6, 6]
        );
        drawDot(ctx, { x: mouseX, y: mouseY }, 4, "rgba(255,255,255,0.8)");
      } else {
        drawDashedCircle(
          ctx,
          { x: currentX, y: currentY },
          radius,
          "rgba(255,255,255,0.6)",
          2,
          [4, 4]
        );
      }
    },
    [isActive]
  );

  // Pin or unpin particles at current mouse position (unpin when shift pressed)
  const pinOrUnpinAtPosition = useCallback(
    async (unpin: boolean, screenX: number, screenY: number) => {
      if (!isActive || !screenToWorld) return;

      // Get world coordinates of current mouse position
      const worldCenter = screenToWorld(screenX, screenY);

      // Calculate world radius based on current zoom
      const worldRadius = pinToolState.currentScreenRadius / zoom;

      if (!engine) return;
      const particles = (await engine.getParticles()) as Particle[];
      const indexes: number[] = [];
      particles.forEach((p, idx) => {
        // Skip removed particles (mass == 0)
        if (p.mass === 0) return;
        const dx = p.position.x - worldCenter.x;
        const dy = p.position.y - worldCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > worldRadius) return;
        // If unpinning, only select pinned; if pinning, only select non-removed
        if (unpin) {
          if (p.mass < 0) indexes.push(idx);
        } else {
          if (p.mass > 0) indexes.push(idx);
        }
      });
      if (indexes.length === 0) return;

      // Record previous pin state lazily for undo
      for (const idx of indexes) {
        if (!previousPinnedRef.current.has(idx)) {
          previousPinnedRef.current.set(idx, particles[idx].mass < 0);
        }
        affectedIndicesRef.current.add(idx);
      }

      // Apply live effect
      if (unpin) await engine.unpinParticles(indexes);
      else await engine.pinParticles(indexes);
    },
    [isActive, screenToWorld, zoom, engine, SCREEN_RADIUS]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isActive) return;

      e.preventDefault();
      e.stopPropagation();

      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey);
      const unpin = !!e.shiftKey;

      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      pinToolState.mouseX = sx;
      pinToolState.mouseY = sy;

      if (ctrlOrMeta) {
        // Start size adjustment mode
        pinToolState.isAdjustingSize = true;
        pinToolState.adjustStartX = sx;
        pinToolState.adjustStartY = sy;
      } else {
        isDragging.current = true;
        gestureActiveRef.current = true;
        commitInProgressRef.current = false;
        unpinModeRef.current = unpin;
        pinOrUnpinAtPosition(unpin, sx, sy);
      }
    },
    [isActive, pinOrUnpinAtPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      e.preventDefault();
      e.stopPropagation();

      pinToolState.mouseX = sx;
      pinToolState.mouseY = sy;

      // Only allow adjust if started on mousedown with Ctrl/Cmd
      if (pinToolState.isAdjustingSize) {
        // Set radius to distance from start to current pointer (screen px)
        const dx = sx - pinToolState.adjustStartX;
        const dy = sy - pinToolState.adjustStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Match spawn tool behavior: radius grows slower than drag distance
        pinToolState.currentScreenRadius = Math.max(
          10,
          Math.min(distance / 2, 200)
        );
        return;
      }

      // If dragging, continuously pin/unpin
      if (isDragging.current) {
        const unpin = !!e.shiftKey;
        pinOrUnpinAtPosition(unpin, sx, sy);
      }
    },
    [pinOrUnpinAtPosition]
  );

  const handleMouseUp = useCallback(async () => {
    if (pinToolState.isAdjustingSize) {
      pinToolState.isAdjustingSize = false;
      return;
    }
    // Ended in mousemove via buttons; ensure flag false
    isDragging.current = false;

    // Commit batched command for undo/redo
    if (!gestureActiveRef.current) return;
    gestureActiveRef.current = false;

    const indices = Array.from(affectedIndicesRef.current.values());
    if (indices.length === 0) {
      // Reset tracking
      affectedIndicesRef.current.clear();
      previousPinnedRef.current.clear();
      return;
    }

    const unpin = unpinModeRef.current;
    const prevPinned = new Map(previousPinnedRef.current);

    if (commitInProgressRef.current) return;
    commitInProgressRef.current = true;

    const cmd: Command = {
      id: crypto.randomUUID(),
      label: unpin
        ? `Unpin ${indices.length} particles`
        : `Pin ${indices.length} particles`,
      timestamp: Date.now(),
      do: async (ctx) => {
        if (!ctx.engine) return;
        if (unpin) await ctx.engine.unpinParticles(indices);
        else await ctx.engine.pinParticles(indices);
      },
      undo: async (ctx) => {
        if (!ctx.engine) return;
        const toPin: number[] = [];
        const toUnpin: number[] = [];
        for (const idx of indices) {
          const wasPinned = prevPinned.get(idx) === true;
          if (wasPinned) toPin.push(idx);
          else toUnpin.push(idx);
        }
        if (toPin.length) await ctx.engine.pinParticles(toPin);
        if (toUnpin.length) await ctx.engine.unpinParticles(toUnpin);
      },
    };

    await executeCommand(cmd);

    // Reset tracking
    affectedIndicesRef.current.clear();
    previousPinnedRef.current.clear();
    commitInProgressRef.current = false;
  }, []);

  // Tool handlers
  const handlers: ToolHandlers = {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  };

  return {
    renderOverlay,
    handlers,
  };
}
