import { useCallback } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";
import { useInit } from "../../useInit";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { calculateMassFromSize } from "../../../utils/particle";
import { parseColor, useRandomColorSelector } from "../utils";

// Shape tool configuration
const MIN_SIDES = 3;
const MAX_SIDES = 6;
const DEFAULT_SIDES = 3;
const DEFAULT_RADIUS = 50;
const MIN_RADIUS = 20;
const MAX_RADIUS = 200;

export function useShapeTool(isActive: boolean) {
  const { engine, screenToWorld, addParticle } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const { particleSize, colors } = useInit();
  const { executeCommand } = useHistory();

  // Shared module-level state to avoid duplicate hook instance desync between
  // event handlers and overlay renderer.
  // This ensures all consumers read/write the same live values.
  // Note: intentionally not using React refs/state here.
  //
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const state = shapeToolState;

  const selectRandomColor = useRandomColorSelector(colors);

  // Generate polygon vertices
  const generatePolygonVertices = useCallback(
    (centerX: number, centerY: number, radius: number, sides: number) => {
      const vertices = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2; // Start from top
        vertices.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      }
      return vertices;
    },
    []
  );

  type IndexHolder = { idx: number | null };
  // Note: using single-command execution; no per-particle spawn results needed

  // Spawn shape with full mesh connectivity
  const spawnShape = useCallback(
    async (centerX: number, centerY: number) => {
      if (!addParticle || !engine) return;

      const worldCenter = screenToWorld(centerX, centerY);
      const worldRadius = state.radius / Math.sqrt(engine.getZoom());
      const vertices = generatePolygonVertices(
        worldCenter.x,
        worldCenter.y,
        worldRadius,
        state.sides
      );

      // Select color for this shape
      const color = parseColor(state.selectedColor);
      const size = particleSize;
      const mass = calculateMassFromSize(size);

      // Execute a single undoable command that spawns the full shape and joints
      const holders: IndexHolder[] = vertices.map(() => ({ idx: null }));
      const shapeCmd: Command = {
        id: crypto.randomUUID(),
        label: `Spawn shape (${vertices.length})`,
        timestamp: Date.now(),
        do: async (ctx: { engine: typeof engine }) => {
          // Spawn particles and capture indices in sequence
          for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            addParticle({
              position: { x: v.x, y: v.y },
              velocity: { x: 0, y: 0 },
              size,
              mass,
              color,
            });
            const particles = await ctx.engine?.getParticles();
            holders[i].idx = (particles?.length ?? 1) - 1;
          }
          // Create joints after all indices are resolved
          if (!joints.enabled) joints.setEnabled(true);
          if (!lines.enabled) lines.setEnabled(true);
          for (let i = 0; i < holders.length; i++) {
            for (let j = i + 1; j < holders.length; j++) {
              const a = holders[i].idx;
              const b = holders[j].idx;
              if (a != null && b != null) {
                const va = vertices[i];
                const vb = vertices[j];
                const rest = Math.sqrt(
                  Math.pow(vb.x - va.x, 2) + Math.pow(vb.y - va.y, 2)
                );
                joints.addJoint({ aIndex: a, bIndex: b, restLength: rest });
                lines.addLine({ aIndex: a, bIndex: b });
              }
            }
          }
        },
        undo: async (ctx: { engine: typeof engine }) => {
          // Remove joints first
          for (let i = 0; i < holders.length; i++) {
            for (let j = i + 1; j < holders.length; j++) {
              const a = holders[i].idx;
              const b = holders[j].idx;
              if (a != null && b != null) {
                joints.removeJoint(a, b);
                lines.removeLine(a, b);
              }
            }
          }
          // Then unspawn particles
          if (!ctx.engine) return;
          const particles = await ctx.engine.getParticles();
          const updated = particles.map((p: any, idx: number) =>
            holders.some((h) => h.idx === idx) ? { ...p, mass: 0 } : p
          );
          ctx.engine.setParticles(updated);
        },
      } as unknown as Command;
      await executeCommand(shapeCmd);
    },
    [
      addParticle,
      engine,
      screenToWorld,
      generatePolygonVertices,
      particleSize,
      joints,
      lines,
      executeCommand,
    ]
  );

  const renderOverlay: ToolRenderFunction = (ctx, _size, mouse) => {
    if (!isActive) return;
    const centerX = mouse?.x ?? state.mouseX;
    const centerY = mouse?.y ?? state.mouseY;
    const zoom = engine?.getZoom() ?? 1;
    // Match the on-screen size of the shape spawned at current zoom
    // Spawn uses worldRadius = state.radius / Math.sqrt(zoom), which results in
    // a screen-space radius of state.radius * Math.sqrt(zoom). Use same here.
    const radius = state.radius * Math.sqrt(zoom);
    const sides = state.sides;
    const isAdjustingSize = state.isAdjustingRadius;
    const isAdjustingSides = state.isAdjustingSides;

    // Generate preview vertices
    const vertices = generatePolygonVertices(centerX, centerY, radius, sides);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw preview particles
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;

    vertices.forEach((vertex) => {
      ctx.beginPath();
      // Scale preview particle marker with zoom so it matches on-screen particle size
      ctx.arc(vertex.x, vertex.y, (particleSize / 2) * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw preview joints (full mesh)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        ctx.beginPath();
        ctx.moveTo(vertices[i].x, vertices[i].y);
        ctx.lineTo(vertices[j].x, vertices[j].y);
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    // Size adjustment overlay
    if (isAdjustingSize) {
      const startX = state.adjustStartX;
      const startY = state.adjustStartY;

      // Dashed line from start to current mouse position
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(centerX, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tiny solid dot at cursor
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sides adjustment overlay
    if (isAdjustingSides) {
      // Sides indicator
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${sides} sides`, centerX, centerY - 30);

      // Progress bar for sides (3-6)
      const barWidth = 80;
      const barHeight = 6;
      const barX = centerX - barWidth / 2;
      const barY = centerY + 30;

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Progress
      const progress = (sides - MIN_SIDES) / (MAX_SIDES - MIN_SIDES);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);

      // Ticks for each side count
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      for (let i = MIN_SIDES; i <= MAX_SIDES; i++) {
        const tickProgress = (i - MIN_SIDES) / (MAX_SIDES - MIN_SIDES);
        const tickX = barX + barWidth * tickProgress;
        ctx.beginPath();
        ctx.moveTo(tickX, barY - 2);
        ctx.lineTo(tickX, barY + barHeight + 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      // Stop event propagation to prevent other handlers
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();

      if (!engine || !isActive) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.mouseX = sx;
      state.mouseY = sy;

      const isCtrl = ev.ctrlKey || ev.metaKey;
      const isShift = ev.shiftKey;

      if (isCtrl) {
        // Start size adjustment
        state.isAdjustingRadius = true;
        state.adjustStartX = sx;
        state.adjustStartY = sy;
        state.adjustStartValue = state.radius;
      } else if (isShift) {
        // Start sides adjustment
        state.isAdjustingSides = true;
        state.adjustStartX = sx;
        state.adjustStartY = sy;
        state.adjustStartValue = state.sides;
      } else {
        // Normal spawn
        state.selectedColor = selectRandomColor();
        await spawnShape(sx, sy);
      }
    },

    onMouseMove: (ev) => {
      if (!isActive) return;

      const isAdjustingSize = state.isAdjustingRadius;
      const isAdjustingSides = state.isAdjustingSides;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.mouseX = sx;
      state.mouseY = sy;

      if (isAdjustingSize) {
        // Adjust radius based on distance from start point
        const startX = state.adjustStartX;
        const startY = state.adjustStartY;
        const distance = Math.sqrt(
          Math.pow(sx - startX, 2) + Math.pow(sy - startY, 2)
        );
        const newRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, distance));
        state.radius = newRadius;
      }

      if (isAdjustingSides) {
        // Adjust sides based on horizontal drag distance
        const startX = state.adjustStartX;
        const deltaX = sx - startX;
        const sensitivity = 20; // pixels per side
        const sidesDelta = Math.round(deltaX / sensitivity);
        const newSides = Math.max(
          MIN_SIDES,
          Math.min(MAX_SIDES, state.adjustStartValue + sidesDelta)
        );
        state.sides = newSides;
      }
    },

    onMouseUp: () => {
      if (!isActive) return;

      // End adjustment modes
      state.isAdjustingRadius = false;
      state.isAdjustingSides = false;
    },
  };

  return {
    renderOverlay,
    handlers,
    setMousePosition: (x: number, y: number) => {
      // Seed overlay mouse immediately after tool switch
      shapeToolState.mouseX = x;
      shapeToolState.mouseY = y;
    },
  };
}

// Shared module-level state for the shape tool
type ShapeToolState = {
  sides: number;
  isAdjustingSides: boolean;
  radius: number;
  isAdjustingRadius: boolean;
  mouseX: number;
  mouseY: number;
  adjustStartX: number;
  adjustStartY: number;
  adjustStartValue: number; // stores starting radius or sides depending on mode
  selectedColor: string;
};

const shapeToolState: ShapeToolState = {
  sides: DEFAULT_SIDES,
  isAdjustingSides: false,
  radius: DEFAULT_RADIUS,
  isAdjustingRadius: false,
  mouseX: 0,
  mouseY: 0,
  adjustStartX: 0,
  adjustStartY: 0,
  adjustStartValue: 0,
  selectedColor: "#ffffff",
};
