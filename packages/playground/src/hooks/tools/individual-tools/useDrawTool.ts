import { useCallback, useRef } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";
import { useInit } from "../../useInit";
import { calculateMassFromSize } from "../../../utils/particle";
import { parseColor, useRandomColorSelector } from "../utils";

// Configurable constants
const DRAW_STEP_SIZE = 20; // pixels - distance between particles when drawing
const MIN_PARTICLE_SIZE = 3;
const MAX_PARTICLE_SIZE = DRAW_STEP_SIZE / 2; // Max size matches step size

export function useDrawTool(isActive: boolean) {
  const { engine, screenToWorld, addParticle } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const { colors } = useInit();

  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false); // Prevent concurrent operations
  const lastParticleIndexRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectedColorRef = useRef<string>("#ffffff");

  // Use module-level state (like shape tool) to prevent re-render issues
  const state = drawToolState;

  const selectRandomColor = useRandomColorSelector(colors);

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx) => {
      if (!isActive) return;

      // Size adjustment overlay
      if (state.isAdjustingSize) {
        const startX = state.adjustStartX;
        const startY = state.adjustStartY;
        const mouseX = state.mouseX;
        const mouseY = state.mouseY;

        // Dashed line from start to cursor
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Circle at cursor showing current size
        const zoom = engine?.getZoom() || 1;
        const screenRadius = state.currentSize * zoom;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, screenRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Size text
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `Size: ${Math.round(state.currentSize)}`,
          mouseX,
          mouseY - screenRadius - 10
        );
      }
    },
    [isActive, engine]
  );

  // Helper function to spawn a particle at given position
  const spawnParticle = useCallback(
    async (worldX: number, worldY: number, isPinned: boolean) => {
      if (!addParticle || !engine) return null;

      const color = parseColor(selectedColorRef.current);
      const size = state.currentSize; // Use current selected size
      const mass = isPinned ? -1 : calculateMassFromSize(size);

      addParticle({
        position: { x: worldX, y: worldY },
        velocity: { x: 0, y: 0 },
        size,
        mass,
        color,
      });

      // Get the index of the newly added particle (should be the last one)
      const particles = await engine.getParticles();
      return particles.length - 1;
    },
    [addParticle, engine]
  );

  // Helper function to create joint between two particles
  const createJoint = useCallback(
    (indexA: number, indexB: number, restLength: number) => {
      // Enable joints module if not already enabled
      if (!joints.enabled) {
        joints.setEnabled(true);
      }

      // Enable joint lines module if not already enabled
      if (!lines.enabled) {
        lines.setEnabled(true);
      }

      joints.addJoint({ aIndex: indexA, bIndex: indexB, restLength });
      lines.addLine({ aIndex: indexA, bIndex: indexB });
    },
    [joints, lines]
  );

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      // Only handle events when this tool is active
      if (!isActive) {
        return;
      }

      // Stop event propagation to prevent other handlers
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      if (!engine) return;

      // Prevent concurrent mouse down events
      if (isProcessingRef.current || isDrawingRef.current) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };

      const isCtrl = ev.ctrlKey || ev.metaKey;
      const isShift = ev.shiftKey;

      if (isCtrl) {
        // Start size adjustment mode
        state.isAdjustingSize = true;
        state.adjustStartX = sx;
        state.adjustStartY = sy;
        state.mouseX = sx;
        state.mouseY = sy;
        return;
      }

      // Clear any lingering size adjustment state for normal drawing
      if (state.isAdjustingSize) {
        state.isAdjustingSize = false;
      }

      isProcessingRef.current = true;

      const worldPos = screenToWorld(sx, sy);
      const isPinned = isShift; // Changed from ctrl/cmd to shift

      // Select new color for this drawing session
      selectedColorRef.current = selectRandomColor();

      // Start drawing - spawn first particle
      isDrawingRef.current = true;
      const particleIndex = await spawnParticle(
        worldPos.x,
        worldPos.y,
        isPinned
      );

      if (particleIndex !== null) {
        lastParticleIndexRef.current = particleIndex;
        lastPositionRef.current = { x: sx, y: sy };
      }

      isProcessingRef.current = false;
    },

    onMouseMove: async (ev) => {
      if (!isActive) return;
      if (!engine) return;

      // Stop event propagation
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };

      // Handle size adjustment mode
      if (state.isAdjustingSize) {
        const startX = state.adjustStartX;
        const startY = state.adjustStartY;
        const distance = Math.sqrt(
          Math.pow(sx - startX, 2) + Math.pow(sy - startY, 2)
        );
        const newSize = Math.max(
          MIN_PARTICLE_SIZE,
          Math.min(MAX_PARTICLE_SIZE, distance / 2)
        );
        state.mouseX = sx;
        state.mouseY = sy;
        state.currentSize = newSize;
        return; // Exit early since we're only adjusting size
      }

      // Regular drawing mode - only continue if we're actually drawing
      if (!isDrawingRef.current || isProcessingRef.current) return;

      const lastPos = lastPositionRef.current;
      if (!lastPos || lastParticleIndexRef.current === null) return;

      // Calculate distance from last particle position
      const dx = sx - lastPos.x;
      const dy = sy - lastPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if we've moved far enough to spawn a new particle
      if (distance >= DRAW_STEP_SIZE) {
        // Prevent concurrent spawning
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const worldPos = screenToWorld(sx, sy);
        const isPinned = ev.shiftKey; // Changed from ctrl/cmd to shift

        // Spawn new particle
        const newParticleIndex = await spawnParticle(
          worldPos.x,
          worldPos.y,
          isPinned
        );

        if (
          newParticleIndex !== null &&
          lastParticleIndexRef.current !== null
        ) {
          // Create joint between last particle and new particle
          const lastWorldPos = screenToWorld(lastPos.x, lastPos.y);
          const restLength = Math.sqrt(
            Math.pow(worldPos.x - lastWorldPos.x, 2) +
              Math.pow(worldPos.y - lastWorldPos.y, 2)
          );

          createJoint(
            lastParticleIndexRef.current,
            newParticleIndex,
            restLength
          );

          // Update tracking for next particle
          lastParticleIndexRef.current = newParticleIndex;
          lastPositionRef.current = { x: sx, y: sy };
        }

        isProcessingRef.current = false;
      }
    },

    onMouseUp: (ev) => {
      if (!isActive) return;

      // Stop event propagation
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
      }

      // End size adjustment mode if active
      if (state.isAdjustingSize) {
        state.isAdjustingSize = false;
        return;
      }

      // Prevent concurrent mouse up events
      if (!isDrawingRef.current) return;

      // End drawing session
      isDrawingRef.current = false;
      isProcessingRef.current = false;
      lastParticleIndexRef.current = null;
      lastPositionRef.current = null;
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}

// Shared module-level state for the draw tool
type DrawToolState = {
  isAdjustingSize: boolean;
  mouseX: number;
  mouseY: number;
  currentSize: number;
  adjustStartX: number;
  adjustStartY: number;
};

const drawToolState: DrawToolState = {
  isAdjustingSize: false,
  mouseX: 0,
  mouseY: 0,
  currentSize: 5, // Default size
  adjustStartX: 0,
  adjustStartY: 0,
};
