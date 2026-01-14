import { useEffect } from "react";
import { useEngine } from "../hooks/useEngine";
import { useTools } from "../hooks/useTools";

// Export the canvas component that should be used in the app
export function Canvas({
  className,
  style,
  isPlaying = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  isPlaying?: boolean;
}) {
  const {
    canvasRef,
    canvasDimensions,
    runtime,
    handleWheel,
    isInitialized,
    isAutoMode,
  } = useEngine();
  const {
    isSpawnMode,
    isGrabMode,
    isGrabbing,
    isDrawMode,
    isBrushMode,
    isJointMode,
    isPinMode,
    isRemoveMode,
  } = useTools(isPlaying);

  // Add wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !handleWheel || !isInitialized) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      handleWheel(e.deltaY, centerX, centerY);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [handleWheel, isInitialized, runtime]);

  // Build CSS classes based on tool mode
  const canvasClasses = [
    className,
    isSpawnMode ? "spawn-tool" : "",
    isGrabMode ? "grab-tool" : "",
    isGrabbing ? "grabbing" : "",
    isDrawMode ? "draw-tool" : "",
    isBrushMode ? "brush-tool" : "",
    isJointMode ? "joint-tool" : "",
    isPinMode ? "pin-tool" : "",
    isRemoveMode ? "remove-tool" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Use canvas dimensions for both visual styling AND buffer size
  // This ensures consistent coordinate systems between visual and simulation space
  const canvasStyle = {
    ...style,
    width: "100%",
    height: "100%",
  };

  return (
    <canvas
      // IMPORTANT:
      // - A canvas can only have one context type. If we previously created a WebGPU context,
      //   switching to CPU (2D) on the same element will yield getContext("2d") === null.
      // - In auto mode we keep the canvas stable so detection doesn't blank the view.
      // - When user explicitly toggles runtime (auto mode off), remount the canvas so the new
      //   runtime can acquire its context.
      key={isAutoMode ? "auto" : runtime}
      ref={canvasRef}
      id="canvas"
      className={canvasClasses}
      style={canvasStyle}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
    />
  );
}
