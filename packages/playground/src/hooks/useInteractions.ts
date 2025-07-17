import { useRef, useCallback } from "react";
import type React from "react";
import {
  System,
  Canvas2DRenderer,
  Vector2D,
  Interaction,
  getIdCounter,
} from "@party/core";
import { getMousePosition } from "../utils/mouse";
import { getDistance } from "../utils/distance";
import {
  createParticle,
  calculateParticleSize,
  calculateParticleMass,
  getRandomColor,
} from "../utils/particle";
import { calculateVelocity } from "../utils/velocity";
import { SpawnConfig } from "../components/control-sections/ParticleSpawnControls";
import { ToolMode } from "./useToolMode";
import { UseUndoRedoReturn } from "./useUndoRedo";

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

// Default streaming configuration (used as fallback)
const DEFAULT_STREAM_SPAWN_RATE = 10; // particles per second

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
  activeStreamMass: number;
  // Velocity mode state
  cmdPressed: boolean;
  isDragToVelocity: boolean;
  initialVelocity: { x: number; y: number };
  velocityModeSize: number;
  activeVelocitySize: number;
  // Right-click interaction state
  isRightClicking: boolean;
  rightClickMode: "attract" | "repel";
  // Store the last calculated size for mode switching
  lastCalculatedSize: number;
  // Removal mode state
  removalRadius: number;
  removalPreviewActive: boolean;
  isRemoving: boolean;
  // Streaming tracking for undo
  streamedParticles: any[];
  // Removal tracking for undo
  removedParticles: any[];
}

interface UseSpawnerProps {
  getSystem: () => System | null;
  getRenderer: () => Canvas2DRenderer | null;
  getCanvas: () => HTMLCanvasElement | null;
  getInteraction: () => Interaction | null;
  getSpawnConfig: () => SpawnConfig;
  onZoom?: (deltaY: number, centerX: number, centerY: number) => void;
  toolMode: ToolMode;
  undoRedo: React.RefObject<UseUndoRedoReturn>;
}

export function useInteractions({
  getSystem,
  getRenderer,
  getCanvas,
  getInteraction,
  getSpawnConfig,
  onZoom,
  toolMode,
  undoRedo,
}: UseSpawnerProps) {
  const mouseStateRef = useRef<MouseState>({
    isDown: false,
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    isDragging: false,
    dragThreshold: 10,
    previewColor: "",
    isStreaming: false,
    streamInterval: null,
    streamSize: 0,
    streamPosition: { x: 0, y: 0 },
    shiftPressed: false,
    wasStreaming: false,
    activeStreamSize: 0,
    activeStreamMass: 0,
    cmdPressed: false,
    isDragToVelocity: false,
    initialVelocity: { x: 0, y: 0 },
    velocityModeSize: 0,
    activeVelocitySize: 0,
    isRightClicking: false,
    rightClickMode: "attract",
    lastCalculatedSize: 10,
    removalRadius: 25, // Screen-space radius in pixels (25px = 50px diameter)
    removalPreviewActive: false,
    isRemoving: false,
    streamedParticles: [],
    removedParticles: [],
  });

  // Streaming functions
  const startStreaming = useCallback(
    (x: number, y: number, size: number, mass?: number) => {
      const mouseState = mouseStateRef.current;
      if (mouseState.isStreaming) {
        stopStreaming();
      }

      mouseState.isStreaming = true;
      mouseState.streamPosition = { x, y };
      mouseState.streamSize = size;
      mouseState.streamedParticles = []; // Reset streamed particles for new session

      // Get spawn config for color and fresh size (in case stream mode needs current values)
      const spawnConfig = getSpawnConfig();
      const color =
        spawnConfig.colorMode === "custom"
          ? spawnConfig.customColor
          : undefined;

      // Spawn the first particle immediately at the exact position
      const system = getSystem();
      if (system) {
        const firstParticle = createParticle(x, y, size, color, undefined, mass);
        system.addParticle(firstParticle);
        mouseState.streamedParticles.push(firstParticle);
      }

      // Then start the interval for subsequent particles
      const streamRate = spawnConfig.streamRate || DEFAULT_STREAM_SPAWN_RATE;
      const streamInterval = 1000 / streamRate; // milliseconds between spawns

      mouseState.streamInterval = window.setInterval(() => {
        const system = getSystem();
        if (system) {
          const currentSpawnConfig = getSpawnConfig(); // Get fresh config for size, mass, and color updates
          const color =
            currentSpawnConfig.colorMode === "custom"
              ? currentSpawnConfig.customColor
              : undefined;
          const particle = createParticle(
            mouseState.streamPosition.x,
            mouseState.streamPosition.y,
            size, // Use the size parameter passed to startStreaming
            color,
            undefined, // velocity
            mass // Use the mass parameter passed to startStreaming
          );
          system.addParticle(particle);
          mouseState.streamedParticles.push(particle);
        }
      }, streamInterval);
    },
    [getSystem, getSpawnConfig]
  );

  const stopStreaming = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
      mouseState.streamInterval = null;
    }
    mouseState.isStreaming = false;

    // Record streamed particles for undo
    if (mouseState.streamedParticles.length > 0) {
      undoRedo.current?.recordSpawnBatch(
        mouseState.streamedParticles,
        getIdCounter()
      );
      mouseState.streamedParticles = [];
    }
  }, []);

  // Helper function to get world position from mouse event
  const getWorldPosition = useCallback(
    (e: MouseEvent) => {
      const canvas = getCanvas();
      const renderer = getRenderer();
      if (!canvas || !renderer) return { x: 0, y: 0 };

      const screenPos = getMousePosition(e, canvas);
      return renderer.screenToWorld(screenPos.x, screenPos.y);
    },
    [getCanvas, getRenderer]
  );

  // Helper function to get preview color based on spawn config and renderer color mode
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
          // Use spawn config for color mode
          const spawnConfig = getSpawnConfig();
          if (spawnConfig.colorMode === "custom") {
            return spawnConfig.customColor;
          }
          return getRandomColor();
      }
    },
    [getRenderer, getSpawnConfig]
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

    const zoomScale = renderer.getZoom();
    const adjustedThreshold = mouseState.dragThreshold / zoomScale;

    const size = calculateParticleSize(
      distance,
      mouseState.isDragging,
      adjustedThreshold,
      renderer.getZoom(),
      getSpawnConfig()
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
  }, [getRenderer, getSpawnConfig]);

  // Cancel drag operation (ESC key)
  const cancelDragOperation = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();

    if (!renderer) return;

    // Clear preview particle and velocity
    renderer.setPreviewParticle(null, false);
    renderer.setPreviewVelocity(null);

    // Reset mouse state
    mouseState.isDown = false;
    mouseState.isDragging = false;
    mouseState.isDragToVelocity = false;
    mouseState.previewColor = "";
    mouseState.initialVelocity = { x: 0, y: 0 };
    mouseState.velocityModeSize = 0;
  }, [getRenderer]);

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mouseState = mouseStateRef.current;
      if (e.key === " " && e.shiftKey) {
        const system = getSystem();
        if (system) {
          system.toggle();
        }
        return;
      }

      // Handle Ctrl+Z / Cmd+Z for undo functionality
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const currentUndoRedo = undoRedo.current;
        if (currentUndoRedo) {
          e.preventDefault(); // Prevent browser undo
          if (currentUndoRedo.canUndo) {
            currentUndoRedo.undo();
          } else {
          }
        }
        return;
      }

      // Handle Ctrl+Shift+Z / Cmd+Shift+Z for redo functionality
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        const currentUndoRedo = undoRedo.current;
        if (currentUndoRedo) {
          e.preventDefault(); // Prevent browser redo
          if (currentUndoRedo.canRedo) {
            currentUndoRedo.redo();
          } else {
          }
        }
        return;
      }

      // Handle ESC key to cancel drag operations
      if (e.key === "Escape") {
        // Only cancel if user is currently dragging
        if (mouseState.isDown && mouseState.isDragging) {
          e.preventDefault(); // Prevent any browser ESC behavior
          cancelDragOperation();
        }
        return;
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
            getRenderer()?.getZoom() || 1,
            getSpawnConfig()
          );
          const mass = calculateParticleMass(
            distance,
            mouseState.isDragging,
            mouseState.dragThreshold,
            getRenderer()?.getZoom() || 1,
            getSpawnConfig()
          );
          startStreaming(mouseState.startPos.x, mouseState.startPos.y, size, mass);
          // Store the size and mass for subsequent clicks while SHIFT is held
          mouseState.activeStreamSize = size;
          mouseState.activeStreamMass = mass;
          // Clear preview particles when streaming starts
          const renderer = getRenderer();
          if (renderer) {
            renderer.setPreviewParticle(null, false);
            renderer.setPreviewVelocity(null);
          }
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
    [
      getSystem,
      startStreaming,
      updateVelocityPreview,
      getSpawnConfig,
      cancelDragOperation,
    ]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const mouseState = mouseStateRef.current;

      if (e.key === "Shift") {
        mouseState.shiftPressed = false;
        mouseState.activeStreamSize = 0; // Reset stream size when shift is released
        mouseState.activeStreamMass = 0; // Reset stream mass when shift is released
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

  // Removal mode functions
  const removeParticlesAtPosition = useCallback(
    (worldPos: { x: number; y: number }) => {
      const system = getSystem();
      const renderer = getRenderer();
      if (!system || !renderer) return;

      const mouseState = mouseStateRef.current;

      // Convert screen-space removal radius to world space for collision detection
      const zoom = renderer.getZoom();
      const worldRadius = mouseState.removalRadius / zoom;

      // Find particles within removal radius (including partial overlap)
      const particlesToRemove = system.particles.filter((particle) => {
        // Skip already marked particles
        if (particle.mass <= 0) return false;

        const dx = particle.position.x - worldPos.x;
        const dy = particle.position.y - worldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if particle overlaps with removal circle
        // (distance between centers < removal radius + particle radius)
        return distance < worldRadius + particle.size;
      });

      // Track particles before removal and mark for removal using mass = 0 pattern
      particlesToRemove.forEach((particle) => {
        // Store original particle state for undo (clone to preserve original state)
        mouseState.removedParticles.push(particle.clone());

        // Mark particle for removal
        particle.mass = 0;
        particle.size = 0; // Immediate visual feedback
      });
    },
    [getSystem, getRenderer]
  );

  const handleRemovalClick = useCallback(
    (e: MouseEvent) => {
      const mouseState = mouseStateRef.current;
      const worldPos = getWorldPosition(e);

      // Start removal mode and reset removed particles tracking
      mouseState.isRemoving = true;
      mouseState.removedParticles = [];

      // Remove particles at click position
      removeParticlesAtPosition(worldPos);
    },
    [getWorldPosition, removeParticlesAtPosition]
  );

  const updateRemovalPreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    if (!renderer || toolMode !== "remove") return;

    if (mouseState.removalPreviewActive) {
      // Pass world position and constant screen radius
      renderer.setRemovalPreview({
        position: new Vector2D(
          mouseState.currentPos.x,
          mouseState.currentPos.y
        ),
        radius: mouseState.removalRadius, // This is in screen pixels, renderer will handle conversion
      });
    } else {
      // Clear removal preview
      renderer.setRemovalPreview(null);
    }
  }, [getRenderer, toolMode]);

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

      // Handle removal mode
      if (toolMode === "remove") {
        handleRemovalClick(e);
        return;
      }

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

      // Get spawn config early for use throughout the function
      const spawnConfig = getSpawnConfig();

      // Set the size for velocity mode
      if (mouseState.isDragToVelocity) {
        let velocitySize;
        if (mouseState.activeVelocitySize > 0) {
          // Use the preserved size from previous drag-to-velocity
          velocitySize = mouseState.activeVelocitySize;
        } else {
          // Use default size from spawn config for first cmd+click
          velocitySize = spawnConfig.defaultSize;
          mouseState.activeVelocitySize = velocitySize; // Store for subsequent clicks
        }
        mouseState.velocityModeSize = velocitySize;
      }

      // If shift was released between interactions, reset the active stream size and mass
      if (wasShiftPressedBefore && !mouseState.shiftPressed) {
        mouseState.activeStreamSize = 0;
        mouseState.activeStreamMass = 0;
      }

      // If cmd was released between interactions, reset the active velocity size
      if (wasCmdPressedBefore && !mouseState.cmdPressed) {
        mouseState.activeVelocitySize = 0;
      }

      mouseState.isDown = true;
      mouseState.startPos = pos;
      mouseState.currentPos = pos;
      mouseState.isDragging = false;

      // Pick appropriate color based on renderer color mode
      mouseState.previewColor = getPreviewColor();

      // Start streaming if shift is pressed OR if stream mode is enabled in spawn config
      if (mouseState.shiftPressed || spawnConfig.streamMode) {
        let streamSize;
        let streamMass;
        if (spawnConfig.streamMode) {
          // In stream mode, always use current size from spawn config
          streamSize = spawnConfig.defaultSize;
          streamMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        } else if (mouseState.activeStreamSize > 0 && mouseState.activeStreamMass > 0) {
          // Use the preserved size and mass from previous drag-to-size (shift+click behavior)
          streamSize = mouseState.activeStreamSize;
          streamMass = mouseState.activeStreamMass;
        } else {
          // Use default size from spawn config for first shift+click
          streamSize = spawnConfig.defaultSize;
          streamMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        }
        startStreaming(pos.x, pos.y, streamSize, streamMass);
        mouseState.wasStreaming = true; // Mark that we were streaming
        return; // Don't show preview when streaming
      }

      // Create and show preview particle with the selected color
      // Use spawn config default size for initial preview
      const size = spawnConfig.defaultSize;
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

      // Handle removal mode preview and continuous removal
      if (toolMode === "remove") {
        mouseState.currentPos = worldPos;
        mouseState.removalPreviewActive = true;
        updateRemovalPreview();

        // If mouse is down and we're in removal mode, continuously remove particles
        if (mouseState.isRemoving) {
          removeParticlesAtPosition(worldPos);
        }

        return;
      }

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

      // If shift was just released, reset the active stream size and mass
      if (wasShiftPressed && !mouseState.shiftPressed) {
        mouseState.activeStreamSize = 0;
        mouseState.activeStreamMass = 0;
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
          renderer.getZoom(),
          getSpawnConfig()
        );
        const mass = calculateParticleMass(
          distance,
          mouseState.isDragging,
          mouseState.dragThreshold,
          renderer.getZoom(),
          getSpawnConfig()
        );
        mouseState.activeStreamSize = size; // Store this size for subsequent clicks
        mouseState.activeStreamMass = mass; // Store this mass for subsequent clicks
        startStreaming(mouseState.startPos.x, mouseState.startPos.y, size, mass);
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
      // Adjust threshold based on zoom level - when zoomed out, use smaller threshold
      const currentRenderer = getRenderer();
      const zoomScale = currentRenderer ? currentRenderer.getZoom() : 1;
      const adjustedThreshold = mouseState.dragThreshold / zoomScale;

      if (distance >= adjustedThreshold) {
        // debugger;
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
      toolMode,
      updateRemovalPreview,
      removeParticlesAtPosition,
      getSpawnConfig,
    ]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      // Handle right-click up separately
      if (e.button === 2 || mouseStateRef.current.isRightClicking) {
        onRightMouseUp();
        return;
      }

      const mouseState = mouseStateRef.current;

      // Handle removal mode mouse up
      if (toolMode === "remove" && mouseState.isRemoving) {
        mouseState.isRemoving = false;

        // Record removed particles for undo
        if (mouseState.removedParticles.length > 0) {
          if (mouseState.removedParticles.length === 1) {
            undoRedo.current?.recordRemoveSingle(
              mouseState.removedParticles[0],
              getIdCounter()
            );
          } else {
            undoRedo.current?.recordRemoveBatch(
              mouseState.removedParticles,
              getIdCounter()
            );
          }
          mouseState.removedParticles = [];
        }
        return;
      }

      const system = getSystem();
      const renderer = getRenderer();
      if (!system || !renderer) return;

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
      const spawnConfig = getSpawnConfig();

      if (mouseState.isDragToVelocity) {
        // Velocity mode: create particle with the stored size and initial velocity
        // Use drag-to-size when dragging, otherwise use spawn config defaults
        let finalSize = mouseState.velocityModeSize;
        let finalMass;
        if (!mouseState.isDragging) {
          finalSize = spawnConfig.defaultSize;
          finalMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        } else {
          // Calculate mass from the stored size in velocity mode
          const radius = finalSize;
          const area = Math.PI * radius * radius;
          finalMass = area / 100; // Same calculation as in createParticle
        }

        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          finalSize,
          mouseState.previewColor, // Use the same color as preview
          mouseState.initialVelocity,
          finalMass
        );
      } else {
        // Size mode: create particle with drag-to-size or spawn config defaults
        let finalSize;
        let finalMass;
        if (mouseState.isDragging) {
          // Use drag-to-size when dragging
          const distance = getDistance(
            mouseState.startPos,
            mouseState.currentPos
          );
          finalSize = calculateParticleSize(
            distance,
            mouseState.isDragging,
            mouseState.dragThreshold,
            renderer.getZoom(),
            getSpawnConfig()
          );
          finalMass = calculateParticleMass(
            distance,
            mouseState.isDragging,
            mouseState.dragThreshold,
            renderer.getZoom(),
            getSpawnConfig()
          );
        } else {
          // Use spawn config defaults for click without drag
          finalSize = spawnConfig.defaultSize;
          finalMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        }

        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          finalSize,
          mouseState.previewColor, // Use the same color as preview
          undefined, // velocity
          finalMass
        );
      }

      system.addParticle(finalParticle);

      // Record single particle spawn for undo functionality
      undoRedo.current?.recordSpawnSingle(finalParticle, getIdCounter());

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
    [
      getSystem,
      getRenderer,
      stopStreaming,
      onRightMouseUp,
      toolMode,
      handleRemovalClick,
      getSpawnConfig,
    ]
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
    // Clear removal preview and stop removal
    mouseState.removalPreviewActive = false;
    mouseState.isRemoving = false;
    updateRemovalPreview();
    mouseState.isDown = false;
    mouseState.isDragging = false;
    mouseState.previewColor = "";
    mouseState.wasStreaming = false; // Reset for next interaction
    mouseState.isDragToVelocity = false; // Reset velocity mode
    mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity
    mouseState.velocityModeSize = 0; // Reset velocity mode size
  }, [getRenderer, stopStreaming, getInteraction, updateRemovalPreview]);

  const cleanup = useCallback(() => {
    const mouseState = mouseStateRef.current;
    if (mouseState.streamInterval) {
      clearInterval(mouseState.streamInterval);
    }
    // // Remove global keyboard listeners
    document.removeEventListener("keydown", (e) => handleKeyDown(e));
    document.removeEventListener("keyup", (e) => handleKeyUp(e));
  }, [getCanvas, handleKeyDown, handleKeyUp]);

  const setupKeyboardListeners = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    // Make canvas focusable
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none"; // Remove focus outline

    // Add global keyboard listeners - these should always work
    document.addEventListener("keydown", (e) => handleKeyDown(e));
    document.addEventListener("keyup", (e) => handleKeyUp(e));
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
