import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function usePinTool(isActive: boolean) {
  const { engine, screenToWorld, zoom, canvasRef } = useEngine();

  // Track mouse position and drag state
  const mousePosition = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Fixed screen radius for pin circle (25px)
  const SCREEN_RADIUS = 25;

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
      _canvasSize: { width: number; height: number }
    ) => {
      if (!isActive) return;

      // Draw dashed yellow circle at mouse position
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(
        mousePosition.current.x,
        mousePosition.current.y,
        SCREEN_RADIUS,
        0,
        2 * Math.PI
      );
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
    },
    [isActive, SCREEN_RADIUS]
  );

  // Pin or unpin particles at current mouse position (unpin when ctrl/cmd pressed)
  const pinOrUnpinAtPosition = useCallback(
    async (unpin: boolean) => {
      if (!isActive || !screenToWorld) return;

      // Get world coordinates of current mouse position
      const worldCenter = screenToWorld(
        mousePosition.current.x,
        mousePosition.current.y
      );

      // Calculate world radius based on current zoom
      const worldRadius = SCREEN_RADIUS / zoom;

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
      isDragging.current = true;
      const unpin = !!(e.ctrlKey || e.metaKey);
      pinOrUnpinAtPosition(unpin);
    },
    [isActive, pinOrUnpinAtPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // Always update mouse position
      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      mousePosition.current.x = e.clientX - rect.left;
      mousePosition.current.y = e.clientY - rect.top;

      // If dragging, continuously pin/unpin
      if (isDragging.current) {
        const unpin = !!(e.ctrlKey || e.metaKey);
        pinOrUnpinAtPosition(unpin);
      }
    },
    [pinOrUnpinAtPosition]
  );

  const handleMouseUp = useCallback(() => {
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
