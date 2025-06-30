import { useRef, useCallback } from "react";
import { ParticleSystem, Canvas2DRenderer, Vector2D } from "@party/core";
import { getMousePosition } from "../utils/mouse";
import { getDistance } from "../utils/distance";
import { createParticle, calculateParticleSize } from "../utils/particle";
import { calculateVelocity } from "../utils/velocity";

// Streaming configuration
const STREAM_SPAWN_RATE = 10; // particles per second
const STREAM_SPAWN_INTERVAL = 1000 / STREAM_SPAWN_RATE; // milliseconds between spawns

interface MouseState {
  isDown: boolean;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  isDragging: boolean;
  dragThreshold: number;
  previewColor: string;
  // Streaming state
  isStreaming: boolean;
  streamInterval: number | null;
  streamSize: number;
  streamPosition: { x: number; y: number };
  shiftPressed: boolean;
  wasStreaming: boolean;
  activeStreamSize: number;
  // Velocity mode state
  cmdPressed: boolean;
  isDragToVelocity: boolean;
  initialVelocity: { x: number; y: number };
  velocityModeSize: number;
  activeVelocitySize: number;
}

interface UseSpawnerProps {
  getSystem: () => ParticleSystem | null;
  getRenderer: () => Canvas2DRenderer | null;
  getCanvas: () => HTMLCanvasElement | null;
}

export function useInteractions({
  getSystem,
  getRenderer,
  getCanvas,
}: UseSpawnerProps) {
  const mouseStateRef = useRef<MouseState>({
    isDown: false,
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    isDragging: false,
    dragThreshold: 5,
    previewColor: "",
    isStreaming: false,
    streamInterval: null,
    streamSize: 0,
    streamPosition: { x: 0, y: 0 },
    shiftPressed: false,
    wasStreaming: false,
    activeStreamSize: 0,
    cmdPressed: false,
    isDragToVelocity: false,
    initialVelocity: { x: 0, y: 0 },
    velocityModeSize: 0,
    activeVelocitySize: 0,
  });

  // Streaming functions
  const startStreaming = useCallback(
    (x: number, y: number, size: number) => {
      const mouseState = mouseStateRef.current;
      if (mouseState.isStreaming) {
        stopStreaming();
      }

      mouseState.isStreaming = true;
      mouseState.streamPosition = { x, y };
      mouseState.streamSize = size;

      // Spawn the first particle immediately at the exact position
      const system = getSystem();
      if (system) {
        const firstParticle = createParticle(x, y, size);
        system.addParticle(firstParticle);
      }

      // Then start the interval for subsequent particles
      mouseState.streamInterval = window.setInterval(() => {
        const system = getSystem();
        if (system) {
          const particle = createParticle(
            mouseState.streamPosition.x,
            mouseState.streamPosition.y,
            mouseState.streamSize
          );
          system.addParticle(particle);
        }
      }, STREAM_SPAWN_INTERVAL);
    },
    [getSystem]
  );

  const stopStreaming = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
      mouseState.streamInterval = null;
    }
    mouseState.isStreaming = false;
  }, []);

  // Helper function to update velocity preview
  const updateVelocityPreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    const velocity = calculateVelocity(
      mouseState.startPos,
      mouseState.currentPos
    );
    mouseState.initialVelocity = velocity;

    // Show velocity arrow preview
    renderer.setPreviewVelocity(new Vector2D(velocity.x, velocity.y));

    // Also update the particle preview to show as dashed (drag mode style) in velocity mode
    const previewParticle = createParticle(
      mouseState.startPos.x,
      mouseState.startPos.y,
      mouseState.velocityModeSize,
      mouseState.previewColor
    );
    renderer.setPreviewParticle(previewParticle, true); // true = show as dashed
  }, [getRenderer]);

  // Helper function to update size preview
  const updateSizePreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    const distance = getDistance(mouseState.startPos, mouseState.currentPos);
    const size = calculateParticleSize(
      distance,
      mouseState.isDragging,
      mouseState.dragThreshold
    );
    const previewParticle = createParticle(
      mouseState.startPos.x,
      mouseState.startPos.y,
      size,
      mouseState.previewColor
    );
    renderer.setPreviewParticle(previewParticle, mouseState.isDragging);
  }, [getRenderer]);

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mouseState = mouseStateRef.current;

      if (e.key === "Shift") {
        mouseState.shiftPressed = true;

        // If mouse is down and we're not streaming yet, start streaming
        if (mouseState.isDown && !mouseState.isStreaming) {
          const distance = getDistance(
            mouseState.startPos,
            mouseState.currentPos
          );
          const size = calculateParticleSize(
            distance,
            mouseState.isDragging,
            mouseState.dragThreshold
          );
          startStreaming(mouseState.startPos.x, mouseState.startPos.y, size);
        }
      }

      // Handle CMD (Mac) or Ctrl (Windows/Linux) key
      if (e.key === "Meta" || e.key === "Control") {
        // Ignore CMD/Ctrl when shift is pressed (streaming mode)
        if (!mouseState.shiftPressed) {
          mouseState.cmdPressed = true;

          // If mouse is down, switch to velocity mode
          if (mouseState.isDown && !mouseState.isStreaming) {
            mouseState.isDragToVelocity = true;
            // Clear any existing velocity preview and update with current mouse position
            if (mouseState.currentPos) {
              updateVelocityPreview();
            }
          }
        }
      }
    },
    [startStreaming, updateVelocityPreview]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const mouseState = mouseStateRef.current;

      if (e.key === "Shift") {
        mouseState.shiftPressed = false;
        mouseState.activeStreamSize = 0; // Reset stream size when shift is released
        if (mouseState.isStreaming) {
          stopStreaming();
          mouseState.wasStreaming = true;
        }
      }

      // Handle CMD (Mac) or Ctrl (Windows/Linux) key release
      if (e.key === "Meta" || e.key === "Control") {
        mouseState.cmdPressed = false;
        mouseState.activeVelocitySize = 0; // Reset velocity size when cmd is released

        // If mouse is down, switch back to size mode
        if (mouseState.isDown && !mouseState.isStreaming) {
          const renderer = getRenderer();
          if (renderer) {
            mouseState.isDragToVelocity = false;
            // Clear velocity preview and show size preview instead
            renderer.setPreviewVelocity(null);
            updateSizePreview();
          }
        }
      }
    },
    [stopStreaming, updateSizePreview, getRenderer]
  );

  // Mouse event handlers
  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      const canvas = getCanvas();
      const renderer = getRenderer();
      if (!canvas || !renderer) return;

      const mouseState = mouseStateRef.current;
      const pos = getMousePosition(e, canvas);

      // Ensure canvas has focus for keyboard events
      canvas.focus();

      // Reset streaming state for new interaction - use ONLY the mouse event's modifier keys
      const wasShiftPressedBefore = mouseState.shiftPressed;
      const wasCmdPressedBefore = mouseState.cmdPressed;
      mouseState.shiftPressed = e.shiftKey;
      mouseState.cmdPressed = e.metaKey || e.ctrlKey;
      mouseState.wasStreaming = false; // Reset for new interaction
      mouseState.isStreaming = false; // Make sure we're not streaming from previous interaction
      mouseState.isDragToVelocity =
        mouseState.cmdPressed && !mouseState.shiftPressed; // Set initial mode
      mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity

      // Set the size for velocity mode
      if (mouseState.isDragToVelocity) {
        let velocitySize;
        if (mouseState.activeVelocitySize > 0) {
          // Use the preserved size from previous drag-to-velocity
          velocitySize = mouseState.activeVelocitySize;
        } else {
          // Use default size for first cmd+click
          const spawnConfig = (window as any).__getSpawnConfig?.();
          velocitySize = spawnConfig?.particleSize || 10;
          mouseState.activeVelocitySize = velocitySize; // Store for subsequent clicks
        }
        mouseState.velocityModeSize = velocitySize;
      }

      // If shift was released between interactions, reset the active stream size
      if (wasShiftPressedBefore && !mouseState.shiftPressed) {
        mouseState.activeStreamSize = 0;
      }

      // If cmd was released between interactions, reset the active velocity size
      if (wasCmdPressedBefore && !mouseState.cmdPressed) {
        mouseState.activeVelocitySize = 0;
      }

      // Update threshold from current spawn config
      const spawnConfig = (window as any).__getSpawnConfig?.();
      if (spawnConfig?.dragThreshold !== undefined) {
        mouseState.dragThreshold = spawnConfig.dragThreshold;
      }

      mouseState.isDown = true;
      mouseState.startPos = pos;
      mouseState.currentPos = pos;
      mouseState.isDragging = false;

      // Pick a random color for this drag session and store it
      mouseState.previewColor = "#F8F8F8"; // Will be updated by createParticle

      // If shift is pressed during mouse down, start streaming immediately
      if (mouseState.shiftPressed) {
        let streamSize;
        if (mouseState.activeStreamSize > 0) {
          // Use the preserved size from previous drag-to-size
          streamSize = mouseState.activeStreamSize;
        } else {
          // Use default size for first shift+click
          streamSize = spawnConfig?.particleSize || 10;
          mouseState.activeStreamSize = streamSize; // Store for subsequent clicks
        }
        startStreaming(pos.x, pos.y, streamSize);
        mouseState.wasStreaming = true; // Mark that we were streaming
        return; // Don't show preview when streaming
      }

      // Create and show preview particle with the selected color
      const distance = 0;
      const size = calculateParticleSize(
        distance,
        mouseState.isDragging,
        mouseState.dragThreshold
      );
      const previewParticle = createParticle(
        pos.x,
        pos.y,
        size,
        mouseState.previewColor
      );

      // Show particle preview - dashed if in velocity mode, normal if in size mode
      renderer.setPreviewParticle(previewParticle, mouseState.isDragToVelocity);

      // If in velocity mode, also initialize velocity preview
      if (mouseState.isDragToVelocity) {
        renderer.setPreviewVelocity(new Vector2D(0, 0)); // Start with zero velocity
      }
    },
    [getCanvas, getRenderer, startStreaming]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = getCanvas();
      const renderer = getRenderer();
      if (!canvas || !renderer) return;

      const pos = getMousePosition(e, canvas);
      
      // Always update cursor position for density display
      if (renderer.setCursorPosition) {
        renderer.setCursorPosition(new Vector2D(pos.x, pos.y));
      }

      const mouseState = mouseStateRef.current;
      if (!mouseState.isDown) return;

      mouseState.currentPos = pos;

      // Update modifier key states from mouse event
      const wasShiftPressed = mouseState.shiftPressed;
      const wasCmdPressed = mouseState.cmdPressed;
      mouseState.shiftPressed = e.shiftKey;
      mouseState.cmdPressed = e.metaKey || e.ctrlKey;

      // If shift was just released during streaming, stop streaming
      if (
        wasShiftPressed &&
        !mouseState.shiftPressed &&
        mouseState.isStreaming
      ) {
        stopStreaming();
        mouseState.wasStreaming = true; // Mark that we were streaming
        // Don't show preview again - user already placed particles via streaming
      }

      // If shift was just pressed during mouse move, start streaming (ignore CMD in streaming mode)
      if (
        !wasShiftPressed &&
        mouseState.shiftPressed &&
        !mouseState.isStreaming
      ) {
        const distance = getDistance(
          mouseState.startPos,
          mouseState.currentPos
        );
        const size = calculateParticleSize(
          distance,
          mouseState.isDragging,
          mouseState.dragThreshold
        );
        mouseState.activeStreamSize = size; // Store this size for subsequent clicks
        startStreaming(mouseState.startPos.x, mouseState.startPos.y, size);
        mouseState.wasStreaming = true; // Mark that we were streaming
        // Hide the preview particle when streaming starts
        renderer.setPreviewParticle(null, false);
        renderer.setPreviewVelocity(null); // Clear velocity preview
        return;
      }

      // If we're streaming, update the stream position to follow the cursor
      if (mouseState.isStreaming) {
        mouseState.streamPosition = { x: pos.x, y: pos.y };
        return; // Don't update preview when streaming
      }

      // If we were streaming during this session, don't show preview
      if (mouseState.wasStreaming) {
        return;
      }

      // Handle CMD/Ctrl mode switching (only when not in streaming mode)
      if (!mouseState.shiftPressed) {
        if (!wasCmdPressed && mouseState.cmdPressed) {
          // Just pressed CMD: switch to velocity mode
          mouseState.isDragToVelocity = true;
          // Store the current size for velocity mode
          const distance = getDistance(
            mouseState.startPos,
            mouseState.currentPos
          );
          const currentSize = calculateParticleSize(
            distance,
            mouseState.isDragging,
            mouseState.dragThreshold
          );
          mouseState.velocityModeSize = currentSize;
          mouseState.activeVelocitySize = currentSize; // Store for subsequent clicks
          updateVelocityPreview();
          return;
        } else if (wasCmdPressed && !mouseState.cmdPressed) {
          // Just released CMD: switch to size mode
          mouseState.isDragToVelocity = false;
          renderer.setPreviewVelocity(null); // Clear velocity preview
          updateSizePreview();
          return;
        }
      }

      const distance = getDistance(mouseState.startPos, pos);

      // Check if we should enter drag mode
      if (distance >= mouseState.dragThreshold) {
        mouseState.isDragging = true;
      }

      // Update preview based on current mode
      if (mouseState.isDragToVelocity && !mouseState.shiftPressed) {
        // Velocity mode: update velocity arrow (ignore shift in velocity mode)
        updateVelocityPreview();
      } else if (!mouseState.shiftPressed) {
        // Size mode: update particle size (normal behavior when not streaming)
        updateSizePreview();
      }
    },
    [
      getCanvas,
      getRenderer,
      stopStreaming,
      startStreaming,
      updateVelocityPreview,
      updateSizePreview,
    ]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      const system = getSystem();
      const renderer = getRenderer();
      if (!system || !renderer) return;

      const mouseState = mouseStateRef.current;
      if (!mouseState.isDown) return;

      // Update shift state from mouse event
      mouseState.shiftPressed = e.shiftKey;

      // If we're streaming, always stop when mouse is released
      if (mouseState.isStreaming) {
        stopStreaming();
        // Reset mouse state
        mouseState.isDown = false;
        mouseState.isDragging = false;
        mouseState.previewColor = "";
        mouseState.wasStreaming = false; // Reset for next interaction
        return;
      }

      // If we were streaming during this mouse session, don't spawn an extra particle
      if (mouseState.wasStreaming) {
        // Clear preview particle and reset state
        renderer.setPreviewParticle(null, false);
        renderer.setPreviewVelocity(null);
        mouseState.isDown = false;
        mouseState.isDragging = false;
        mouseState.previewColor = "";
        mouseState.wasStreaming = false; // Reset for next interaction
        return;
      }

      let finalParticle;

      if (mouseState.isDragToVelocity) {
        // Velocity mode: create particle with the stored size and initial velocity
        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          mouseState.velocityModeSize, // Use the size that was active when we entered velocity mode
          mouseState.previewColor,
          mouseState.initialVelocity
        );
      } else {
        // Size mode: create particle with drag-to-size
        const distance = getDistance(
          mouseState.startPos,
          mouseState.currentPos
        );
        const size = calculateParticleSize(
          distance,
          mouseState.isDragging,
          mouseState.dragThreshold
        );
        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          size,
          mouseState.previewColor
        );
      }

      system.addParticle(finalParticle);

      // Clear preview particle and velocity
      renderer.setPreviewParticle(null, false);
      renderer.setPreviewVelocity(null);

      // Reset mouse state
      mouseState.isDown = false;
      mouseState.isDragging = false;
      mouseState.previewColor = "";
      mouseState.wasStreaming = false; // Reset for next interaction
      mouseState.isDragToVelocity = false; // Reset velocity mode
      mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity
      mouseState.velocityModeSize = 0; // Reset velocity mode size
    },
    [getSystem, getRenderer, stopStreaming]
  );

  const onMouseLeave = useCallback(() => {
    const renderer = getRenderer();
    if (!renderer) return;

    const mouseState = mouseStateRef.current;
    // Stop streaming when mouse leaves canvas
    if (mouseState.isStreaming) {
      stopStreaming();
    }
    // Clear preview particle and cursor position when mouse leaves canvas
    renderer.setPreviewParticle(null, false);
    renderer.setPreviewVelocity(null);
    if (renderer.setCursorPosition) {
      renderer.setCursorPosition(null);
    }
    mouseState.isDown = false;
    mouseState.isDragging = false;
    mouseState.previewColor = "";
    mouseState.wasStreaming = false; // Reset for next interaction
    mouseState.isDragToVelocity = false; // Reset velocity mode
    mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity
    mouseState.velocityModeSize = 0; // Reset velocity mode size
  }, [getRenderer, stopStreaming]);

  const cleanup = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
    }

    // Remove global keyboard listeners
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);

    const canvas = getCanvas();
    if (canvas) {
      canvas.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("keyup", handleKeyUp);
    }
  }, [getCanvas, handleKeyDown, handleKeyUp]);

  const setupKeyboardListeners = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    // Make canvas focusable
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none"; // Remove focus outline

    // Add global keyboard listeners - these should always work
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Also add to window as backup
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // And to canvas for when it has focus
    canvas.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("keyup", handleKeyUp);

    // Focus the canvas so it can receive keyboard events
    canvas.focus();

    // Add click handler to refocus canvas
    canvas.addEventListener("click", () => {
      canvas.focus();
    });
  }, [getCanvas, handleKeyDown, handleKeyUp]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cleanup,
    setupKeyboardListeners,
  };
}
