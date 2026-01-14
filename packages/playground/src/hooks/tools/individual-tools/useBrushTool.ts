import { useCallback, useRef } from "react";
import type { IParticle as Particle, ParticleQuery } from "@cazala/party";
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

const f32 = (v: number) => Math.fround(v);

export function useBrushTool(isActive: boolean) {
  const { engine, screenToWorld, zoom, addParticle } = useEngine();
  const { particleSize, colors } = useInit();
  const { recordCommand } = useHistory();

  const selectRandomColor = useRandomColorSelector(colors);
  const selectedColorRef = useRef<string>("#ffffff");

  // Drag/gesture state
  const isDraggingRef = useRef(false);
  const gestureActiveRef = useRef(false);
  const commitInProgressRef = useRef(false);
  const stampInProgressRef = useRef(false);
  const holdIntervalIdRef = useRef<number | null>(null);
  const currentPinnedRef = useRef(false);
  const lastQueryAtMsRef = useRef(0);

  // Track new particles added during this gesture as a contiguous tail range
  const spawnedRef = useRef<Array<{ index: number; particle: Particle }>>([]);

  // Spatial indexing for overlap checks during a gesture
  const indexReadyRef = useRef(false);
  const cellSizeRef = useRef<number>(10);
  const hashRef = useRef<SpatialHash>(new Map());
  const largeParticlesRef = useRef<Array<{ x: number; y: number; r: number }>>(
    []
  );
  const truncatedQueryRef = useRef(false);

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
    stampInProgressRef.current = false;
    spawnedRef.current = [];
    indexReadyRef.current = false;
    hashRef.current = new Map();
    largeParticlesRef.current = [];
    lastAppliedScreenRef.current = null;
    pendingApplyRef.current = null;
    truncatedQueryRef.current = false;
    currentPinnedRef.current = false;
    lastQueryAtMsRef.current = 0;
    if (holdIntervalIdRef.current != null) {
      window.clearInterval(holdIntervalIdRef.current);
      holdIntervalIdRef.current = null;
    }
  }, []);

  const insertIntoIndex = useCallback(
    (p: { x: number; y: number; r: number }) => {
      // Keep index coordinates in f32 to match WebGPU particle storage precision.
      const fx = f32(p.x);
      const fy = f32(p.y);
      const fr = f32(p.r);
      const cs = cellSizeRef.current;
      const cx = Math.floor(fx / cs);
      const cy = Math.floor(fy / cs);
      const key = cellKey(cx, cy);
      const bucket = hashRef.current.get(key);
      const entry = { x: fx, y: fy, r: fr };
      if (bucket) bucket.push(entry);
      else hashRef.current.set(key, [entry]);
    },
    []
  );

  const overlapsAny = useCallback(
    (x: number, y: number, r: number) => {
      // Use f32 math to match stored particle coords (esp. WebGPU),
      // and slightly shrink the overlap threshold to avoid false positives
      // from float rounding (which can otherwise skip entire rows).
      const fx = f32(x);
      const fy = f32(y);
      const fr = f32(r);
      const shrink = 1e-4; // 0.01% radius shrink: avoids float32 edge overlaps

      // Always check "large" particles exactly
      for (const lp of largeParticlesRef.current) {
        const dx = lp.x - fx;
        const dy = lp.y - fy;
        const rr = (lp.r + fr) * (1 - shrink);
        if (dx * dx + dy * dy < rr * rr) return true;
      }

      const cs = cellSizeRef.current;
      const cx = Math.floor(fx / cs);
      const cy = Math.floor(fy / cs);

      // Conservative neighborhood to handle varying particle sizes in the hash.
      const range = 3;
      for (let oy = -range; oy <= range; oy++) {
        for (let ox = -range; ox <= range; ox++) {
          const bucket = hashRef.current.get(cellKey(cx + ox, cy + oy));
          if (!bucket) continue;
          for (const bp of bucket) {
            const dx = bp.x - fx;
            const dy = bp.y - fy;
            const rr = (bp.r + fr) * (1 - shrink);
            if (dx * dx + dy * dy < rr * rr) return true;
          }
        }
      }
      return false;
    },
    []
  );

  const rebuildIndexForStamp = useCallback(
    async (sx: number, sy: number) => {
      if (!engine) return;
      if (!screenToWorld) return;

      const worldCenter = screenToWorld(sx, sy);
      const worldRadius =
        brushToolState.currentScreenRadius / Math.max(zoom, 1e-6);
      const spawnRadius = particleSize;
      const queryRadius = worldRadius + spawnRadius;

      const result = await engine.getParticlesInRadius(worldCenter, queryRadius, {
        maxResults: 20000,
      });
      const particles = result.particles as ParticleQuery[];
      truncatedQueryRef.current = result.truncated;

      // Index tuned to the spawned particle size; store all particles for overlap checks.
      const cellSize = Math.max(2 * spawnRadius, 4);
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
          const cx = Math.floor(entry.x / cellSize);
          const cy = Math.floor(entry.y / cellSize);
          const key = cellKey(cx, cy);
          const bucket = hashRef.current.get(key);
          if (bucket) bucket.push(entry);
          else hashRef.current.set(key, [entry]);
        }
      }

      indexReadyRef.current = true;
      lastQueryAtMsRef.current = performance.now();
    },
    [engine, screenToWorld, zoom, particleSize]
  );

  const stampWithCurrentIndex = useCallback(
    (sx: number, sy: number, pinned: boolean) => {
      if (!isActive) return;
      if (!engine || !screenToWorld || !addParticle) return;

      const worldCenter = screenToWorld(sx, sy);
      const worldRadius = brushToolState.currentScreenRadius / Math.max(zoom, 1e-6);
      const r = particleSize; // world radius of each spawned particle
      if (r <= 0) return;

      // Ensure particles stay within the overlay circle visually (no centers outside).
      const effectiveRadius = Math.max(0, worldRadius - r);

      const color = parseColor(selectedColorRef.current);
      const mass = pinned ? -1 : calculateMassFromSize(r);

      let spawned = 0;
      // Safety cap to avoid freezing the UI with extremely tiny particles + large radius.
      // Still high enough to fill the circle for common settings (e.g. size=1, radius=200px).
      const MAX_SPAWN_PER_APPLY = truncatedQueryRef.current ? 4000 : 50000;

      // Globally-anchored hex lattice (anchor at world origin) to avoid phase/striping artifacts.
      const dx = 2 * r;
      const dy = Math.sqrt(3) * r;

      const minX = worldCenter.x - effectiveRadius;
      const maxX = worldCenter.x + effectiveRadius;
      const minY = worldCenter.y - effectiveRadius;
      const maxY = worldCenter.y + effectiveRadius;

      const jMin = Math.floor(minY / dy) - 1;
      const jMax = Math.ceil(maxY / dy) + 1;

      for (let j = jMin; j <= jMax; j++) {
        const y = f32(j * dy);
        if (y < minY - dy || y > maxY + dy) continue;

        const xOffset = (j & 1) ? r : 0;
        const iMin = Math.floor((minX - xOffset) / dx) - 1;
        const iMax = Math.ceil((maxX - xOffset) / dx) + 1;

        for (let i = iMin; i <= iMax; i++) {
          const px = f32(i * dx + xOffset);
          if (px < minX - dx || px > maxX + dx) continue;

          const ddx = px - worldCenter.x;
          const ddy = y - worldCenter.y;
          if (ddx * ddx + ddy * ddy > effectiveRadius * effectiveRadius) continue;

          if (overlapsAny(px, y, r)) continue;

          const p: Particle = {
            position: { x: px, y },
            velocity: { x: 0, y: 0 },
            size: r,
            mass,
            color,
          };

          const createdIndex = addParticle(p);
          if (typeof createdIndex === "number" && createdIndex >= 0) {
            spawnedRef.current.push({ index: createdIndex, particle: p });
          }

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

  const stampAt = useCallback(
    async (sx: number, sy: number, pinned: boolean, forceRefresh: boolean) => {
      if (!isActive) return;
      if (!engine || !screenToWorld || !addParticle) return;

      if (stampInProgressRef.current) {
        pendingApplyRef.current = { sx, sy, pinned };
        return;
      }

      stampInProgressRef.current = true;
      try {
        const now = performance.now();
        const refreshIntervalMs = truncatedQueryRef.current ? 180 : 80;
        const shouldRefresh =
          forceRefresh ||
          !indexReadyRef.current ||
          now - lastQueryAtMsRef.current > refreshIntervalMs;

        if (shouldRefresh) {
          await rebuildIndexForStamp(sx, sy);
        }

        if (indexReadyRef.current) {
          stampWithCurrentIndex(sx, sy, pinned);
        }
      } finally {
        stampInProgressRef.current = false;
      }

      const pending = pendingApplyRef.current;
      if (pending) {
        pendingApplyRef.current = null;
        void stampAt(pending.sx, pending.sy, pending.pinned, false);
      }
    },
    [isActive, engine, screenToWorld, addParticle, rebuildIndexForStamp, stampWithCurrentIndex]
  );

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
      currentPinnedRef.current = shift;

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
      spawnedRef.current = [];

      selectedColorRef.current = selectRandomColor();

      // Apply immediately at down position, and start "hold to paint" loop.
      void stampAt(sx, sy, shift, true);
      lastAppliedScreenRef.current = { x: sx, y: sy };

      if (holdIntervalIdRef.current != null) {
        window.clearInterval(holdIntervalIdRef.current);
      }
      holdIntervalIdRef.current = window.setInterval(() => {
        if (!isDraggingRef.current) return;
        if (brushToolState.isAdjustingSize) return;
        if (!engine) return;
        // While holding still, keep stamping; each tick refreshes occupancy as needed.
        void stampAt(
          brushToolState.mouseX,
          brushToolState.mouseY,
          currentPinnedRef.current,
          true
        );
      }, 120);
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
      currentPinnedRef.current = shift;

      if (brushToolState.isAdjustingSize) {
        const dx = sx - brushToolState.adjustStartX;
        const dy = sy - brushToolState.adjustStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        brushToolState.currentScreenRadius = Math.max(10, Math.min(distance / 2, 200));
        return;
      }

      if (!isDraggingRef.current) return;

      const last = lastAppliedScreenRef.current;
      // Stamp threshold (screen-space): ~0.8 * 2r in world, scaled by zoom.
      const base = 1.6 * particleSize * Math.max(zoom, 0.1);
      const threshold = Math.max(6, truncatedQueryRef.current ? base * 2 : base);
      if (last) {
        const dx = sx - last.x;
        const dy = sy - last.y;
        if (dx * dx + dy * dy < threshold * threshold) return;
      }

      void stampAt(sx, sy, shift, false);
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
      if (holdIntervalIdRef.current != null) {
        window.clearInterval(holdIntervalIdRef.current);
        holdIntervalIdRef.current = null;
      }

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

      const spawned = spawnedRef.current.slice();

      void (async () => {
        if (spawned.length === 0) {
          resetGestureState();
          return;
        }

        const indices = spawned.map((s) => s.index);
        const snapshots = new Map<number, Particle>(
          spawned.map((s) => [s.index, s.particle])
        );

        const cmd: Command = {
          id: crypto.randomUUID(),
          label: `Brush: spawn ${indices.length} particles`,
          timestamp: Date.now(),
          do: async (ctx) => {
            if (!ctx.engine) return;
            // Idempotently restore spawned particle records.
            for (const idx of indices) {
              const s = snapshots.get(idx);
              if (s) ctx.engine.setParticle(idx, s);
            }
          },
          undo: async (ctx) => {
            if (!ctx.engine) return;
            for (const idx of indices) {
              ctx.engine.setParticleMass(idx, 0);
            }
          },
        };

        recordCommand(cmd);
        resetGestureState();
      })();
    },
  };

  return {
    renderOverlay,
    handlers,
  };
}
