import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../../useEngine";
import { useHistory } from "../../useHistory";
import type { Command } from "../../../types/history";
import { useInit } from "../../useInit";
import { calculateMassFromSize } from "../../../utils/particle";
import { ToolState, ToolHandlers, ToolRenderFunction } from "../types";
import { parseColor, useRandomColorSelector } from "../utils";

// Spawn tool specific state interface
interface SpawnToolState extends ToolState {
  // Mouse tracking
  mouseX: number;
  mouseY: number;

  // Drag state
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartTime: number;

  // Size management
  currentSize: number;
  lockedSize: number;

  // Mode and controls
  dragMode: "size" | "velocity" | "neutral";
  isCtrlPressed: boolean;
  previousCtrlPressed: boolean;
  isShiftPressed: boolean;

  // Streaming state
  isStreaming: boolean;
  streamIntervalId: number | null;

  // Color for current spawn
  selectedColor: string;
}

export function useSpawnTool(isActive: boolean) {
  const { screenToWorld, addParticle, zoom } = useEngine();
  const { beginTransaction, appendToTransaction, commitTransaction } =
    useHistory();
  const { particleSize, colors } = useInit();

  // Tool-specific state
  const state = useRef<SpawnToolState>({
    isActive,
    mousePosition: { x: 0, y: 0 },

    // Mouse tracking
    mouseX: 0,
    mouseY: 0,

    // Drag state
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartTime: 0,

    // Size management
    currentSize: particleSize,
    lockedSize: particleSize,

    // Mode and controls
    dragMode: "velocity",
    isCtrlPressed: false,
    previousCtrlPressed: false,
    isShiftPressed: false,

    // Streaming state
    isStreaming: false,
    streamIntervalId: null,

    // Color for current spawn
    selectedColor: "#ffffff", // Will be set on first use
  });

  const dragThreshold = 10;
  const BASE_STREAM_RATE_MS = 100; // Base streaming rate

  const selectRandomColor = useRandomColorSelector(colors);

  // Function to spawn a single particle with current state (undoable, appended to current transaction)
  const spawnParticleWithCurrentState = useCallback(async () => {
    if (!addParticle || !screenToWorld) return;

    const worldPos = screenToWorld(
      state.current.dragStartX,
      state.current.dragStartY
    );
    const color = parseColor(state.current.selectedColor);
    const size = state.current.currentSize;
    const mass = calculateMassFromSize(size);

    let velocity = { x: 0, y: 0 };
    if (state.current.dragMode === "velocity") {
      const dx = state.current.mouseX - state.current.dragStartX;
      const dy = state.current.mouseY - state.current.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const baseVelocityScale = 5.0;
      const velocityScale = baseVelocityScale / Math.sqrt(zoom);
      const maxVelocityDistance = 150;
      const clampedDistance = Math.min(distance, maxVelocityDistance);
      const normalizedDx = distance > 0 ? (dx / distance) * clampedDistance : 0;
      const normalizedDy = distance > 0 ? (dy / distance) * clampedDistance : 0;
      velocity = {
        x: normalizedDx * velocityScale,
        y: normalizedDy * velocityScale,
      };
    }

    let createdIndex: number | null = null;
    const cmd: Command = {
      id: crypto.randomUUID(),
      label: "Spawn particle",
      timestamp: Date.now(),
      do: async (ctx: { engine: any }) => {
        addParticle({ position: worldPos, velocity, size, mass, color });
        // Resolve created index from engine after it applies
        if (ctx.engine?.getParticles) {
          const particles = await ctx.engine.getParticles();
          createdIndex = particles.length - 1;
        }
      },
      undo: async (ctx: { engine: any }) => {
        if (!ctx.engine || createdIndex == null) return;
        const particles = await ctx.engine.getParticles();
        const updated = particles.map((p: any, idx: number) =>
          idx === createdIndex ? { ...p, mass: 0 } : p
        );
        ctx.engine.setParticles(updated);
      },
    } as unknown as Command;

    appendToTransaction(cmd);
  }, [addParticle, screenToWorld, zoom, appendToTransaction]);

  // Calculate dynamic streaming rate based on particle size and velocity
  const calculateStreamingRate = useCallback(() => {
    const size = state.current.currentSize;
    let velocity = { x: 0, y: 0 };

    if (state.current.dragMode === "velocity") {
      const dx = state.current.mouseX - state.current.dragStartX;
      const dy = state.current.mouseY - state.current.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const baseVelocityScale = 5.0;
      const velocityScale = baseVelocityScale / Math.sqrt(zoom);
      const maxVelocityDistance = 150;
      const clampedDistance = Math.min(distance, maxVelocityDistance);
      const normalizedDx = distance > 0 ? (dx / distance) * clampedDistance : 0;
      const normalizedDy = distance > 0 ? (dy / distance) * clampedDistance : 0;
      velocity = {
        x: normalizedDx * velocityScale,
        y: normalizedDy * velocityScale,
      };
    }

    const velocityMagnitude = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y
    );

    // Rate factors:
    // - Larger particles need more spacing (size factor increases interval)
    // - Faster particles can be spawned more frequently (velocity factor decreases interval)
    // - Use a more gradual curve for size factor to not penalize small particles too much
    const sizeFactor = Math.max(0.5, size / 25); // Less aggressive scaling: size 5 = 0.5x, size 25 = 1x, size 50 = 2x
    const velocityFactor = Math.max(0.5, 100 / Math.max(velocityMagnitude, 1)); // Faster particles = higher rate (shorter interval)
    const combinedFactor = sizeFactor * velocityFactor;

    const dynamicRate = Math.max(
      30,
      state.current.dragMode === "velocity" && velocityMagnitude > 0
        ? BASE_STREAM_RATE_MS * combinedFactor * 4
        : BASE_STREAM_RATE_MS * sizeFactor
    ); // Min 30ms
    return Math.min(dynamicRate, 400); // Max 400ms
  }, [zoom]);

  // Function to start streaming particles
  const startStreaming = useCallback(() => {
    if (state.current.isStreaming) return;

    state.current.isStreaming = true;

    const streamParticle = () => {
      if (!state.current.isStreaming) return;

      spawnParticleWithCurrentState();

      // Calculate new rate based on current state and schedule next spawn
      const nextRate = calculateStreamingRate();
      state.current.streamIntervalId = window.setTimeout(
        streamParticle,
        nextRate
      );
    };

    // Start first particle immediately
    streamParticle();
  }, [spawnParticleWithCurrentState, calculateStreamingRate]);

  // Function to stop streaming particles
  const stopStreaming = useCallback(() => {
    if (!state.current.isStreaming) return;

    state.current.isStreaming = false;
    if (state.current.streamIntervalId !== null) {
      clearTimeout(state.current.streamIntervalId);
      state.current.streamIntervalId = null;
    }
  }, []);

  // Set initial color when entering spawn mode and handle cleanup
  useEffect(() => {
    if (isActive && state.current.selectedColor === "#ffffff") {
      state.current.selectedColor = selectRandomColor();
    }
    // Stop streaming when exiting spawn mode
    if (!isActive) {
      stopStreaming();
    }
  }, [isActive, selectRandomColor, stopStreaming]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  // Global key event listeners to handle shift key state and ESC cancellation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !state.current.isShiftPressed) {
        state.current.isShiftPressed = true;
        // Start streaming if we're in spawn mode and have a valid drag position
        if (isActive && state.current.dragStartTime > 0) {
          startStreaming();
        }
      }

      if (e.key === "Escape" && isActive && state.current.dragStartTime > 0) {
        // Cancel current drag operation without spawning particle
        e.preventDefault();

        // Stop streaming if active
        stopStreaming();

        // Reset drag state without spawning
        state.current.dragStartTime = 0;
        state.current.isDragging = false;
        state.current.isShiftPressed = false;
        state.current.currentSize = particleSize;
        state.current.selectedColor = selectRandomColor(); // New color for next spawn
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift" && state.current.isShiftPressed) {
        state.current.isShiftPressed = false;
        // Stop streaming immediately when shift is released
        stopStreaming();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isActive,
    startStreaming,
    stopStreaming,
    particleSize,
    selectRandomColor,
  ]);

  // Tool handlers
  const updateMousePosition = useCallback((mouseX: number, mouseY: number) => {
    state.current.mouseX = mouseX;
    state.current.mouseY = mouseY;
    state.current.mousePosition = { x: mouseX, y: mouseY };
  }, []);

  const startDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed: boolean = false
    ) => {
      state.current.dragStartX = mouseX;
      state.current.dragStartY = mouseY;
      state.current.dragStartTime = Date.now();
      // Initialize current size from the last chosen size so size adjustments persist
      state.current.currentSize = state.current.lockedSize;
      state.current.isCtrlPressed = ctrlPressed;
      state.current.previousCtrlPressed = ctrlPressed;
      state.current.isShiftPressed = shiftPressed;
      state.current.isDragging = false; // Wait for drag threshold
      state.current.dragMode = ctrlPressed ? "size" : "velocity";
      state.current.selectedColor = selectRandomColor(); // Select color for this spawn

      // Begin transaction for this drag gesture
      beginTransaction("Spawn");

      // Start streaming if shift is pressed
      if (shiftPressed) {
        startStreaming();
      }
    },
    [particleSize, selectRandomColor, startStreaming, beginTransaction]
  );

  const updateDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed: boolean = false
    ) => {
      // Check if we have a valid drag start position
      if (state.current.dragStartTime === 0) return;

      const dx = mouseX - state.current.dragStartX;
      const dy = mouseY - state.current.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const shouldBeDragging = distance > dragThreshold;

      state.current.isCtrlPressed = ctrlPressed;
      const wasShiftPressed = state.current.isShiftPressed;
      state.current.isShiftPressed = shiftPressed;

      if (shouldBeDragging) {
        const dragMode = ctrlPressed ? "size" : "velocity";
        const newSize = Math.max(3, Math.min(50, distance / 2));

        state.current.isDragging = true;
        state.current.dragMode = dragMode;

        if (dragMode === "size") {
          state.current.currentSize = newSize;
          // Lock size when in size mode for future velocity mode
          state.current.lockedSize = newSize;
        } else {
          // In velocity mode, check if mouse is within particle radius
          // Use a minimum radius of 20 pixels for better usability with small particles
          const particleRadius = Math.max(
            20,
            state.current.lockedSize * zoom + 10
          );
          const isWithinParticle = distance <= particleRadius;

          if (isWithinParticle) {
            // Mouse is within particle - exit velocity mode (no arrow, just particle)
            state.current.dragMode = "neutral";
          } else {
            // Mouse is outside particle - show velocity arrow
            state.current.dragMode = "velocity";
          }

          // Use locked size when in velocity mode
          state.current.currentSize = state.current.lockedSize;
        }
      }

      // Handle shift key for streaming
      if (shiftPressed && !wasShiftPressed) {
        // Shift just pressed - start streaming
        startStreaming();
      } else if (!shiftPressed && wasShiftPressed) {
        // Shift just released - stop streaming
        stopStreaming();
      }

      state.current.previousCtrlPressed = ctrlPressed;
    },
    [dragThreshold, startStreaming, stopStreaming, zoom]
  );

  const endDrag = useCallback(async () => {
    if (state.current.dragStartTime === 0 || !addParticle || !screenToWorld)
      return;

    const now = Date.now();
    const clickDuration = now - state.current.dragStartTime;
    const dx = state.current.mouseX - state.current.dragStartX;
    const dy = state.current.mouseY - state.current.dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const wasClick = distance < dragThreshold && clickDuration < 200;

    let didSpawn = false;

    if (wasClick) {
      await spawnParticleWithCurrentState();
      didSpawn = true;
    } else if (state.current.dragMode === "size") {
      // Finalize size selection without spawning; lockedSize already synced in updateDrag
      // No-op: keep currentSize/lockedSize as chosen
    } else {
      await spawnParticleWithCurrentState();
      didSpawn = true;
    }

    // Stop streaming if it was active
    stopStreaming();

    // Reset drag state and select new color for next spawn
    state.current.dragStartTime = 0;
    state.current.isDragging = false;
    state.current.isShiftPressed = false;
    // Keep currentSize as chosen so it persists for future spawns
    if (didSpawn) {
      // Only rotate color after an actual spawn
      state.current.selectedColor = selectRandomColor();
    }

    // Commit transaction for this gesture
    commitTransaction();
  }, [
    addParticle,
    screenToWorld,
    dragThreshold,
    particleSize,
    zoom,
    selectRandomColor,
    stopStreaming,
    commitTransaction,
    spawnParticleWithCurrentState,
  ]);

  // Render function for spawn tool overlay
  const renderOverlay: ToolRenderFunction = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      _canvasSize: { width: number; height: number }
    ) => {
      if (!isActive) return;

      const data = state.current;

      if (data.isDragging) {
        if (data.dragMode === "neutral") {
          // Draw solid particle at drag start position with dashed circle (no velocity arrow)
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = "rgb(255, 255, 255)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(
            data.dragStartX,
            data.dragStartY,
            screenSize + gap,
            0,
            2 * Math.PI
          );
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (data.dragMode === "velocity") {
          // Draw solid particle at drag start position
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = "rgb(255, 255, 255)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(
            data.dragStartX,
            data.dragStartY,
            screenSize + gap,
            0,
            2 * Math.PI
          );
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw velocity arrow with capped length, starting from dashed circle edge
          const dx = data.mouseX - data.dragStartX;
          const dy = data.mouseY - data.dragStartY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxArrowLength = 150;

          // Calculate arrow start point at the edge of the dashed circle
          const circleRadius = screenSize + gap;
          const angle = Math.atan2(dy, dx);
          const startX = data.dragStartX + Math.cos(angle) * circleRadius;
          const startY = data.dragStartY + Math.sin(angle) * circleRadius;

          let endX = data.mouseX;
          let endY = data.mouseY;

          if (distance > maxArrowLength) {
            const scale = maxArrowLength / distance;
            endX = data.dragStartX + dx * scale;
            endY = data.dragStartY + dy * scale;
          }

          ctx.strokeStyle = "rgb(255, 255, 255)";
          ctx.lineWidth = 1; // Match the dashed circle line width
          ctx.setLineDash([4, 4]); // Match the dashed circle pattern
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw solid triangle arrowhead
          const arrowHeadLength = 8;
          const arrowAngle = Math.PI / 6;

          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.setLineDash([]); // Ensure no dashes for arrowhead
          ctx.beginPath();
          ctx.moveTo(endX, endY); // Arrow tip
          ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angle - arrowAngle),
            endY - arrowHeadLength * Math.sin(angle - arrowAngle)
          );
          ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angle + arrowAngle),
            endY - arrowHeadLength * Math.sin(angle + arrowAngle)
          );
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw solid particle with current size at drag start position
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = "rgb(255, 255, 255)";
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = "rgb(255, 255, 255)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(
            data.dragStartX,
            data.dragStartY,
            screenSize + gap,
            0,
            2 * Math.PI
          );
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw indicator line from dashed circle edge to mouse position (capped like velocity arrow)
          const dx = data.mouseX - data.dragStartX;
          const dy = data.mouseY - data.dragStartY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxLineLength = 150; // Same as maxArrowLength in velocity mode
          const circleRadius = screenSize + gap;
          const headCircleRadius = 4;

          // Only draw line if there's enough space (head circle doesn't touch dashed circle)
          const minDistanceToRender = circleRadius + headCircleRadius;

          if (distance > minDistanceToRender) {
            // Draw line from dashed circle edge to mouse position (or capped position)
            const angle = Math.atan2(dy, dx);
            const startX = data.dragStartX + Math.cos(angle) * circleRadius;
            const startY = data.dragStartY + Math.sin(angle) * circleRadius;

            let endX = data.mouseX;
            let endY = data.mouseY;

            if (distance > maxLineLength) {
              const scale = maxLineLength / distance;
              endX = data.dragStartX + dx * scale;
              endY = data.dragStartY + dy * scale;
            }

            ctx.strokeStyle = "rgb(255, 255, 255)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw small circle at line end position
            ctx.fillStyle = "rgb(255, 255, 255)";
            ctx.beginPath();
            ctx.arc(endX, endY, headCircleRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      } else if (data.dragStartTime > 0) {
        // Draw particle at drag start position (before reaching drag threshold)
        const hoverSize = data.currentSize * zoom; // Apply zoom to hover preview and honor persisted size

        // Draw solid particle
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.beginPath();
        ctx.arc(data.dragStartX, data.dragStartY, hoverSize, 0, 2 * Math.PI);
        ctx.fill();

        // Draw dashed circle around particle with gap
        const gap = 4; // Keep gap constant regardless of zoom
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(
          data.dragStartX,
          data.dragStartY,
          hoverSize + gap,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Draw hover preview at mouse position - solid particle with dashed circle
        const hoverSize = data.currentSize * zoom; // Apply zoom to hover preview and honor persisted size

        // Draw solid particle
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.beginPath();
        ctx.arc(data.mouseX, data.mouseY, hoverSize, 0, 2 * Math.PI);
        ctx.fill();

        // Draw dashed circle around particle with gap
        const gap = 4; // Keep gap constant regardless of zoom
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(data.mouseX, data.mouseY, hoverSize + gap, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;
    },
    [isActive, particleSize, zoom]
  );

  // Mouse handlers - only active when spawn tool is active
  const handlers: ToolHandlers = {
    onMouseDown: () => {
      // Spawn tool mouse down is handled by CanvasOverlay component
    },
    onMouseMove: () => {
      // Spawn tool mouse move is handled by CanvasOverlay component
    },
    onMouseUp: () => {
      // Spawn tool mouse up is handled by CanvasOverlay component
    },
  };

  return {
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,
    renderOverlay,
    handlers,
    state: state.current,
  };
}
