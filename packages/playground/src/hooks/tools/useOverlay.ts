import { useCallback } from "react";
import { useAppSelector } from "../useAppSelector";
import { selectShowGrid } from "../../slices/ui";
import { useEngine } from "../useEngine";

export function useOverlay() {
  const showGrid = useAppSelector(selectShowGrid);
  const { gridCellSize, screenToWorld } = useEngine();

  const renderGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasSize: { width: number; height: number }
    ) => {
      if (!showGrid || !screenToWorld) return;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      
      // Get world bounds for current viewport
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(canvasSize.width, canvasSize.height);
      
      // Calculate grid range to draw
      const startX = Math.floor(topLeft.x / gridCellSize) * gridCellSize;
      const endX = Math.ceil(bottomRight.x / gridCellSize) * gridCellSize;
      const startY = Math.floor(topLeft.y / gridCellSize) * gridCellSize;
      const endY = Math.ceil(bottomRight.y / gridCellSize) * gridCellSize;
      
      // Draw vertical lines
      for (let worldX = startX; worldX <= endX; worldX += gridCellSize) {
        // Convert world coordinate back to screen coordinate
        const screenX = (worldX - topLeft.x) / (bottomRight.x - topLeft.x) * canvasSize.width;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvasSize.height);
        ctx.stroke();
      }
      
      // Draw horizontal lines  
      for (let worldY = startY; worldY <= endY; worldY += gridCellSize) {
        // Convert world coordinate back to screen coordinate
        const screenY = (worldY - topLeft.y) / (bottomRight.y - topLeft.y) * canvasSize.height;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvasSize.width, screenY);
        ctx.stroke();
      }
    },
    [showGrid, gridCellSize, screenToWorld]
  );

  return {
    renderGrid,
    showGrid,
  };
}