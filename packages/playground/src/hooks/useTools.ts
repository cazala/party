import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import {
  setTool,
  toggleTool,
  resetTool,
  selectActiveTool,
  selectIsSpawnMode,
  selectIsRemoveMode,
  selectIsJointMode,
  selectIsGrabMode,
  selectIsPinMode,
  selectIsEmitterMode,
  selectIsCursorMode,
  ToolMode,
} from "../slices/tools";
import { useEngine } from "../hooks/useEngine";
import { useInit } from "../hooks/useInit";
import { calculateMassFromSize } from "../utils/particle";

interface OverlayData {
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

export interface UseToolsReturn {
  // Tool mode management
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  resetToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
  isEmitterMode: boolean;
  isCursorMode: boolean;

  // Overlay functions
  renderOverlay: (
    ctx: CanvasRenderingContext2D,
    canvasSize: { width: number; height: number }
  ) => void;
  updateMousePosition: (mouseX: number, mouseY: number) => void;
  startDrag: (
    mouseX: number,
    mouseY: number,
    ctrlPressed: boolean,
    shiftPressed?: boolean
  ) => void;
  updateDrag: (
    mouseX: number,
    mouseY: number,
    ctrlPressed: boolean,
    shiftPressed?: boolean
  ) => void;
  endDrag: () => void;
}

export function useTools(): UseToolsReturn {
  const dispatch = useAppDispatch();
  const {
    canvasRef,
    isInitialized,
    interaction,
    screenToWorld,
    addParticle,
    zoom,
  } = useEngine();
  const { particleSize, colors } = useInit();

  // Single overlay data ref - everything in one place
  const overlay = useRef<OverlayData>({
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

  // Helper function to randomly select a color
  const selectRandomColor = useCallback(() => {
    if (colors.length === 0) return "#ffffff";
    if (colors.length === 1) return colors[0];
    return colors[Math.floor(Math.random() * colors.length)];
  }, [colors]);

  // Helper function to parse color string to RGBA object
  const parseColor = useCallback((colorStr: string) => {
    // Handle hex colors
    if (colorStr.startsWith("#")) {
      const hex = colorStr.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return { r, g, b, a: 1 };
    }
    // Fallback to white
    return { r: 1, g: 1, b: 1, a: 1 };
  }, []);

  // Function to spawn a single particle with current state
  const spawnParticleWithCurrentState = useCallback(() => {
    if (!addParticle || !screenToWorld) return;

    const worldPos = screenToWorld(
      overlay.current.dragStartX,
      overlay.current.dragStartY
    );
    const color = parseColor(overlay.current.selectedColor);
    const size = overlay.current.currentSize;
    const mass = calculateMassFromSize(size);

    let velocity = { x: 0, y: 0 };
    if (overlay.current.dragMode === "velocity") {
      const dx = overlay.current.mouseX - overlay.current.dragStartX;
      const dy = overlay.current.mouseY - overlay.current.dragStartY;
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

    addParticle({
      position: worldPos,
      velocity,
      size,
      mass,
      color,
    });
  }, [addParticle, screenToWorld, zoom, parseColor]);

  // Calculate dynamic streaming rate based on particle size and velocity
  const calculateStreamingRate = useCallback(() => {
    const size = overlay.current.currentSize;
    let velocity = { x: 0, y: 0 };

    if (overlay.current.dragMode === "velocity") {
      const dx = overlay.current.mouseX - overlay.current.dragStartX;
      const dy = overlay.current.mouseY - overlay.current.dragStartY;
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
      overlay.current.dragMode === "velocity" && velocityMagnitude > 0
        ? BASE_STREAM_RATE_MS * combinedFactor * 4
        : BASE_STREAM_RATE_MS * sizeFactor
    ); // Min 30ms
    return Math.min(dynamicRate, 400); // Max 400ms
  }, [zoom, overlay]);

  // Function to start streaming particles
  const startStreaming = useCallback(() => {
    if (overlay.current.isStreaming) return;

    overlay.current.isStreaming = true;

    const streamParticle = () => {
      if (!overlay.current.isStreaming) return;

      spawnParticleWithCurrentState();

      // Calculate new rate based on current state and schedule next spawn
      const nextRate = calculateStreamingRate();
      overlay.current.streamIntervalId = window.setTimeout(
        streamParticle,
        nextRate
      );
    };

    // Start first particle immediately
    streamParticle();
  }, [spawnParticleWithCurrentState, calculateStreamingRate]);

  // Function to stop streaming particles
  const stopStreaming = useCallback(() => {
    if (!overlay.current.isStreaming) return;

    overlay.current.isStreaming = false;
    if (overlay.current.streamIntervalId !== null) {
      clearTimeout(overlay.current.streamIntervalId);
      overlay.current.streamIntervalId = null;
    }
  }, []);

  // Redux selectors
  const toolMode = useAppSelector(selectActiveTool);
  const isSpawnMode = useAppSelector(selectIsSpawnMode);

  // Set initial color when entering spawn mode and handle cleanup
  useEffect(() => {
    if (isSpawnMode && overlay.current.selectedColor === "#ffffff") {
      overlay.current.selectedColor = selectRandomColor();
    }
    // Stop streaming when exiting spawn mode
    if (!isSpawnMode) {
      stopStreaming();
    }
  }, [isSpawnMode, selectRandomColor, stopStreaming]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  // Global key event listeners to handle shift key state and ESC cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !overlay.current.isShiftPressed) {
        overlay.current.isShiftPressed = true;
        // Start streaming if we're in spawn mode and have a valid drag position
        if (isSpawnMode && overlay.current.dragStartTime > 0) {
          startStreaming();
        }
      }

      if (
        e.key === "Escape" &&
        isSpawnMode &&
        overlay.current.dragStartTime > 0
      ) {
        // Cancel current drag operation without spawning particle
        e.preventDefault();

        // Stop streaming if active
        stopStreaming();

        // Reset drag state without spawning
        overlay.current.dragStartTime = 0;
        overlay.current.isDragging = false;
        overlay.current.isShiftPressed = false;
        overlay.current.currentSize = particleSize;
        overlay.current.selectedColor = selectRandomColor(); // New color for next spawn
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift" && overlay.current.isShiftPressed) {
        overlay.current.isShiftPressed = false;
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
    isSpawnMode,
    startStreaming,
    stopStreaming,
    particleSize,
    selectRandomColor,
  ]);

  const isRemoveMode = useAppSelector(selectIsRemoveMode);
  const isJointMode = useAppSelector(selectIsJointMode);
  const isGrabMode = useAppSelector(selectIsGrabMode);
  const isPinMode = useAppSelector(selectIsPinMode);
  const isEmitterMode = useAppSelector(selectIsEmitterMode);
  const isCursorMode = useAppSelector(selectIsCursorMode);

  // Redux action dispatchers
  const setToolMode = useCallback(
    (mode: ToolMode) => {
      dispatch(setTool(mode));
    },
    [dispatch]
  );

  const toggleToolMode = useCallback(() => {
    dispatch(toggleTool());
  }, [dispatch]);

  const resetToolMode = useCallback(() => {
    dispatch(resetTool());
  }, [dispatch]);

  // Overlay functions
  const updateMousePosition = useCallback((mouseX: number, mouseY: number) => {
    overlay.current.mouseX = mouseX;
    overlay.current.mouseY = mouseY;
  }, []);

  const startDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed: boolean = false
    ) => {
      overlay.current.dragStartX = mouseX;
      overlay.current.dragStartY = mouseY;
      overlay.current.dragStartTime = Date.now();
      overlay.current.currentSize = particleSize;
      overlay.current.lockedSize = particleSize;
      overlay.current.isCtrlPressed = ctrlPressed;
      overlay.current.previousCtrlPressed = ctrlPressed;
      overlay.current.isShiftPressed = shiftPressed;
      overlay.current.isDragging = false; // Wait for drag threshold
      overlay.current.dragMode = ctrlPressed ? "size" : "velocity";
      overlay.current.selectedColor = selectRandomColor(); // Select color for this spawn

      // Start streaming if shift is pressed
      if (shiftPressed) {
        startStreaming();
      }
    },
    [particleSize, selectRandomColor, startStreaming]
  );

  const updateDrag = useCallback(
    (
      mouseX: number,
      mouseY: number,
      ctrlPressed: boolean,
      shiftPressed: boolean = false
    ) => {
      // Check if we have a valid drag start position
      if (overlay.current.dragStartTime === 0) return;

      const dx = mouseX - overlay.current.dragStartX;
      const dy = mouseY - overlay.current.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const shouldBeDragging = distance > dragThreshold;

      overlay.current.isCtrlPressed = ctrlPressed;
      const wasShiftPressed = overlay.current.isShiftPressed;
      overlay.current.isShiftPressed = shiftPressed;

      if (shouldBeDragging) {
        const dragMode = ctrlPressed ? "size" : "velocity";
        const newSize = Math.max(3, Math.min(50, distance / 2));

        overlay.current.isDragging = true;
        overlay.current.dragMode = dragMode;

        if (dragMode === "size") {
          overlay.current.currentSize = newSize;
          // Lock size when in size mode for future velocity mode
          overlay.current.lockedSize = newSize;
        } else {
          // In velocity mode, check if mouse is within particle radius
          // Use a minimum radius of 20 pixels for better usability with small particles
          const particleRadius = Math.max(
            20,
            overlay.current.lockedSize * zoom + 10
          );
          const isWithinParticle = distance <= particleRadius;

          if (isWithinParticle) {
            // Mouse is within particle - exit velocity mode (no arrow, just particle)
            overlay.current.dragMode = "neutral";
          } else {
            // Mouse is outside particle - show velocity arrow
            overlay.current.dragMode = "velocity";
          }

          // Use locked size when in velocity mode
          overlay.current.currentSize = overlay.current.lockedSize;
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

      overlay.current.previousCtrlPressed = ctrlPressed;
    },
    [dragThreshold, startStreaming, stopStreaming]
  );

  const endDrag = useCallback(() => {
    if (overlay.current.dragStartTime === 0 || !addParticle || !screenToWorld)
      return;

    const now = Date.now();
    const clickDuration = now - overlay.current.dragStartTime;
    const dx = overlay.current.mouseX - overlay.current.dragStartX;
    const dy = overlay.current.mouseY - overlay.current.dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const wasClick = distance < dragThreshold && clickDuration < 200;

    const worldPos = screenToWorld(
      overlay.current.dragStartX,
      overlay.current.dragStartY
    );
    const color = parseColor(overlay.current.selectedColor);

    if (wasClick) {
      const size = particleSize;
      const mass = calculateMassFromSize(size);

      addParticle({
        position: worldPos,
        velocity: { x: 0, y: 0 },
        size,
        mass,
        color,
      });
    } else {
      const size = overlay.current.currentSize;
      const mass = calculateMassFromSize(size);

      let velocity = { x: 0, y: 0 };
      if (
        !overlay.current.isCtrlPressed &&
        overlay.current.dragMode === "velocity"
      ) {
        const baseVelocityScale = 5.0;
        const velocityScale = baseVelocityScale / Math.sqrt(zoom); // Square root relationship for more balanced scaling
        const maxVelocityDistance = 150; // Same as maxArrowLength
        const clampedDistance = Math.min(distance, maxVelocityDistance);
        const normalizedDx =
          distance > 0 ? (dx / distance) * clampedDistance : 0;
        const normalizedDy =
          distance > 0 ? (dy / distance) * clampedDistance : 0;
        velocity = {
          x: normalizedDx * velocityScale,
          y: normalizedDy * velocityScale,
        };
      }

      addParticle({
        position: worldPos,
        velocity,
        size,
        mass,
        color,
      });
    }

    // Stop streaming if it was active
    stopStreaming();

    // Reset drag state and select new color for next spawn
    overlay.current.dragStartTime = 0;
    overlay.current.isDragging = false;
    overlay.current.isShiftPressed = false;
    overlay.current.currentSize = particleSize;
    overlay.current.selectedColor = selectRandomColor(); // New color for next spawn
  }, [
    addParticle,
    screenToWorld,
    dragThreshold,
    particleSize,
    zoom,
    parseColor,
    selectRandomColor,
    stopStreaming,
  ]);

  const renderOverlay = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasSize: { width: number; height: number }
    ) => {
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      if (!isSpawnMode) {
        return;
      }

      const data = overlay.current;

      if (data.isDragging) {
        if (data.dragMode === "neutral") {
          // Draw solid particle at drag start position with dashed circle (no velocity arrow)
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = data.selectedColor;
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = data.selectedColor;
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
          ctx.fillStyle = data.selectedColor;
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = data.selectedColor;
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

          ctx.strokeStyle = data.selectedColor;
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

          ctx.fillStyle = data.selectedColor;
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
          ctx.fillStyle = data.selectedColor;
          ctx.beginPath();
          const screenSize = data.currentSize * zoom;
          ctx.arc(data.dragStartX, data.dragStartY, screenSize, 0, 2 * Math.PI);
          ctx.fill();

          // Draw dashed circle around particle with gap
          const gap = 4; // Keep gap constant regardless of zoom
          ctx.strokeStyle = data.selectedColor;
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

            ctx.strokeStyle = data.selectedColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw small circle at line end position
            ctx.fillStyle = data.selectedColor;
            ctx.beginPath();
            ctx.arc(endX, endY, headCircleRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      } else if (data.dragStartTime > 0) {
        // Draw particle at drag start position (before reaching drag threshold)
        const hoverSize = particleSize * zoom; // Apply zoom to hover preview

        // Draw solid particle
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = data.selectedColor;
        ctx.beginPath();
        ctx.arc(data.dragStartX, data.dragStartY, hoverSize, 0, 2 * Math.PI);
        ctx.fill();

        // Draw dashed circle around particle with gap
        const gap = 4; // Keep gap constant regardless of zoom
        ctx.strokeStyle = data.selectedColor;
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
        const hoverSize = particleSize * zoom; // Apply zoom to hover preview

        // Draw solid particle
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = data.selectedColor;
        ctx.beginPath();
        ctx.arc(data.mouseX, data.mouseY, hoverSize, 0, 2 * Math.PI);
        ctx.fill();

        // Draw dashed circle around particle with gap
        const gap = 4; // Keep gap constant regardless of zoom
        ctx.strokeStyle = data.selectedColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(data.mouseX, data.mouseY, hoverSize + gap, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;
    },
    [isSpawnMode, particleSize, zoom]
  );

  const handleMouseDown = useCallback(
    (_e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      switch (toolMode) {
        case "spawn":
          // Skip - CanvasOverlay handles spawn tool mouse events
          break;
        case "remove":
          // TODO: Implement remove tool
          break;
        case "joint":
          // TODO: Implement joint tool
          break;
        case "grab":
          // TODO: Implement grab tool
          break;
        case "pin":
          // TODO: Implement pin tool
          break;
        case "emitter":
          // TODO: Implement emitter tool
          break;
        case "cursor":
        default:
          // No tool-specific action for cursor mode
          break;
      }
    },
    [toolMode, isInitialized, canvasRef]
  );

  const handleMouseMove = useCallback(
    (_e: MouseEvent) => {
      if (!isInitialized || !canvasRef.current) return;

      // Mouse coordinates available for tools if needed
      // const canvas = canvasRef.current;
      // const rect = canvas.getBoundingClientRect();
      // const mouseX = e.clientX - rect.left;
      // const mouseY = e.clientY - rect.top;

      // Handle dragging for other tools (spawn tool handled by CanvasOverlay)
      // TODO: Add drag handling for other tools when implemented

      switch (toolMode) {
        case "grab":
          // TODO: Handle grab tool mouse move
          break;
        case "joint":
          // TODO: Handle joint tool mouse move (preview)
          break;
        default:
          // Most tools don't need mouse move handling
          break;
      }
    },
    [toolMode, isInitialized, canvasRef]
  );

  const handleMouseUp = useCallback(
    (_e: MouseEvent) => {
      if (!isInitialized) return;

      // Handle spawn tool - skip, CanvasOverlay handles this
      if (toolMode === "spawn") {
        return;
      }

      // Handle other tools
      // TODO: Add mouse up handling for other tools when implemented

      switch (toolMode) {
        case "grab":
          // TODO: Handle grab tool mouse up
          break;
        case "joint":
          // TODO: Handle joint tool mouse up
          break;
        default:
          // Most tools don't need mouse up handling
          break;
      }
    },
    [toolMode, isInitialized]
  );

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  // Wire mouse input to Interaction module and Tools
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interaction || !isInitialized) return;

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      interaction.setPosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
      handleMouseMove(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);

      // Handle tools first - if a tool handles the event, don't activate interaction
      handleMouseDown(e);

      // Only activate interaction for cursor mode (when no tool is active)
      if (toolMode === "cursor") {
        interaction.setActive(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      handleMouseUp(e);
      interaction.setActive(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      handleContextMenu(e);
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [
    canvasRef.current,
    interaction,
    isInitialized,
    toolMode,
    screenToWorld,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  ]);

  return {
    // Tool mode management
    toolMode,
    setToolMode,
    toggleToolMode,
    resetToolMode,
    isSpawnMode,
    isRemoveMode,
    isJointMode,
    isGrabMode,
    isPinMode,
    isEmitterMode,
    isCursorMode,

    // Overlay functions
    renderOverlay,
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,
  };
}
