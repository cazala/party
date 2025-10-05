import { useCallback } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";
import { useInit } from "../../useInit";
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

      // Spawn all particles
      const particleIndices: number[] = [];
      for (const vertex of vertices) {
        addParticle({
          position: { x: vertex.x, y: vertex.y },
          velocity: { x: 0, y: 0 },
          size,
          mass,
          color,
        });

        // Get the index of the newly added particle
        const particles = await engine.getParticles();
        particleIndices.push(particles.length - 1);
      }

      // Enable joints and lines modules if not already enabled
      if (!joints.enabled) {
        joints.setEnabled(true);
      }
      if (!lines.enabled) {
        lines.setEnabled(true);
      }

      // Create full mesh connectivity (every particle connected to every other)
      for (let i = 0; i < particleIndices.length; i++) {
        for (let j = i + 1; j < particleIndices.length; j++) {
          const indexA = particleIndices[i];
          const indexB = particleIndices[j];

          // Calculate rest length as the distance between the particles
          const vertexA = vertices[i];
          const vertexB = vertices[j];
          const restLength = Math.sqrt(
            Math.pow(vertexB.x - vertexA.x, 2) +
              Math.pow(vertexB.y - vertexA.y, 2)
          );

          joints.addJoint({ aIndex: indexA, bIndex: indexB, restLength });
          lines.addLine({ aIndex: indexA, bIndex: indexB });
        }
      }
    },
    [
      addParticle,
      engine,
      screenToWorld,
      generatePolygonVertices,
      particleSize,
      joints,
      lines,
    ]
  );

  const renderOverlay: ToolRenderFunction = (ctx) => {
    if (!isActive) return;
    const centerX = state.mouseX;
    const centerY = state.mouseY;
    const radius = state.radius;
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
      ctx.arc(vertex.x, vertex.y, particleSize / 2, 0, Math.PI * 2);
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

      // Dashed line from center to cursor
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(centerX, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Circle at cursor
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Radius text
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Radius: ${Math.round(radius)}`, centerX, centerY - 20);
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

    // Debug logging
    console.log("Shape overlay render:", {
      centerX,
      centerY,
      radius,
      sides,
      isAdjustingSize,
      isAdjustingSides,
    });

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
        console.log("Starting size adjustment");
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
