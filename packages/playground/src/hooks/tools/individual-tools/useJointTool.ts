import { useCallback, useEffect } from "react";
import { ToolHandlers, ToolRenderFunction } from "../types";
import { useEngine } from "../../useEngine";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { useJoints } from "../../modules/useJoints";
import { useLines } from "../../modules/useLines";

// Shared module-level state for joint tool to synchronize overlay and handlers across multiple hook instances
type JointToolState = {
  selectedIndex: number | null;
  selectedParticlePos: { x: number; y: number } | null;
  selectedParticleScreenPos: { x: number; y: number } | null;
  mouseX: number;
  mouseY: number;
};

const jointToolState: JointToolState = {
  selectedIndex: null,
  selectedParticlePos: null,
  selectedParticleScreenPos: null,
  mouseX: 0,
  mouseY: 0,
};

export function useJointTool(isActive: boolean) {
  const { engine, screenToWorld, camera, zoom, size } = useEngine();
  const joints = useJoints();
  const lines = useLines();
  const { executeCommand } = useHistory();
  const state = jointToolState;

  // Convert world coordinates to screen coordinates (mirror of screenToWorld)
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const centerX = size.width / 2;
      const centerY = size.height / 2;
      const screenX = centerX + (worldX - camera.x) * zoom;
      const screenY = centerY + (worldY - camera.y) * zoom;
      return { x: screenX, y: screenY };
    },
    [camera, zoom, size]
  );

  // Global keyboard event listener for ESC key
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.selectedIndex !== null) {
        // Cancel joint creation
        state.selectedIndex = null;
        state.selectedParticlePos = null;
        state.selectedParticleScreenPos = null;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, state]);

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx, _size, mouse) => {
      if (!isActive) return;
      const mp = mouse ?? { x: state.mouseX, y: state.mouseY };
      const circleRadius = 6;

      // Draw line from selected particle to mouse (center) and to circle edge
      const selectedPos = state.selectedParticlePos;
      const selectedScreen = state.selectedParticleScreenPos;
      if (selectedPos || selectedScreen) {
        const particleScreen = selectedScreen
          ? selectedScreen
          : worldToScreen(selectedPos!.x, selectedPos!.y);

        // Calculate direction from particle to mouse to find circle edge
        const dx = mp.x - particleScreen.x;
        const dy = mp.y - particleScreen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Dashed line to the circle edge for preview
        if (distance > 0.0001) {
          const circleEdgeX = mp.x - (dx / distance) * circleRadius;
          const circleEdgeY = mp.y - (dy / distance) * circleRadius;
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(particleScreen.x, particleScreen.y);
          ctx.lineTo(circleEdgeX, circleEdgeY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Draw circle at mouse position with matching style (always show when active)
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // DEBUG: show selection/mouse info to verify state flow
      try {
        const selIdx = state.selectedIndex;
        const selPos = state.selectedParticleScreenPos;
        ctx.save();
        ctx.fillStyle = "rgba(0, 255, 128, 0.9)";
        ctx.font = "12px sans-serif";
        const debugText = `joint overlay | sel=${selIdx ?? "-"} | sp=(${
          selPos?.x?.toFixed?.(1) ?? "-"
        },${selPos?.y?.toFixed?.(1) ?? "-"}) | m=(${mp.x.toFixed(
          1
        )},${mp.y.toFixed(1)})`;
        ctx.fillText(debugText, 12, 18);
        ctx.restore();
      } catch {}
    },
    [worldToScreen, isActive, state]
  );

  const handlers: ToolHandlers = {
    onMouseDown: async (ev) => {
      if (!engine || !isActive) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.mouseX = sx;
      state.mouseY = sy;
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
        if (state.selectedIndex == null) {
          state.selectedIndex = bestI;
          // Copy the position to avoid depending on internal engine object references
          const p = particles[bestI].position;
          state.selectedParticlePos = { x: p.x, y: p.y };
          state.selectedParticleScreenPos = { x: sx, y: sy };
        } else {
          const a = state.selectedIndex;
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

            // Execute as undoable command
            const cmd: Command = {
              id: crypto.randomUUID(),
              label: `Create joint (${a} - ${b})`,
              timestamp: Date.now(),
              do: () => {
                joints.addJoint({ aIndex: a, bIndex: b, restLength: rest });
                lines.addLine({ aIndex: a, bIndex: b });
              },
              undo: () => {
                joints.removeJoint(a, b);
                lines.removeLine(a, b);
              },
            } as unknown as Command;
            await executeCommand(cmd);
          }

          // Check if ctrl/cmd is pressed to chain joints
          if (ev.ctrlKey || ev.metaKey) {
            // Start new joint with the second particle as the first
            state.selectedIndex = b;
            const pbPos = particles[b].position;
            state.selectedParticlePos = { x: pbPos.x, y: pbPos.y };
            state.selectedParticleScreenPos = { x: sx, y: sy };
          } else {
            // Normal behavior - clear selection
            state.selectedIndex = null;
            state.selectedParticlePos = null;
            state.selectedParticleScreenPos = null;
          }
        }
      }
    },
    onMouseMove: (ev) => {
      if (!isActive) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
      state.mouseX = ev.clientX - rect.left;
      state.mouseY = ev.clientY - rect.top;
    },
    onMouseUp: () => {},
  };

  return {
    renderOverlay,
    handlers,
  };
}
