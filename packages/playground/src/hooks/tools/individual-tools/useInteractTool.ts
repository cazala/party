import { useCallback } from "react";
import { useEngine } from "../../useEngine";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { drawDashedCircle, drawDashedLine, drawDot } from "../shared";
import { useInteraction } from "../../modules/useInteraction";

// Interaction tool configuration
const MIN_RADIUS = 0;
const MAX_RADIUS = 1000;
const MIN_STRENGTH = 0;
const MAX_STRENGTH = 10000;
const STRENGTH_SENSITIVITY = 100; // pixels -> strength units per px

type InteractionToolState = {
  // live mouse
  mouseX: number;
  mouseY: number;

  // adjustment flags
  isAdjustingRadius: boolean;
  isAdjustingStrength: boolean;
  isInteracting: boolean;

  // adjustment start
  adjustStartX: number;
  adjustStartY: number;
  adjustStartRadius: number;
  adjustStartStrength: number;
};

const interactionToolState: InteractionToolState = {
  mouseX: 0,
  mouseY: 0,
  isAdjustingRadius: false,
  isAdjustingStrength: false,
  isInteracting: false,
  adjustStartX: 0,
  adjustStartY: 0,
  adjustStartRadius: 0,
  adjustStartStrength: 0,
};

export function useInteractTool(isActive: boolean, isHomepage: boolean) {
  const { canvasRef, interaction, screenToWorld, engine } = useEngine();
  const { strength, radius, setStrength, setRadius, setMode } =
    useInteraction();

  const state = interactionToolState;

  // Disable tool when homepage is active
  const toolActive = isActive && !isHomepage;

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx, _size, mouse) => {
      if (!toolActive) return;

      const centerX = mouse?.x ?? state.mouseX;
      const centerY = mouse?.y ?? state.mouseY;
      const zoom = engine?.getZoom() ?? 1;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Radius adjustment overlay
      if (state.isAdjustingRadius) {
        const startX = state.adjustStartX;
        const startY = state.adjustStartY;

        // Dashed line from start to current mouse position
        drawDashedLine(
          ctx,
          { x: startX, y: startY },
          { x: centerX, y: centerY },
          "rgba(255, 255, 255, 0.8)",
          2,
          [6, 6]
        );

        // Draw preview circle for current radius
        // Convert current radius (world units) to screen units; see shape tool heuristic
        const currentRadiusWorld = radius;
        const currentRadiusScreen = currentRadiusWorld * Math.sqrt(zoom);
        drawDashedCircle(
          ctx,
          { x: centerX, y: centerY },
          Math.max(0, currentRadiusScreen),
          "rgba(255, 255, 255, 0.8)",
          2,
          [4, 4]
        );

        // Tiny solid dot at cursor
        drawDot(ctx, { x: centerX, y: centerY }, 4, "rgb(255, 255, 255, 0.8)");
      }

      // Strength adjustment overlay
      if (state.isAdjustingStrength) {
        // Strength indicator
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `strength: ${Math.round(strength)}`,
          centerX,
          centerY - 30
        );

        // Horizontal bar
        const barWidth = 120;
        const barHeight = 6;
        const barX = centerX - barWidth / 2;
        const barY = centerY + 30;

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress fill
        const progress =
          (strength - MIN_STRENGTH) / (MAX_STRENGTH - MIN_STRENGTH);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillRect(
          barX,
          barY,
          Math.max(0, Math.min(1, progress)) * barWidth,
          barHeight
        );

        // Ticks
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
          const t = i / tickCount;
          const tickX = barX + barWidth * t;
          ctx.beginPath();
          ctx.moveTo(tickX, barY - 2);
          ctx.lineTo(tickX, barY + barHeight + 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    },
    [toolActive, engine, radius, strength]
  );

  const handlers: ToolHandlers = {
    onMouseDown: (ev) => {
      if (!toolActive || !interaction) return;
      ev.preventDefault();
      ev.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.mouseX = sx;
      state.mouseY = sy;

      const isCtrl = ev.ctrlKey || ev.metaKey;
      const isShift = ev.shiftKey;

      if (isCtrl) {
        // Start radius adjustment
        state.isAdjustingRadius = true;
        state.adjustStartX = sx;
        state.adjustStartY = sy;
        state.adjustStartRadius = radius;
        return;
      }

      if (isShift) {
        // Start strength adjustment
        state.isAdjustingStrength = true;
        state.adjustStartX = sx;
        state.adjustStartY = sy;
        state.adjustStartStrength = strength;
        return;
      }

      // Normal interaction click: left = attract, right = repel
      state.isInteracting = true;
      const button = (ev as MouseEvent).button;
      const mode = button === 2 ? "repel" : "attract";
      setMode(mode);

      const { x, y } = screenToWorld(sx, sy);
      interaction.setPosition(x, y);
      interaction.setActive(true);
    },

    onMouseMove: (ev) => {
      if (!toolActive || !interaction) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.mouseX = sx;
      state.mouseY = sy;

      // Update interaction position when actively interacting
      if (state.isInteracting) {
        const { x, y } = screenToWorld(sx, sy);
        interaction.setPosition(x, y);
      }

      // Radius adjustment drag
      if (state.isAdjustingRadius) {
        // Distance in world units between start and current
        const startWorld = screenToWorld(
          state.adjustStartX,
          state.adjustStartY
        );
        const currWorld = screenToWorld(sx, sy);
        const dx = currWorld.x - startWorld.x;
        const dy = currWorld.y - startWorld.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const newRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, distance));
        setRadius(newRadius);
      }

      // Strength adjustment drag (horizontal)
      if (state.isAdjustingStrength) {
        const deltaX = sx - state.adjustStartX;
        const newStrength = Math.max(
          MIN_STRENGTH,
          Math.min(
            MAX_STRENGTH,
            state.adjustStartStrength + deltaX * STRENGTH_SENSITIVITY
          )
        );
        setStrength(newStrength);
      }
    },

    onMouseUp: (ev) => {
      if (!toolActive || !interaction) return;
      ev.preventDefault();
      ev.stopPropagation();

      // End adjustment modes or deactivate interaction
      if (state.isAdjustingRadius) {
        state.isAdjustingRadius = false;
        return;
      }
      if (state.isAdjustingStrength) {
        state.isAdjustingStrength = false;
        return;
      }

      if (state.isInteracting) {
        state.isInteracting = false;
        interaction.setActive(false);
      }
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}
