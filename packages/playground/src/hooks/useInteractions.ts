import { useRef, useCallback } from "react";
import {
  ParticleSystem,
  Canvas2DRenderer,
  Vector2D,
  Interaction,
} from "@party/core";
import { getMousePosition } from "../utils/mouse";
import { getDistance } from "../utils/distance";
import {
  createParticle,
  calculateParticleSize,
  getRandomColor,
} from "../utils/particle";
import { calculateVelocity } from "../utils/velocity";

/**
 * Custom React hook that handles all mouse and keyboard interactions for the particle playground.
 * 
 * ## Features:
 * 
 * ### Mouse Controls:
 * - **Click**: Spawn a single particle at cursor position
 * - **Click & Drag**: Set particle size based on drag distance
 * - **Right Click**: Attract particles to cursor position
 * - **Ctrl/⌘ + Right Click**: Repel particles from cursor position
 * 
 * ### Keyboard Modifiers:
 * - **Hold Shift + Click**: Stream particles continuously at cursor
 * - **Hold Ctrl/⌘ + Click & Drag**: Set particle direction and speed (velocity mode)
 * - **Delete/Backspace**: Remove the last spawned particle (up to 50 particles tracked)
 * 
 * ### Advanced Features:
 * - **Mode Switching**: Press Ctrl/⌘ while dragging to switch from size mode to velocity mode
 * - **Particle History**: Tracks up to 50 most recently spawned particles for deletion
 * - **Size Preservation**: Maintains particle size when switching between modes
 * - **Streaming**: Continuous particle spawning with adjustable rate
 * 
 * @param props - Configuration object containing system accessors
 * @returns Object with mouse event handlers and utility functions
 */

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
  // Right-click interaction state
  isRightClicking: boolean;
  rightClickMode: "attract" | "repel";
  // Particle tracking for delete functionality
  spawnedParticleIds: number[];
  // Store the last calculated size for mode switching
  lastCalculatedSize: number;
}

interface UseSpawnerProps {
  getSystem: () => ParticleSystem | null;
  getRenderer: () => Canvas2DRenderer | null;
  getCanvas: () => HTMLCanvasElement | null;
  getInteraction: () => Interaction | null;
  onZoom?: (deltaY: number, centerX: number, centerY: number) => void;
}

export function useInteractions({
  getSystem,
  getRenderer,
  getCanvas,
  getInteraction,
  onZoom,
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
    isRightClicking: false,
    rightClickMode: "attract",
    spawnedParticleIds: [],
    lastCalculatedSize: 10,
  });

  /**
   * Tracks a spawned particle ID for potential deletion via Delete/Backspace.
   * Maintains a FIFO queue of up to 50 particle IDs.
   * 
   * @param particleId - The unique ID of the spawned particle
   */
  const trackParticleId = useCallback((particleId: number) => {
    const mouseState = mouseStateRef.current;
    mouseState.spawnedParticleIds.push(particleId);

    // Keep only the most recent 50 particles
    if (mouseState.spawnedParticleIds.length > 50) {
      mouseState.spawnedParticleIds.shift();
    }
  }, []);

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
        trackParticleId(firstParticle.id);
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
          trackParticleId(particle.id);
        }
      }, STREAM_SPAWN_INTERVAL);
    },
    [getSystem, trackParticleId]
  );

  const stopStreaming = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
      mouseState.streamInterval = null;
    }
    mouseState.isStreaming = false;
  }, []);

  // Helper function to get world position from mouse event
  const getWorldPosition = useCallback((e: MouseEvent) => {
    const canvas = getCanvas();
    const renderer = getRenderer();
    if (!canvas || !renderer) return { x: 0, y: 0 };

    const screenPos = getMousePosition(e, canvas);
    return renderer.screenToWorld(screenPos.x, screenPos.y);
  }, [getCanvas, getRenderer]);

  // Helper function to get preview color based on renderer color mode
  const getPreviewColor = useCallback(
    (velocity?: { x: number; y: number }) => {
      const renderer = getRenderer();
      if (!renderer) return getRandomColor();

      const colorMode = renderer.getColorMode();

      switch (colorMode) {
        case "custom":
          return renderer.getCustomColor();
        case "velocity":
          if (velocity) {
            // Calculate color based on velocity magnitude for preview
            const speed = Math.sqrt(
              velocity.x * velocity.x + velocity.y * velocity.y
            );
            const maxSpeed = renderer.maxSpeed || 300;
            const ratio = Math.min(speed / maxSpeed, 1);

            // Interpolate from green (slow) to red (fast) - same logic as renderer
            const red = Math.floor(ratio * 255);
            const green = Math.floor((1 - ratio) * 255);
            return `rgb(${red}, ${green}, 0)`;
          }
          // Fallback to green for stationary preview
          return "rgb(0, 255, 0)";
        case "particle":
        default:
          return getRandomColor();
      }
    },
    [getRenderer]
  );

  // Helper function to update velocity preview
  const updateVelocityPreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    const velocity = calculateVelocity(
      mouseState.startPos,
      mouseState.currentPos,
      renderer.getZoom()
    );
    mouseState.initialVelocity = velocity;

    // Show velocity arrow preview
    renderer.setPreviewVelocity(new Vector2D(velocity.x, velocity.y));

    // Update color based on current velocity for velocity mode, but preserve initial color for particle mode
    let currentColor = mouseState.previewColor; // Use initially generated color

    if (renderer.getColorMode() === "velocity") {
      // Only recalculate color for velocity mode to show real-time velocity changes
      currentColor = getPreviewColor(velocity);
    }

    // Also update the particle preview to show as dashed (drag mode style) in velocity mode
    const previewParticle = createParticle(
      mouseState.startPos.x,
      mouseState.startPos.y,
      mouseState.velocityModeSize,
      currentColor
    );
    renderer.setPreviewParticle(previewParticle, true); // true = show as dashed
  }, [getRenderer, getPreviewColor]);

  // Helper function to update size preview
  const updateSizePreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    const distance = getDistance(mouseState.startPos, mouseState.currentPos);
    const size = calculateParticleSize(
      distance,
      mouseState.isDragging,
      mouseState.dragThreshold,
      renderer.getZoom()
    );
    // Store the calculated size for potential mode switching
    mouseState.lastCalculatedSize = size;
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

      // Handle delete/backspace to remove last spawned particle
      if (e.key === "Delete" || e.key === "Backspace") {
        if (mouseState.spawnedParticleIds.length > 0) {
          const system = getSystem();
          if (system) {
            // Get the most recently spawned particle ID
            const lastParticleId = mouseState.spawnedParticleIds.pop();
            if (lastParticleId !== undefined) {
              // Find and remove the particle from the system
              const particle = system.getParticle(lastParticleId);
              if (particle) {
                system.removeParticle(particle);
              }
            }
          }
        }
        return; // Don't process other key events when delete/backspace is pressed
      }

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
            mouseState.dragThreshold,
            getRenderer()?.getZoom() || 1
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
            // Use the last calculated size from the size preview to preserve the current size
            mouseState.velocityModeSize = mouseState.lastCalculatedSize;
            mouseState.activeVelocitySize = mouseState.lastCalculatedSize; // Store for subsequent clicks
            // Clear any existing velocity preview and update with current mouse position
            if (mouseState.currentPos) {
              updateVelocityPreview();
            }
          }
        }
      }
    },
    [getSystem, startStreaming, updateVelocityPreview]
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

  // Right-click interaction handlers
  const onRightMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu
      const canvas = getCanvas();
      const interaction = getInteraction();
      if (!canvas || !interaction) return;

      const mouseState = mouseStateRef.current;
      const pos = getWorldPosition(e);

      // Determine interaction mode based on modifier keys
      const isRepelMode = e.metaKey || e.ctrlKey;
      mouseState.isRightClicking = true;
      mouseState.rightClickMode = isRepelMode ? "repel" : "attract";

      // Set interaction position and activate
      interaction.setPosition(pos.x, pos.y);
      if (isRepelMode) {
        interaction.repel();
      } else {
        interaction.attract();
      }
    },
    [getCanvas, getInteraction, getWorldPosition]
  );

  const onRightMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = getCanvas();
      const interaction = getInteraction();
      if (!canvas || !interaction) return;

      const mouseState = mouseStateRef.current;
      if (!mouseState.isRightClicking) return;

      const pos = getWorldPosition(e);

      // Update interaction position to follow cursor
      interaction.setPosition(pos.x, pos.y);

      // Check for modifier key changes during drag
      const isRepelMode = e.metaKey || e.ctrlKey;
      if (mouseState.rightClickMode !== (isRepelMode ? "repel" : "attract")) {
        mouseState.rightClickMode = isRepelMode ? "repel" : "attract";
        if (isRepelMode) {
          interaction.repel();
        } else {
          interaction.attract();
        }
      }
    },
    [getCanvas, getInteraction, getWorldPosition]
  );

  const onRightMouseUp = useCallback(() => {
    const interaction = getInteraction();
    if (!interaction) return;

    const mouseState = mouseStateRef.current;
    if (mouseState.isRightClicking) {
      // Deactivate interaction
      interaction.setActive(false);
      mouseState.isRightClicking = false;
    }
  }, [getInteraction]);

  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault(); // Always prevent context menu on canvas
  }, []);

  // Mouse event handlers
  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      // Handle right-click separately
      if (e.button === 2) {
        onRightMouseDown(e);
        return;
      }

      const canvas = getCanvas();
      const renderer = getRenderer();
      if (!canvas || !renderer) return;

      const mouseState = mouseStateRef.current;
      const pos = getWorldPosition(e);

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

      // Pick appropriate color based on renderer color mode
      mouseState.previewColor = getPreviewColor();

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
        mouseState.dragThreshold,
        renderer.getZoom()
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
    [getCanvas, getRenderer, startStreaming, getWorldPosition, getPreviewColor]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      // Handle right-click move separately
      if (e.button === 2 || mouseStateRef.current.isRightClicking) {
        onRightMouseMove(e);
        return;
      }

      const canvas = getCanvas();
      const renderer = getRenderer();
      if (!canvas || !renderer) return;

      const worldPos = getWorldPosition(e);

      // Always update cursor position for density display (use world coordinates)
      if (renderer.setCursorPosition) {
        renderer.setCursorPosition(new Vector2D(worldPos.x, worldPos.y));
      }

      const mouseState = mouseStateRef.current;
      if (!mouseState.isDown) return;

      mouseState.currentPos = worldPos;

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
          mouseState.dragThreshold,
          renderer.getZoom()
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
        mouseState.streamPosition = { x: worldPos.x, y: worldPos.y };
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
          // Use the last calculated size from the size preview to preserve the current size
          mouseState.velocityModeSize = mouseState.lastCalculatedSize;
          mouseState.activeVelocitySize = mouseState.lastCalculatedSize; // Store for subsequent clicks
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

      const distance = getDistance(mouseState.startPos, worldPos);

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
      getWorldPosition,
      stopStreaming,
      startStreaming,
      updateVelocityPreview,
      updateSizePreview,
      onRightMouseMove,
    ]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      // Handle right-click up separately
      if (e.button === 2 || mouseStateRef.current.isRightClicking) {
        onRightMouseUp();
        return;
      }

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
          mouseState.previewColor, // Use the same color as preview
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
          mouseState.dragThreshold,
          renderer.getZoom()
        );
        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          size,
          mouseState.previewColor // Use the same color as preview
        );
      }

      system.addParticle(finalParticle);

      // Track the spawned particle ID for delete functionality
      trackParticleId(finalParticle.id);

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
    [getSystem, getRenderer, stopStreaming, onRightMouseUp, trackParticleId]
  );

  const onMouseLeave = useCallback(() => {
    const renderer = getRenderer();
    const interaction = getInteraction();
    if (!renderer) return;

    const mouseState = mouseStateRef.current;
    // Stop streaming when mouse leaves canvas
    if (mouseState.isStreaming) {
      stopStreaming();
    }
    // Stop right-click interaction when mouse leaves canvas
    if (mouseState.isRightClicking && interaction) {
      interaction.setActive(false);
      mouseState.isRightClicking = false;
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
  }, [getRenderer, stopStreaming, getInteraction]);

  const cleanup = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
    }
    // // Remove global keyboard listeners
    document.removeEventListener("keydown", (e) => handleKeyDown(e));
    document.removeEventListener("keyup", handleKeyUp);
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
  }, [getCanvas, handleKeyDown, handleKeyUp]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault(); // Prevent page scroll
      
      const canvas = getCanvas();
      if (!canvas || !onZoom) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      onZoom(e.deltaY, centerX, centerY);
    },
    [getCanvas, onZoom]
  );

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
    onWheel,
    cleanup,
    setupKeyboardListeners,
  };
}
