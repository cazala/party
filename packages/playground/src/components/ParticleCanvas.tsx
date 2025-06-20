import { useRef, useEffect } from "react";
import { ParticleSystemControls, Vector2D } from "../../../core/src/index";

interface ParticleCanvasProps {
  controls: ParticleSystemControls;
}

export default function ParticleCanvas({ controls }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    controls.setCanvas(canvas);

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [controls]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const position = new Vector2D(x, y);

    if (e.shiftKey) {
      controls.spawnBurst(position, 10, 100);
    } else {
      controls.addParticleAt(position);
    }
  };

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      title="Click to spawn particle, Shift+Click for burst"
    >
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} />
    </div>
  );
}
