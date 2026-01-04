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
  const { canvasRef, canvasDimensions, runtime, handleWheel, isInitialized } = useEngine();
  const {
    isSpawnMode,
    isGrabMode,
    isGrabbing,
    isDrawMode,
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
      key={runtime} // Force canvas recreation when engine type changes
      ref={canvasRef}
      id="canvas"
      className={canvasClasses}
      style={canvasStyle}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
    />
  );
}
