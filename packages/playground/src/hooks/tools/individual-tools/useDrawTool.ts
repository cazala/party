import { useCallback, useRef } from "react";
import type { IParticle as Particle } from "@cazala/party";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";
import { useInit } from "../../useInit";
import { calculateMassFromSize } from "../../../utils/particle";
import { parseColor, useRandomColorSelector } from "../utils";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";

// Configurable constants
const DRAW_STEP_SIZE = 20; // pixels - distance between particles when drawing
const MIN_PARTICLE_SIZE = 3;
const MAX_PARTICLE_SIZE = DRAW_STEP_SIZE / 2; // Max size matches step size

export function useDrawTool(isActive: boolean) {
  const { engine, screenToWorld, addParticle } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const { colors } = useInit();
  const { beginTransaction, appendToTransaction, commitTransaction } =
    useHistory();

  // Drawing state
  const isDrawingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false); // Prevent concurrent operations
  const lastHolderRef = useRef<{ idx: number | null } | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const selectedColorRef = useRef<string>("#ffffff");

  // Use module-level state (like shape tool) to prevent re-render issues
  const state = drawToolState;

  const selectRandomColor = useRandomColorSelector(colors);

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx, _size, mouse) => {
      if (!isActive) return;

      // Size adjustment overlay
      if (state.isAdjustingSize) {
        const startX = state.adjustStartX;
        const startY = state.adjustStartY;
        const mouseX = mouse?.x ?? state.mouseX;
        const mouseY = mouse?.y ?? state.mouseY;

        // Dashed line from start to cursor
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Circle at cursor showing current size (dashed)
        const zoom = engine?.getZoom() || 1;
        const screenRadius = state.currentSize * zoom;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tiny solid dot at cursor
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [isActive, engine]
  );

  // Helper function to spawn a particle at given position
  type IndexHolder = { idx: number | null };
  type SpawnResult = { holder: IndexHolder; ready: Promise<void> };

  const spawnParticle = useCallback(
    async (
      worldX: number,
      worldY: number,
      isPinned: boolean
    ): Promise<SpawnResult | null> => {
      if (!addParticle || !engine) return null;

      const color = parseColor(selectedColorRef.current);
      const size = state.currentSize; // Use current selected size
      const mass = isPinned ? -1 : calculateMassFromSize(size);

      const holder: IndexHolder = { idx: null };
      let resolveReady: (() => void) | null = null;
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      const cmd: Command = {
        id: crypto.randomUUID(),
        label: "Draw: spawn",
        timestamp: Date.now(),
        do: async (ctx: { engine: typeof engine }) => {
          addParticle({
            position: { x: worldX, y: worldY },
            velocity: { x: 0, y: 0 },
            size,
            mass,
            color,
          });
          const particles = await ctx.engine?.getParticles();
          holder.idx = (particles?.length ?? 1) - 1;
          if (resolveReady) resolveReady();
        },
        undo: async (ctx) => {
          if (!ctx.engine || holder.idx == null) return;
          const particles = (await ctx.engine.getParticles()) as Particle[];
          const updated = particles.map((p: Particle, idx: number) =>
            idx === holder.idx ? { ...p, mass: 0 } : p
          );
          ctx.engine.setParticles(updated);
        },
      };
      appendToTransaction(cmd);
      return { holder, ready };
    },
    [addParticle, engine, appendToTransaction]
  );

  // Helper function to create joint between two particles
  const createJoint = useCallback(
    (
      holderA: { idx: number | null },
      holderB: { idx: number | null },
      restLength: number
    ) => {
      // Enable joints module if not already enabled
      if (!joints.enabled) {
        joints.setEnabled(true);
      }

      // Enable joint lines module if not already enabled
      if (!lines.enabled) {
        lines.setEnabled(true);
      }

      const cmd: Command = {
        id: crypto.randomUUID(),
        label: "Draw: joint",
        timestamp: Date.now(),
        do: () => {
          if (!joints.enabled) joints.setEnabled(true);
          if (!lines.enabled) lines.setEnabled(true);
          if (holderA.idx != null && holderB.idx != null) {
            joints.addJoint({
              aIndex: holderA.idx,
              bIndex: holderB.idx,
              restLength,
            });
            lines.addLine({ aIndex: holderA.idx, bIndex: holderB.idx });
          }
        },
        undo: () => {
          if (holderA.idx != null && holderB.idx != null) {
            joints.removeJoint(holderA.idx, holderB.idx);
            lines.removeLine(holderA.idx, holderB.idx);
          }
        },
      };
      appendToTransaction(cmd);
    },
    [joints, lines, appendToTransaction]
  );

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      // Only handle events when this tool is active
      if (!isActive) {
        return;
      }

      // Stop event propagation to prevent other handlers (allow overlay listeners)
      ev.preventDefault();
      ev.stopPropagation();

      if (!engine) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;

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

      // Prevent concurrent mouse down events (after handling Ctrl-size gesture)
      if (isProcessingRef.current || isDrawingRef.current) return;

      // Clear any lingering size adjustment state for normal drawing
      if (state.isAdjustingSize) {
        state.isAdjustingSize = false;
      }

      isProcessingRef.current = true;

      const worldPos = screenToWorld(sx, sy);
      const isPinned = isShift; // Changed from ctrl/cmd to shift

      // Select new color for this drawing session
      selectedColorRef.current = selectRandomColor();

      // Begin a transaction for the drawing stroke
      beginTransaction("Draw stroke");

      // Start drawing - spawn first particle
      isDrawingRef.current = true;
      const firstResult = await spawnParticle(worldPos.x, worldPos.y, isPinned);

      if (firstResult) {
        await firstResult.ready;
        lastHolderRef.current = firstResult.holder;
        lastPositionRef.current = { x: sx, y: sy };
      }

      isProcessingRef.current = false;
    },

    onMouseMove: async (ev) => {
      if (!isActive) return;
      if (!engine) return;

      // Stop event propagation (allow overlay listeners)
      ev.preventDefault();
      ev.stopPropagation();

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;

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
      if (!lastPos || !lastHolderRef.current) return;

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
        const newResult = await spawnParticle(worldPos.x, worldPos.y, isPinned);

        const holderA = lastHolderRef.current;
        if (newResult && holderA) {
          await newResult.ready;
          // If user ended drawing meanwhile, abort
          if (!isDrawingRef.current) {
            isProcessingRef.current = false;
            return;
          }
          // Create joint between last particle and new particle
          const lastWorldPos = screenToWorld(lastPos.x, lastPos.y);
          const restLength = Math.sqrt(
            Math.pow(worldPos.x - lastWorldPos.x, 2) +
              Math.pow(worldPos.y - lastWorldPos.y, 2)
          );

          createJoint(holderA, newResult.holder, restLength);

          // Update tracking for next particle
          lastHolderRef.current = newResult.holder;
          lastPositionRef.current = { x: sx, y: sy };
        }

        isProcessingRef.current = false;
      }
    },

    onMouseUp: (ev) => {
      if (!isActive) return;

      // Stop event propagation (allow overlay listeners)
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
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
      lastHolderRef.current = null;
      lastPositionRef.current = null;

      // Commit the draw stroke transaction
      commitTransaction();

      // After finishing a draw stroke, ensure size-adjust preview anchor is cleared
      state.adjustStartX = 0;
      state.adjustStartY = 0;
    },
  };

  return {
    renderOverlay,
    handlers,
    setMousePosition: (x: number, y: number) => {
      // Keep mouse state in sync for immediate overlay after tool switch
      drawToolState.mouseX = x;
      drawToolState.mouseY = y;
    },
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
