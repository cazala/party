import { useCallback, useRef } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useJoints } from "../../modules/useJoints";
import { useJointLines } from "../../modules/useJointLines";

export function useJointTool(_isActive: boolean) {
  const { engine, screenToWorld } = useEngine();
  const { addJoint } = useJoints();
  const jointLines = useJointLines();
  const selectedIndexRef = useRef<number | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx) => {
      if (!engine) return;
      const sel = selectedIndexRef.current;
      if (sel == null) return;
      // Draw a small circle at mouse position to indicate second selection
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      const mp = mousePosRef.current;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
    [engine]
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
        } else {
          const a = selectedIndexRef.current;
          const b = bestI;
          if (a !== b) {
            const pa = particles[a];
            const pb = particles[b];
            const dx = pb.position.x - pa.position.x;
            const dy = pb.position.y - pa.position.y;
            const rest = Math.sqrt(dx * dx + dy * dy);
            addJoint(a, b, rest);
            // Also update joint lines with the new joint
            const currentAIndexes = [...jointLines.aIndexes];
            const currentBIndexes = [...jointLines.bIndexes];
            currentAIndexes.push(a);
            currentBIndexes.push(b);
            jointLines.setJoints(currentAIndexes, currentBIndexes);
          }
          selectedIndexRef.current = null;
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
