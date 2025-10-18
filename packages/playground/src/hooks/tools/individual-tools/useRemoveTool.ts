import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { ToolHandlers, ToolRenderFunction } from "../types";

// Module-level state to mirror draw tool pattern
type RemoveToolState = {
  mouseX: number;
  mouseY: number;
  isAdjustingSize: boolean;
  adjustStartX: number;
  adjustStartY: number;
  currentScreenRadius: number;
};
const removeToolState: RemoveToolState = {
  mouseX: 0,
  mouseY: 0,
  isAdjustingSize: false,
  adjustStartX: 0,
  adjustStartY: 0,
  currentScreenRadius: 25,
};

export function useRemoveTool(isActive: boolean) {
  const { engine, screenToWorld, zoom, canvasRef } = useEngine();
  const { executeCommand } = useHistory();

  // Drag state
  const isDragging = useRef(false);

  // Fixed screen radius for removal circle (25px)
  const SCREEN_RADIUS = 25;
  removeToolState.currentScreenRadius ||= SCREEN_RADIUS;

  // Manage cursor visibility only on canvas to avoid global flicker
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
      _canvasSize: { width: number; height: number },
      mouse
    ) => {
      if (!isActive) return;

      const radius = removeToolState.currentScreenRadius;
      const currentX = mouse?.x ?? removeToolState.mouseX;
      const currentY = mouse?.y ?? removeToolState.mouseY;

      if (removeToolState.isAdjustingSize) {
        const startX = removeToolState.adjustStartX;
        const startY = removeToolState.adjustStartY;
        const mouseX = currentX;
        const mouseY = currentY;

        // Circle centered at current mouse position (dashed)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dashed line from original mousedown to current mouse position
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tiny circle at cursor
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 4, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Draw dashed circle at current mouse position
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(currentX, currentY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    [isActive]
  );

  // Gesture batching
  const gestureActiveRef = useRef(false);
  const removedSnapshotsRef = useRef<Array<{ index: number; particle: any }>>(
    []
  );
  const commitInProgressRef = useRef(false);

  // Remove particles at current mouse position (live), capturing snapshots for undo
  const removeParticlesAtPosition = useCallback(
    async (screenX: number, screenY: number) => {
      if (!isActive || !screenToWorld || !engine) return;

      // Get world coordinates of current mouse position
      const worldCenter = screenToWorld(screenX, screenY);

      // Calculate world radius based on current zoom
      const worldRadius = removeToolState.currentScreenRadius / zoom;

      const particles = await engine.getParticles();
      let didChange = false;
      const updated = particles.map((p, index) => {
        const dx = p.position.x - worldCenter.x;
        const dy = p.position.y - worldCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= worldRadius && p.mass !== 0) {
          // Capture snapshot only once per index
          if (!removedSnapshotsRef.current.some((s) => s.index === index)) {
            removedSnapshotsRef.current.push({ index, particle: p });
          }
          didChange = true;
          return { ...p, mass: 0 };
        }
        return p;
      });

      if (didChange) {
        engine.setParticles(updated);
      }
    },
    [isActive, screenToWorld, zoom, engine]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!isActive) return;

      e.preventDefault();
      e.stopPropagation();

      const ctrlOrMeta = !!(e.ctrlKey || e.metaKey);
      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      removeToolState.mouseX = sx;
      removeToolState.mouseY = sy;

      if (ctrlOrMeta) {
        // Start size adjustment mode
        removeToolState.isAdjustingSize = true;
        removeToolState.adjustStartX = sx;
        removeToolState.adjustStartY = sy;
      } else {
        isDragging.current = true;
        gestureActiveRef.current = true;
        commitInProgressRef.current = false;
        removedSnapshotsRef.current = [];
        removeParticlesAtPosition(sx, sy);
      }
    },
    [isActive, removeParticlesAtPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = e.target as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      e.preventDefault();
      e.stopPropagation();

      removeToolState.mouseX = sx;
      removeToolState.mouseY = sy;

      // No mid-gesture entry; only enter adjust on mousedown with Ctrl/Cmd
      if (removeToolState.isAdjustingSize) {
        // Set radius to distance from start to current pointer (screen px)
        const dx = sx - removeToolState.adjustStartX;
        const dy = sy - removeToolState.adjustStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Match spawn tool behavior: radius grows slower than drag distance
        removeToolState.currentScreenRadius = Math.max(
          10,
          Math.min(distance / 2, 200)
        );
        return;
      }

      // If dragging, continuously remove particles
      if (isDragging.current) {
        removeParticlesAtPosition(sx, sy);
      }
    },
    [removeParticlesAtPosition]
  );

  const handleMouseUp = useCallback(async () => {
    if (removeToolState.isAdjustingSize) {
      removeToolState.isAdjustingSize = false;
      return;
    }
    isDragging.current = false;

    // Only commit when this gesture actually modified something
    if (!gestureActiveRef.current) {
      removedSnapshotsRef.current = [];
      return;
    }
    gestureActiveRef.current = false;

    const snapshots = removedSnapshotsRef.current.slice();
    if (snapshots.length === 0) {
      removedSnapshotsRef.current = [];
      return;
    }

    if (commitInProgressRef.current) return;
    commitInProgressRef.current = true;

    const cmd: Command = {
      id: crypto.randomUUID(),
      label: `Remove ${snapshots.length} particles`,
      timestamp: Date.now(),
      do: async (ctx: { engine: typeof engine }) => {
        if (!ctx.engine) return;
        const particles = await ctx.engine.getParticles();
        const updated = particles.map((p, idx) => {
          const s = snapshots.find((x) => x.index === idx);
          if (s) return { ...p, mass: 0 };
          return p;
        });
        ctx.engine.setParticles(updated);
      },
      undo: async (ctx: { engine: typeof engine }) => {
        if (!ctx.engine) return;
        const particles = await ctx.engine.getParticles();
        const updated = particles.map((p, idx) => {
          const s = snapshots.find((x) => x.index === idx);
          if (s) return s.particle;
          return p;
        });
        ctx.engine.setParticles(updated);
      },
    } as unknown as Command;

    await executeCommand(cmd);
    commitInProgressRef.current = false;
    removedSnapshotsRef.current = [];
  }, [executeCommand]);

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
