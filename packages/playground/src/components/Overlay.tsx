import { useEffect, useRef, useCallback } from "react";
import { useEngine } from "../hooks/useEngine";
import { useTools } from "../hooks/useTools";

export function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { size, canvasRef: mainCanvasRef, runtime } = useEngine();
  const {
    renderOverlay,
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,
    isSpawnMode,
  } = useTools();
  const animationFrameRef = useRef<number>();
  const isDragging = useRef(false);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render overlay content
    renderOverlay(ctx, { width: size.width, height: size.height });
  }, [renderOverlay, size]);

  // Setup canvas and start render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = size.width;
    const displayHeight = size.height;

    canvas.width = displayWidth * devicePixelRatio;
    canvas.height = displayHeight * devicePixelRatio;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Start render loop
    const renderLoop = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [size, render]);

  // Add mouse event listeners to the main canvas for overlay interaction
  useEffect(() => {
    const mainCanvas = mainCanvasRef?.current;
    if (!mainCanvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSpawnMode) return; // Only handle mouse events in spawn mode
      const rect = mainCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      updateMousePosition(mouseX, mouseY);

      // If we're dragging, also call updateDrag
      if (isDragging.current) {
        updateDrag(mouseX, mouseY, e.ctrlKey || e.metaKey);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isSpawnMode) return; // Only handle mouse events in spawn mode
      e.preventDefault(); // Prevent useTools from also handling this event
      const rect = mainCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      isDragging.current = true;
      startDrag(mouseX, mouseY, e.ctrlKey || e.metaKey);
    };

    const handleMouseUp = () => {
      if (!isSpawnMode) return; // Only handle mouse events in spawn mode
      isDragging.current = false;
      endDrag();
    };

    mainCanvas.addEventListener("mousemove", handleMouseMove);
    mainCanvas.addEventListener("mousedown", handleMouseDown);
    mainCanvas.addEventListener("mouseup", handleMouseUp);
    mainCanvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      mainCanvas.removeEventListener("mousemove", handleMouseMove);
      mainCanvas.removeEventListener("mousedown", handleMouseDown);
      mainCanvas.removeEventListener("mouseup", handleMouseUp);
      mainCanvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [
    mainCanvasRef,
    runtime,
    isSpawnMode,
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none", // Let mouse events pass through to main canvas
        zIndex: 10, // Above main canvas
      }}
    />
  );
}
