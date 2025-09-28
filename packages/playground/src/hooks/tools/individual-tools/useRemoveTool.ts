import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { useAppDispatch } from "../../useAppDispatch";
import { removeParticlesThunk } from "../../../slices/engine";
import { ToolHandlers, ToolRenderFunction } from "../types";

export function useRemoveTool(isActive: boolean) {
  const dispatch = useAppDispatch();
  const { screenToWorld, zoom } = useEngine();
  
  // Track mouse position and drag state
  const mousePosition = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  
  // Fixed screen radius for removal circle (25px)
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

      // Draw dashed white circle at mouse position
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.arc(mousePosition.current.x, mousePosition.current.y, SCREEN_RADIUS, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
    },
    [isActive, SCREEN_RADIUS]
  );

  // Remove particles at current mouse position
  const removeParticlesAtPosition = useCallback(() => {
    if (!isActive || !screenToWorld) return;

    // Get world coordinates of current mouse position
    const worldCenter = screenToWorld(mousePosition.current.x, mousePosition.current.y);
    
    // Calculate world radius based on current zoom
    const worldRadius = SCREEN_RADIUS / zoom;

    // Dispatch remove particles thunk
    dispatch(removeParticlesThunk({
      center: worldCenter,
      radius: worldRadius
    }));
  }, [isActive, screenToWorld, zoom, dispatch, SCREEN_RADIUS]);

  const handleMouseDown = useCallback((_e: MouseEvent) => {
    if (!isActive) return;
    
    isDragging.current = true;
    removeParticlesAtPosition();
  }, [isActive, removeParticlesAtPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Always update mouse position
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    mousePosition.current.x = e.clientX - rect.left;
    mousePosition.current.y = e.clientY - rect.top;

    // If dragging, continuously remove particles
    if (isDragging.current) {
      removeParticlesAtPosition();
    }
  }, [removeParticlesAtPosition]);

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