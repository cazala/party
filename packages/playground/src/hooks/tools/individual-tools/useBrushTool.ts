import { useCallback, useRef } from "react";
import type { IParticle as Particle } from "@cazala/party";
import { drawDashedCircle, drawDashedLine, drawDot, getMouseInfo } from "../shared";
import { useEngine } from "../../useEngine";
import { useInit } from "../../useInit";
import { calculateMassFromSize } from "../../../utils/particle";
import { parseColor, useRandomColorSelector } from "../utils";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { ToolHandlers, ToolRenderFunction } from "../types";

type BrushToolState = {
  mouseX: number;
  mouseY: number;
  isAdjustingSize: boolean;
  adjustStartX: number;
  adjustStartY: number;
  currentScreenRadius: number;
};

const brushToolState: BrushToolState = {
  mouseX: 0,
  mouseY: 0,
  isAdjustingSize: false,
  adjustStartX: 0,
  adjustStartY: 0,
  currentScreenRadius: 20,
};

type SpatialHash = Map<string, Array<{ x: number; y: number; r: number }>>;

function cellKey(cx: number, cy: number) {
  return `${cx},${cy}`;
}

export function useBrushTool(isActive: boolean) {
  const { engine, screenToWorld, zoom, addParticle } = useEngine();
  const { particleSize, colors } = useInit();
  const { executeCommand } = useHistory();

  const selectRandomColor = useRandomColorSelector(colors);
  const selectedColorRef = useRef<string>("#ffffff");

  // Drag/gesture state
  const isDraggingRef = useRef(false);
  const gestureActiveRef = useRef(false);
  const commitInProgressRef = useRef(false);

  // Track new particles added during this gesture as a contiguous tail range
  const startCountRef = useRef<number | null>(null);

  // Spatial indexing for overlap checks during a gesture
  const indexReadyRef = useRef(false);
  const cellSizeRef = useRef<number>(10);
  const hashRef = useRef<SpatialHash>(new Map());
  const largeParticlesRef = useRef<Array<{ x: number; y: number; r: number }>>(
    []
  );

  // Throttle brush application a bit while dragging
  const lastAppliedScreenRef = useRef<{ x: number; y: number } | null>(null);
  const pendingApplyRef = useRef<{
    sx: number;
    sy: number;
    pinned: boolean;
  } | null>(null);

  const resetGestureState = useCallback(() => {
    isDraggingRef.current = false;
    gestureActiveRef.current = false;
    commitInProgressRef.current = false;
    startCountRef.current = null;
    indexReadyRef.current = false;
    hashRef.current = new Map();
    largeParticlesRef.current = [];
    lastAppliedScreenRef.current = null;
    pendingApplyRef.current = null;
  }, []);

  const insertIntoIndex = useCallback(
    (p: { x: number; y: number; r: number }) => {
      const cs = cellSizeRef.current;
      const cx = Math.floor(p.x / cs);
      const cy = Math.floor(p.y / cs);
      const key = cellKey(cx, cy);
      const bucket = hashRef.current.get(key);
      if (bucket) bucket.push(p);
      else hashRef.current.set(key, [p]);
    },
    []
  );

  const overlapsAny = useCallback(
    (x: number, y: number, r: number) => {
      // Always check "large" particles exactly
      for (const lp of largeParticlesRef.current) {
        const dx = lp.x - x;
        const dy = lp.y - y;
        const rr = lp.r + r;
        if (dx * dx + dy * dy < rr * rr) return true;
      }

      const cs = cellSizeRef.current;
      const cx = Math.floor(x / cs);
      const cy = Math.floor(y / cs);

      // Conservative neighborhood to handle varying particle sizes in the hash.
      const range = 3;
      for (let oy = -range; oy <= range; oy++) {
        for (let ox = -range; ox <= range; ox++) {
          const bucket = hashRef.current.get(cellKey(cx + ox, cy + oy));
          if (!bucket) continue;
          for (const bp of bucket) {
            const dx = bp.x - x;
            const dy = bp.y - y;
            const rr = bp.r + r;
            if (dx * dx + dy * dy < rr * rr) return true;
          }
        }
      }
      return false;
    },
    []
  );

  const applyBrushAt = useCallback(
    (sx: number, sy: number, pinned: boolean) => {
      if (!isActive) return;
      if (!engine || !screenToWorld || !addParticle) return;
      if (!indexReadyRef.current) {
        pendingApplyRef.current = { sx, sy, pinned };
        return;
      }

      const worldCenter = screenToWorld(sx, sy);
      const worldRadius = brushToolState.currentScreenRadius / Math.max(zoom, 1e-6);
      const r = particleSize; // world radius of each spawned particle
      if (r <= 0) return;

      // Ensure particles stay within the overlay circle visually (no centers outside).
      const effectiveRadius = Math.max(0, worldRadius - r);

      const color = parseColor(selectedColorRef.current);
      const mass = pinned ? -1 : calculateMassFromSize(r);

      // Hex packing inside circle
      const colStep = 2 * r;
      const rowStep = Math.sqrt(3) * r;

      const minY = worldCenter.y - effectiveRadius;
      const maxY = worldCenter.y + effectiveRadius;

      let spawned = 0;
      // Safety cap to avoid freezing the UI with extremely tiny particles + large radius.
      // Still high enough to fill the circle for common settings (e.g. size=1, radius=200px).
      const MAX_SPAWN_PER_APPLY = 50000;

      let rowIndex = 0;
      for (let y = minY; y <= maxY; y += rowStep, rowIndex++) {
        const xOffset = (rowIndex % 2) * r;
        const minX = worldCenter.x - effectiveRadius;
        const maxX = worldCenter.x + effectiveRadius;

        for (let x = minX; x <= maxX; x += colStep) {
          const px = x + xOffset;
          const dx = px - worldCenter.x;
          const dy = y - worldCenter.y;
          if (dx * dx + dy * dy > effectiveRadius * effectiveRadius) continue;

          if (overlapsAny(px, y, r)) continue;

          addParticle({
            position: { x: px, y },
            velocity: { x: 0, y: 0 },
            size: r,
            mass,
            color,
          });

          // Update index immediately so subsequent candidates/moves don't overlap.
          insertIntoIndex({ x: px, y, r });
          spawned++;
          if (spawned >= MAX_SPAWN_PER_APPLY) return;
        }
      }
    },
    [
      isActive,
      engine,
      screenToWorld,
      addParticle,
      zoom,
      particleSize,
      overlapsAny,
      insertIntoIndex,
    ]
  );

  const initializeGestureIndex = useCallback(async () => {
    if (!engine) return;
    const particles = (await engine.getParticles()) as Particle[];

    startCountRef.current = particles.length;

    const r = particleSize;
    // Index tuned to the spawned particle size; store all particles for overlap checks.
    const cellSize = Math.max(2 * r, 4);
    cellSizeRef.current = cellSize;
    hashRef.current = new Map();
    largeParticlesRef.current = [];

    // Particles much larger than our cell neighborhood are tracked separately.
    const largeThreshold = cellSize * 2; // conservative

    for (const p of particles) {
      if (p.mass === 0) continue; // removed
      const entry = { x: p.position.x, y: p.position.y, r: p.size };
      if (p.size > largeThreshold) {
        largeParticlesRef.current.push(entry);
      } else {
        // Add to hash for fast local checks
        const cx = Math.floor(entry.x / cellSize);
        const cy = Math.floor(entry.y / cellSize);
        const key = cellKey(cx, cy);
        const bucket = hashRef.current.get(key);
        if (bucket) bucket.push(entry);
        else hashRef.current.set(key, [entry]);
      }
    }

    // Also treat "large" particles as indexed so new spawns won't overlap them.
    indexReadyRef.current = true;

    const pending = pendingApplyRef.current;
    if (pending) {
      pendingApplyRef.current = null;
      applyBrushAt(pending.sx, pending.sy, pending.pinned);
    }
  }, [engine, particleSize, applyBrushAt]);

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx, _canvasSize, mouse) => {
      if (!isActive) return;

      const radius = brushToolState.currentScreenRadius;
      const currentX = mouse?.x ?? brushToolState.mouseX;
      const currentY = mouse?.y ?? brushToolState.mouseY;

      const GREY = "rgba(180,180,180,0.75)";
      const GREY_FAINT = "rgba(180,180,180,0.55)";

      if (brushToolState.isAdjustingSize) {
        const startX = brushToolState.adjustStartX;
        const startY = brushToolState.adjustStartY;
        drawDashedCircle(ctx, { x: currentX, y: currentY }, radius, GREY_FAINT, 2, [
          4, 4,
        ]);
        drawDashedLine(
          ctx,
          { x: startX, y: startY },
          { x: currentX, y: currentY },
          GREY,
          2,
          [6, 6]
        );
        drawDot(ctx, { x: currentX, y: currentY }, 4, GREY);
      } else {
        drawDashedCircle(ctx, { x: currentX, y: currentY }, radius, GREY_FAINT, 2, [
          4, 4,
        ]);
      }
    },
    [isActive]
  );

  const handlers: ToolHandlers = {
    onMouseDown: (ev) => {
      if (!isActive) return;
      if (!engine) return;

      ev.preventDefault();
      ev.stopPropagation();

      const canvas = ev.target as HTMLCanvasElement;
      const { sx, sy, ctrl, shift } = getMouseInfo(ev, canvas);

      brushToolState.mouseX = sx;
      brushToolState.mouseY = sy;

      if (ctrl) {
        brushToolState.isAdjustingSize = true;
        brushToolState.adjustStartX = sx;
        brushToolState.adjustStartY = sy;
        return;
      }

      // Start brush gesture
      isDraggingRef.current = true;
      gestureActiveRef.current = true;
      commitInProgressRef.current = false;
      lastAppliedScreenRef.current = null;
      pendingApplyRef.current = null;
      indexReadyRef.current = false;

      selectedColorRef.current = selectRandomColor();

      // Build spatial index once for this gesture
      void initializeGestureIndex().then(() => {
        // Apply immediately at down position (or queued)
        applyBrushAt(sx, sy, shift);
        lastAppliedScreenRef.current = { x: sx, y: sy };
      });
    },

    onMouseMove: (ev) => {
      if (!isActive) return;
      if (!engine) return;

      ev.preventDefault();
      ev.stopPropagation();

      const canvas = ev.target as HTMLCanvasElement;
      const { sx, sy, shift } = getMouseInfo(ev, canvas);

      brushToolState.mouseX = sx;
      brushToolState.mouseY = sy;

      if (brushToolState.isAdjustingSize) {
        const dx = sx - brushToolState.adjustStartX;
        const dy = sy - brushToolState.adjustStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        brushToolState.currentScreenRadius = Math.max(10, Math.min(distance / 2, 200));
        return;
      }

      if (!isDraggingRef.current) return;

      const last = lastAppliedScreenRef.current;
      const threshold = Math.max(6, particleSize * Math.max(zoom, 0.1));
      if (last) {
        const dx = sx - last.x;
        const dy = sy - last.y;
        if (dx * dx + dy * dy < threshold * threshold) return;
      }

      applyBrushAt(sx, sy, shift);
      lastAppliedScreenRef.current = { x: sx, y: sy };
    },

    onMouseUp: (ev) => {
      if (!isActive) return;

      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      if (brushToolState.isAdjustingSize) {
        brushToolState.isAdjustingSize = false;
        return;
      }

      isDraggingRef.current = false;

      if (!gestureActiveRef.current) {
        resetGestureState();
        return;
      }
      gestureActiveRef.current = false;

      if (!engine) {
        resetGestureState();
        return;
      }

      // Commit undo/redo command for the particles added during this gesture.
      if (commitInProgressRef.current) return;
      commitInProgressRef.current = true;

      const startCount = startCountRef.current ?? null;
      if (startCount == null) {
        resetGestureState();
        return;
      }

      void (async () => {
        const particles = (await engine.getParticles()) as Particle[];
        const endCount = particles.length;
        const count = Math.max(0, endCount - startCount);
        if (count === 0) {
          resetGestureState();
          return;
        }

        const snapshots = new Map<number, Particle>();
        for (let i = startCount; i < endCount; i++) {
          const p = particles[i];
          if (p) snapshots.set(i, p);
        }

        const indices = Array.from(snapshots.keys());

        const cmd: Command = {
          id: crypto.randomUUID(),
          label: `Brush: spawn ${indices.length} particles`,
          timestamp: Date.now(),
          do: async (ctx) => {
            if (!ctx.engine) return;
            const current = (await ctx.engine.getParticles()) as Particle[];
            const updated = current.map((p: Particle, idx: number) => {
              const s = snapshots.get(idx);
              return s ? s : p;
            });
            ctx.engine.setParticles(updated);
          },
          undo: async (ctx) => {
            if (!ctx.engine) return;
            const current = (await ctx.engine.getParticles()) as Particle[];
            const updated = current.map((p: Particle, idx: number) => {
              if (!snapshots.has(idx)) return p;
              return { ...p, mass: 0 };
            });
            ctx.engine.setParticles(updated);
          },
        };

        await executeCommand(cmd);
        resetGestureState();
      })();
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}
