import { useCallback, useRef, useEffect } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";

export function useJointTool(isActive: boolean) {
  const { engine, screenToWorld, camera, zoom, size } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const selectedIndexRef = useRef<number | null>(null);
  const selectedParticlePos = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      if (!engine) return { x: worldX, y: worldY };

      const centerX = size.width / 2;
      const centerY = size.height / 2;

      const screenX = centerX + (worldX - camera.x) * zoom;
      const screenY = centerY + (worldY - camera.y) * zoom;

      return { x: screenX, y: screenY };
    },
    [engine, camera, zoom, size]
  );

  // Global keyboard event listener for ESC key
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIndexRef.current !== null) {
        // Cancel joint creation
        selectedIndexRef.current = null;
        selectedParticlePos.current = null;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx) => {
      if (!engine) return;
      const sel = selectedIndexRef.current;
      if (sel == null) return;

      const mp = mousePosRef.current;
      const circleRadius = 6;

      // Draw line from selected particle to edge of circle (not center)
      const selectedPos = selectedParticlePos.current;
      if (selectedPos) {
        const particleScreen = worldToScreen(selectedPos.x, selectedPos.y);

        // Calculate direction from particle to mouse to find circle edge
        const dx = mp.x - particleScreen.x;
        const dy = mp.y - particleScreen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate point on circle edge closest to particle
        const circleEdgeX = mp.x - (dx / distance) * circleRadius;
        const circleEdgeY = mp.y - (dy / distance) * circleRadius;

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,1)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(particleScreen.x, particleScreen.y);
        ctx.lineTo(circleEdgeX, circleEdgeY);
        ctx.stroke();
        ctx.restore();
      }

      // Draw circle at mouse position with matching style
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
    [engine, worldToScreen]
  );

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      if (!engine) return;
      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      mousePosRef.current = { x: sx, y: sy };
      const w = screenToWorld(sx, sy);
      const particles = await engine.getParticles();
      let bestI = -1;
      let bestD2 = Infinity;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.mass === 0) continue;
        const dx = p.position.x - w.x;
        const dy = p.position.y - w.y;
        const d2 = dx * dx + dy * dy;
        const pickR = Math.max(8 / Math.max(engine.getZoom(), 0.0001), p.size);
        if (d2 < pickR * pickR && d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
        }
      }
      if (bestI !== -1) {
        if (selectedIndexRef.current == null) {
          selectedIndexRef.current = bestI;
          selectedParticlePos.current = particles[bestI].position;
        } else {
          const a = selectedIndexRef.current;
          const b = bestI;
          if (a !== b) {
            const pa = particles[a];
            const pb = particles[b];
            const dx = pb.position.x - pa.position.x;
            const dy = pb.position.y - pa.position.y;
            const rest = Math.sqrt(dx * dx + dy * dy);

            // Enable joints module if not already enabled
            if (!joints.enabled) {
              joints.setEnabled(true);
            }

            // Enable joint lines module if not already enabled
            if (!lines.enabled) {
              lines.setEnabled(true);
            }

            joints.addJoint({ aIndex: a, bIndex: b, restLength: rest });
            lines.addLine({ aIndex: a, bIndex: b });
          }

          // Check if ctrl/cmd is pressed to chain joints
          if (ev.ctrlKey || ev.metaKey) {
            // Start new joint with the second particle as the first
            selectedIndexRef.current = b;
            selectedParticlePos.current = particles[b].position;
          } else {
            // Normal behavior - clear selection
            selectedIndexRef.current = null;
            selectedParticlePos.current = null;
          }
        }
      }
    },
    onMouseMove: (ev) => {
      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      mousePosRef.current = {
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
      };
    },
    onMouseUp: () => {},
  };

  return {
    renderOverlay,
    handlers,
  };
}
