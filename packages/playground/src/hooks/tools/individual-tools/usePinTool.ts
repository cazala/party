import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { usePin } from "../../modules";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function usePinTool(isActive: boolean) {
  const { screenToWorld, zoom } = useEngine();
  const { pinParticles } = usePin();
  
  // Track mouse position
  const mousePosition = useRef({ x: 0, y: 0 });
  
  // Fixed screen radius for pin circle (25px)
  const SCREEN_RADIUS = 25;

  // Manage cursor visibility
  useEffect(() => {
    if (isActive) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    
    return () => {
      document.body.style.cursor = '';
    };
  }, [isActive]);

  // Render dashed circle overlay
  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx: CanvasRenderingContext2D, _canvasSize: { width: number; height: number }) => {
      if (!isActive) return;

      // Draw dashed yellow circle at mouse position
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(mousePosition.current.x, mousePosition.current.y, SCREEN_RADIUS, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
    },
    [isActive, SCREEN_RADIUS]
  );

  // Pin particles at current mouse position
  const pinParticlesAtPosition = useCallback(() => {
    if (!isActive || !screenToWorld) return;

    // Get world coordinates of current mouse position
    const worldCenter = screenToWorld(mousePosition.current.x, mousePosition.current.y);
    
    // Calculate world radius based on current zoom
    const worldRadius = SCREEN_RADIUS / zoom;

    // Call pin particles function
    pinParticles({
      center: worldCenter,
      radius: worldRadius
    });
  }, [isActive, screenToWorld, zoom, pinParticles, SCREEN_RADIUS]);

  const handleMouseDown = useCallback((_e: MouseEvent) => {
    if (!isActive) return;
    
    pinParticlesAtPosition();
  }, [isActive, pinParticlesAtPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Always update mouse position
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mousePosition.current.x = e.clientX - rect.left;
    mousePosition.current.y = e.clientY - rect.top;
  }, []);

  const handleMouseUp = useCallback(() => {
    // Pin tool only pins on click, not continuous like remove
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