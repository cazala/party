import { useEffect, useRef, useCallback, useState } from "react";
import { useEngine } from "../hooks/useEngine";
import { useTools } from "../hooks/useTools";

export function Overlay({ isPlaying = false }: { isPlaying?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { size, canvasRef: mainCanvasRef, runtime } = useEngine();
  const { renderOverlay, isSpawnMode } = useTools(isPlaying);
  const animationFrameRef = useRef<number>();
  const isDragging = useRef(false);
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas first
    ctx.clearRect(0, 0, size.width, size.height);

    // Render grid always; tools decide based on isMouseOverCanvas
    renderOverlay(
      ctx,
      { width: size.width, height: size.height },
      isMouseOverCanvas,
      mouseRef.current
    );
  }, [renderOverlay, size, isMouseOverCanvas]);

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

    const handleMouseEnter = () => {
      setIsMouseOverCanvas(true);
    };

    const handleMouseLeave = () => {
      setIsMouseOverCanvas(false);
      isDragging.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mainCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      mouseRef.current = { x: mouseX, y: mouseY };
      // Tools read mouse via overlay render; no extra calls needed
    };

    // Pointer events are the authoritative stream during drags (pointer capture),
    // so keep overlay cursor position in sync using pointermove too.
    const handlePointerMove = (e: PointerEvent) => {
      const rect = mainCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      mouseRef.current = { x: mouseX, y: mouseY };
    };

    const handlePointerDown = (_e: PointerEvent) => {
      setIsMouseOverCanvas(true);
      isDragging.current = true;
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    const handlePointerLeave = () => {
      setIsMouseOverCanvas(false);
      isDragging.current = false;
    };

    // Allow external callers (GlobalHotkeys) to seed overlay mouse position on tool switch
    const handleExternalOverlayUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (!detail) return;
      mouseRef.current = { x: detail.x, y: detail.y };
    };

    const handleMouseDown = (_e: MouseEvent) => {
      // No spawn-specific drag from overlay; tools will handle from useMouseHandler
      isDragging.current = true;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    mainCanvas.addEventListener("mouseenter", handleMouseEnter);
    mainCanvas.addEventListener("mouseleave", handleMouseLeave);
    mainCanvas.addEventListener("mousemove", handleMouseMove);
    mainCanvas.addEventListener("mousedown", handleMouseDown);
    mainCanvas.addEventListener("mouseup", handleMouseUp);
    mainCanvas.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    mainCanvas.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    mainCanvas.addEventListener("pointerup", handlePointerUp, {
      passive: true,
    });
    mainCanvas.addEventListener("pointercancel", handlePointerUp, {
      passive: true,
    });
    mainCanvas.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    });
    window.addEventListener(
      "party-overlay-update-mouse",
      handleExternalOverlayUpdate as EventListener
    );

    return () => {
      mainCanvas.removeEventListener("mouseenter", handleMouseEnter);
      mainCanvas.removeEventListener("mouseleave", handleMouseLeave);
      mainCanvas.removeEventListener("mousemove", handleMouseMove);
      mainCanvas.removeEventListener("mousedown", handleMouseDown);
      mainCanvas.removeEventListener("mouseup", handleMouseUp);
      mainCanvas.removeEventListener("pointermove", handlePointerMove);
      mainCanvas.removeEventListener("pointerdown", handlePointerDown);
      mainCanvas.removeEventListener("pointerup", handlePointerUp);
      mainCanvas.removeEventListener("pointercancel", handlePointerUp);
      mainCanvas.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener(
        "party-overlay-update-mouse",
        handleExternalOverlayUpdate as EventListener
      );
    };
  }, [mainCanvasRef, runtime, isSpawnMode]);

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
