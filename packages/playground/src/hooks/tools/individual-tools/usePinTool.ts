import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function usePinTool(isActive: boolean) {
  const { engine, screenToWorld, zoom, canvasRef } = useEngine();

  // Drag state
  const isDragging = useRef(false);

  // Fixed screen radius for pin circle (25px)
  const SCREEN_RADIUS = 25;
  // Adjustable screen radius state and size-dragging control
  const screenRadiusRef = useRef(SCREEN_RADIUS);
  const isAdjustingSize = useRef(false);
  const adjustStart = useRef({ x: 0, y: 0 });

  // Manage cursor visibility (apply only to canvas to avoid global flicker)
  useEffect(() => {
    const canvas = canvasRef?.current as HTMLCanvasElement | null;
    if (!canvas) return;
    if (isActive) {
      canvas.style.cursor = "none";
    } else {
      canvas.style.cursor = "";
    }
    return () => {
      canvas.style.cursor = "";
    };
  }, [isActive, canvasRef]);

  // Render dashed circle overlay
  const renderOverlay: ToolRenderFunction = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      _canvasSize: { width: number; height: number },
      mouse
    ) => {
      if (!isActive) return;

      const radius = screenRadiusRef.current;
      const currentX = mouse?.x ?? 0;
      const currentY = mouse?.y ?? 0;

      if (isAdjustingSize.current) {
        const startX = adjustStart.current.x;
        const startY = adjustStart.current.y;
        const mouseX = currentX;
        const mouseY = currentY;

        // Circle centered at current mouse position (dashed)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dashed line from original mousedown to current mouse position
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tiny circle at cursor
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 4, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Draw dashed circle at current mouse position
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(currentX, currentY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
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
      const worldRadius = screenRadiusRef.current / zoom;

      if (!engine) return;
      const particles = await engine.getParticles();
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
      if (unpin) await engine.unpinParticles(indexes);
      else await engine.pinParticles(indexes);
    },
    [isActive, screenToWorld, zoom, engine, SCREEN_RADIUS]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isActive) return;

      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey);
      const unpin = !!e.shiftKey;

      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (ctrlOrMeta) {
        // Start size adjustment mode
        isAdjustingSize.current = true;
        adjustStart.current = { x: sx, y: sy };
      } else {
        isDragging.current = true;
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

      if (isAdjustingSize.current) {
        // Set radius to distance from start to current pointer (screen px)
        const dx = sx - adjustStart.current.x;
        const dy = sy - adjustStart.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Match spawn tool behavior: radius grows slower than drag distance
        screenRadiusRef.current = Math.max(10, Math.min(distance / 2, 200));
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

  const handleMouseUp = useCallback(() => {
    if (isAdjustingSize.current) {
      isAdjustingSize.current = false;
      return;
    }
    isDragging.current = false;
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
