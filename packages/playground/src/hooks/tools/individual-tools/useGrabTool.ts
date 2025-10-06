import { useCallback, useRef } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useGrab } from "../../modules/useGrab";

export function useGrabTool(isActive: boolean) {
  const { engine, screenToWorld, zoom } = useEngine();
  const {
    setEnabled: setGrabEnabled,
    grabParticle,
    updatePosition,
    releaseParticle,
    isGrabbing,
    grabbedIndex,
  } = useGrab();

  // State for grabbed particle
  const grabbedParticleOffset = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const originalMassRef = useRef<number | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityHistoryRef = useRef<
    Array<{ x: number; y: number; timestamp: number }>
  >([]);
  const isDraggingRef = useRef<boolean>(false);

  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // No overlay needed for grab tool
  }, []);

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      if (!engine || !isActive) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };
      lastMousePosRef.current = { x: sx, y: sy };

      const w = screenToWorld(sx, sy);
      const particles = await engine.getParticles();

      // Find closest particle to grab
      let bestI = -1;
      let bestD2 = Infinity;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.mass === 0) continue; // Skip fixed particles

        const dx = p.position.x - w.x;
        const dy = p.position.y - w.y;
        const d2 = dx * dx + dy * dy;
        const pickR = Math.max(12 / Math.max(zoom, 0.0001), p.size);

        if (d2 < pickR * pickR && d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
        }
      }

      if (bestI !== -1) {
        const particle = particles[bestI];

        // Store original mass and pin the particle to prevent joint constraints
        originalMassRef.current = particle.mass;

        // Store offset from mouse to particle center
        grabbedParticleOffset.current = {
          x: particle.position.x - w.x,
          y: particle.position.y - w.y,
        };

        // Use grab module to handle the grabbed particle
        setGrabEnabled(true);
        const targetPos = {
          x: w.x + grabbedParticleOffset.current.x,
          y: w.y + grabbedParticleOffset.current.y,
        };
        grabParticle(bestI, targetPos);

        isDraggingRef.current = true;
        velocityHistoryRef.current = [{ x: 0, y: 0, timestamp: Date.now() }];
      }
    },

    onMouseMove: async (ev) => {
      if (!engine || !isActive) return;

      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;

      // Update velocity history for momentum calculation
      const now = Date.now();
      const deltaX = sx - mousePosRef.current.x;
      const deltaY = sy - mousePosRef.current.y;

      mousePosRef.current = { x: sx, y: sy };

      if (isDraggingRef.current && isGrabbing()) {
        const w = screenToWorld(sx, sy);

        // Move particle to mouse position plus offset using grab module
        const newPos = {
          x: w.x + grabbedParticleOffset.current.x,
          y: w.y + grabbedParticleOffset.current.y,
        };

        // Use grab module to update position (no particle array sync needed)
        updatePosition(newPos);

        // Track velocity for momentum
        velocityHistoryRef.current.push({
          x: deltaX,
          y: deltaY,
          timestamp: now,
        });

        // Keep only recent history (last 100ms)
        velocityHistoryRef.current = velocityHistoryRef.current.filter(
          (v) => now - v.timestamp < 100
        );
      }
    },

    onMouseUp: async (ev) => {
      if (!engine || !isActive || !isGrabbing()) return;

      if (isDraggingRef.current) {
        // Release grab using grab module
        releaseParticle();
        setGrabEnabled(false);

        const particles = await engine.getParticles();
        if (particles[grabbedIndex] && originalMassRef.current !== null) {
          // Check if Ctrl/Cmd is held to keep particle pinned
          const keepPinned = ev && (ev.ctrlKey || ev.metaKey);

          // Restore original mass only if it wasn't originally pinned AND Ctrl/Cmd is not held
          if (originalMassRef.current > 0 && !keepPinned) {
            particles[grabbedIndex].mass = originalMassRef.current;
          }

          // Calculate momentum velocity from recent mouse movement
          const now = Date.now();
          const recentMovements = velocityHistoryRef.current.filter(
            (v) => now - v.timestamp < 50 // Last 50ms
          );

          let avgVelX = 0;
          let avgVelY = 0;

          if (recentMovements.length > 1) {
            // Calculate average velocity
            for (const movement of recentMovements) {
              avgVelX += movement.x;
              avgVelY += movement.y;
            }
            avgVelX /= recentMovements.length;
            avgVelY /= recentMovements.length;

            // Scale velocity based on zoom and apply momentum
            const momentumScale = 30.0 / zoom; // Increased from 1.5 to 3.0
            const throwVelocity = {
              x: avgVelX * momentumScale,
              y: avgVelY * momentumScale,
            };

            // Apply velocity to particle (only if not originally pinned and not keeping pinned)
            if (originalMassRef.current > 0 && !keepPinned) {
              particles[grabbedIndex].velocity = throwVelocity;
            }
          }

          // Single particle array sync for throw velocity (acceptable performance cost)
          engine.setParticles(particles);
        }
      }

      // Reset grab state
      originalMassRef.current = null;
      isDraggingRef.current = false;
      velocityHistoryRef.current = [];
    },
  };

  return {
    renderOverlay,
    handlers,
    isGrabbing: isGrabbing(),
  };
}
