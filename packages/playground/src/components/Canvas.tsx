import { useEffect } from "react";
import { useEngine } from "../hooks/useEngine";

// Export the canvas component that should be used in the app
export function Canvas({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { canvasRef, size, runtime, handleWheel, isInitialized } = useEngine();

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

  return (
    <canvas
      key={runtime} // Force canvas recreation when engine type changes
      ref={canvasRef}
      id="canvas"
      className={className}
      style={style}
      width={size.width}
      height={size.height}
    />
  );
}
