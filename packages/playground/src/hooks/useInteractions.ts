import { useRef, useCallback, useState } from "react";
import type React from "react";
import {
  System,
  Canvas2DRenderer,
  Vector2D,
  Interaction,
  getIdCounter,
  Joints,
  Particle,
  PINNED_PARTICLE_COLOR,
} from "@party/core";
import { getMousePosition } from "../utils/mouse";
import { getDistance } from "../utils/distance";
import {
  createParticle,
  calculateParticleSize,
  calculateParticleMass,
  calculateMassFromSize,
  getRandomColor,
} from "../utils/particle";
import { calculateVelocity } from "../utils/velocity";
import { SpawnConfig } from "../components/control-sections/SpawnControls";
import { ToolMode } from "./useToolMode";
import { UseUndoRedoReturn } from "./useUndoRedo";

/**
 * Custom React hook that handles all mouse and keyboard interactions for the particle playground.
 *
 * This hook provides a comprehensive interaction system with support for multiple input modes,
 * streaming, mass configuration, and advanced features like mode switching and state preservation.
 *
 * ## Core Features:
 *
 * ### Mouse Controls:
 * - **Click**: Spawn a single particle at cursor position using configured size and mass
 * - **Click & Drag**: Set particle size based on drag distance (drag-to-size)
 * - **Ctrl/⌘ + Click & Drag**: Set particle direction and speed (drag-to-velocity)
 * - **Right Click**: Attract particles to cursor position
 * - **Ctrl/⌘ + Right Click**: Repel particles from cursor position
 * - **Mouse Wheel/Trackpad Scroll**: Zoom in/out on the simulation
 *
 * ### Keyboard Modifiers:
 * - **Hold Shift + Click**: Stream particles continuously at cursor
 * - **Hold Shift + Click & Drag**: Stream particles with drag-to-size behavior
 * - **Escape**: Cancel current drag operation
 *
 * ### Advanced Features:
 * - **Mode Switching**: Press Ctrl/⌘ while dragging to switch from size mode to velocity mode
 * - **Mass Configuration**: Respects spawn config mass or calculates from size based on interaction type
 * - **Active Size/Mass Preservation**: Maintains size and mass across multiple stream operations
 * - **Original Drag Intent Tracking**: Distinguishes between different drag operation types
 * - **Streaming**: Continuous particle spawning with configurable rate and preserved properties
 * - **Undo/Redo Integration**: All operations are tracked for undo/redo functionality
 *
 * ### Mass Calculation Logic:
 * - **Regular Click**: Uses `spawnConfig.defaultMass`
 * - **Drag-to-Size**: Uses `calculateMassFromSize(dragSize)`
 * - **Ctrl+Click+Drag**: Uses `spawnConfig.defaultMass`
 * - **Click+Drag+Ctrl**: Uses `calculateMassFromSize(dragSize)`
 * - **Streaming**: Uses preserved mass or falls back to configured mass
 *
 * @param props - Configuration object containing system accessors and callbacks
 * @param props.getSystem - Function to get the current particle system
 * @param props.getRenderer - Function to get the current renderer
 * @param props.getCanvas - Function to get the canvas element
 * @param props.getInteraction - Function to get the interaction system
 * @param props.getSpawnConfig - Function to get the current spawn configuration
 * @param props.onZoom - Optional callback for zoom events
 * @param props.toolMode - Current tool mode
 * @param props.undoRedo - Reference to undo/redo system
 * @returns Object with mouse and keyboard event handlers for canvas integration
 */

// Default streaming configuration (used as fallback)
const DEFAULT_STREAM_SPAWN_RATE = 10; // particles per second

/**
 * Comprehensive state object that tracks all mouse and keyboard interaction state
 * for the particle playground. This includes basic mouse tracking, streaming state,
 * mode switching, and undo/redo tracking.
 */
interface MouseState {
  // === Basic Mouse Interaction State ===
  /** Whether the mouse button is currently pressed */
  isDown: boolean;
  /** Position where the mouse button was pressed */
  startPos: { x: number; y: number };
  /** Current mouse position */
  currentPos: { x: number; y: number };
  /** Whether the mouse has moved beyond the drag threshold */
  isDragging: boolean;
  /** Minimum distance required to enter drag mode */
  dragThreshold: number;
  /** Color used for preview particles */
  previewColor: string;

  // === Streaming State ===
  /** Whether particles are currently being streamed */
  isStreaming: boolean;
  /** Interval ID for streaming timer */
  streamInterval: number | null;
  /** Size of particles being streamed */
  streamSize: number;
  /** Position where streaming is occurring */
  streamPosition: { x: number; y: number };
  /** Whether shift key is currently pressed */
  shiftPressed: boolean;
  /** Whether streaming occurred during this mouse session */
  wasStreaming: boolean;
  /** Preserved size from drag-to-size operations for subsequent streams */
  activeStreamSize: number;
  /** Preserved mass from drag-to-size operations for subsequent streams */
  activeStreamMass: number;
  /** Array of colors captured at interaction start for consistent streaming */
  streamColors: string[];

  // === Velocity Mode State ===
  /** Whether ctrl/cmd key is currently pressed */
  cmdPressed: boolean;
  /** Whether currently in drag-to-velocity mode */
  isDragToVelocity: boolean;
  /** Initial velocity vector for velocity mode */
  initialVelocity: { x: number; y: number };
  /** Size to use in velocity mode */
  velocityModeSize: number;
  /** Preserved size for velocity mode operations */
  activeVelocitySize: number;

  // === Mode Switching State ===
  /** Tracks the original intent of the drag operation for proper mass calculation */
  originalDragIntent: "size" | "velocity" | null;
  /** Last calculated size for mode switching preservation */
  lastCalculatedSize: number;

  // === Right-click Interaction State ===
  /** Whether right mouse button is currently pressed */
  isRightClicking: boolean;
  /** Mode for right-click interactions */
  rightClickMode: "attract" | "repel";

  // === Removal Mode State ===
  /** Radius for particle removal tool */
  removalRadius: number;
  /** Whether removal preview is active */
  removalPreviewActive: boolean;
  /** Whether currently removing particles */
  isRemoving: boolean;

  // === Joint Mode State ===
  /** Currently selected particle for joint creation */
  selectedParticle: Particle | null;
  /** Whether a particle is highlighted for selection */
  highlightedParticle: Particle | null;
  /** Whether currently creating a joint */
  isCreatingJoint: boolean;
  /** Joints created during current session for undo */
  createdJoints: string[];

  // === Grab Mode State ===
  /** Particle currently being grabbed/dragged */
  grabbedParticle: Particle | null;
  /** Whether currently grabbing a particle */
  isGrabbing: boolean;
  /** Offset from particle center to mouse when grabbing */
  grabOffset: { x: number; y: number };
  /** Previous mouse position for velocity calculation */
  grabPreviousPos: { x: number; y: number };
  /** Time of last mouse movement for velocity calculation */
  grabLastMoveTime: number;
  /** Calculated velocity from mouse movement */
  grabVelocity: { x: number; y: number };

  // === Pin Mode State ===
  /** Whether pin tool is active */
  isPinning: boolean;

  // === Draw Mode State ===
  /** Whether currently in draw mode */
  isDrawing: boolean;
  /** Last particle spawned in draw mode for joint creation */
  lastDrawnParticle: Particle | null;
  /** Position of last drawn particle */
  lastDrawnPosition: { x: number; y: number };
  /** Particles created during drawing session for undo */
  drawnParticles: any[];
  /** Joints created during drawing session for undo */
  drawnJoints: any[];

  // === Undo/Redo Tracking ===
  /** Particles created during streaming sessions for undo */
  streamedParticles: any[];
  /** Particles removed during removal operations for undo */
  removedParticles: any[];
}

/**
 * Props interface for the useInteractions hook, containing all necessary
 * system accessors and configuration for particle interaction handling.
 */
interface UseSpawnerProps {
  /** Function to get the current particle system instance */
  getSystem: () => System | null;
  /** Function to get the current renderer instance */
  getRenderer: () => Canvas2DRenderer | null;
  /** Function to get the canvas element */
  getCanvas: () => HTMLCanvasElement | null;
  /** Function to get the interaction system instance */
  getInteraction: () => Interaction | null;
  /** Function to get the joints system instance */
  getJoints: () => Joints | null;
  /** Function to get the current spawn configuration */
  getSpawnConfig: () => SpawnConfig;
  /** Optional callback for zoom events */
  onZoom?: (deltaY: number, centerX: number, centerY: number) => void;
  /** Current tool mode */
  toolMode: ToolMode;
  /** Reference to the undo/redo system */
  undoRedo: React.RefObject<UseUndoRedoReturn>;
}

export function useInteractions({
  getSystem,
  getRenderer,
  getCanvas,
  getInteraction,
  getJoints,
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
    streamColors: [],
    cmdPressed: false,
    isDragToVelocity: false,
    initialVelocity: { x: 0, y: 0 },
    velocityModeSize: 0,
    activeVelocitySize: 0,
    originalDragIntent: null,
    isRightClicking: false,
    rightClickMode: "attract",
    lastCalculatedSize: 10,
    removalRadius: 25, // Screen-space radius in pixels (25px = 50px diameter)
    removalPreviewActive: false,
    isRemoving: false,
    selectedParticle: null,
    highlightedParticle: null,
    isCreatingJoint: false,
    createdJoints: [],
    grabbedParticle: null,
    isGrabbing: false,
    grabOffset: { x: 0, y: 0 },
    grabPreviousPos: { x: 0, y: 0 },
    grabLastMoveTime: 0,
    grabVelocity: { x: 0, y: 0 },
    isPinning: false,
    isDrawing: false,
    lastDrawnParticle: null,
    lastDrawnPosition: { x: 0, y: 0 },
    drawnParticles: [],
    drawnJoints: [],
    streamedParticles: [],
    removedParticles: [],
  });

  // State to track when we're currently grabbing for cursor styling
  const [isCurrentlyGrabbing, setIsCurrentlyGrabbing] = useState(false);

  // === Shape Mode System ===

  /**
   * Calculate positions for particles in a regular polygon shape
   * @param centerX - Center X coordinate
   * @param centerY - Center Y coordinate
   * @param sides - Number of sides (particles)
   * @param length - Distance from center to each particle
   * @returns Array of {x, y} positions
   */
  const calculateShapePositions = useCallback(
    (centerX: number, centerY: number, sides: number, length: number) => {
      const positions = [];
      const angleStep = (2 * Math.PI) / sides;

      for (let i = 0; i < sides; i++) {
        const angle = i * angleStep;
        const x = centerX + Math.cos(angle) * length;
        const y = centerY + Math.sin(angle) * length;
        positions.push({ x, y });
      }

      return positions;
    },
    []
  );

  /**
   * Spawn particles in a shape formation and connect them all-to-all
   * @param centerX - Center X coordinate
   * @param centerY - Center Y coordinate
   * @param sides - Number of particles to spawn
   * @param length - Distance from center to each particle
   * @param spawnConfig - Spawn configuration
   */
  const spawnShapeParticles = useCallback(
    (
      centerX: number,
      centerY: number,
      sides: number,
      length: number,
      spawnConfig: SpawnConfig
    ) => {
      const system = getSystem();
      const joints = getJoints();
      if (!system || !joints) return;

      // Calculate positions for all particles
      const positions = calculateShapePositions(
        centerX,
        centerY,
        sides,
        length
      );

      // Create all particles with different colors
      const shapeParticles = positions.map((pos) => {
        return createParticle(
          pos.x,
          pos.y,
          spawnConfig.defaultSize,
          mouseStateRef.current.previewColor || getRandomColor(),
          undefined,
          spawnConfig.defaultMass,
          spawnConfig.pinned
        );
      });

      // Add all particles to the system
      shapeParticles.forEach((particle) => {
        system.addParticle(particle);
      });

      // Create all-to-all joints between particles
      const createdJoints = [];
      for (let i = 0; i < shapeParticles.length; i++) {
        for (let j = i + 1; j < shapeParticles.length; j++) {
          const joint = joints.createJoint({
            particleA: shapeParticles[i],
            particleB: shapeParticles[j],
          });
          if (joint) {
            createdJoints.push(joint);
          }
        }
      }

      // Record the shape spawn for undo with both particles and joints
      undoRedo.current?.recordShapeSpawn(
        shapeParticles,
        createdJoints,
        getIdCounter()
      );
    },
    [
      getSystem,
      getJoints,
      calculateShapePositions,
      createParticle,
      getRandomColor,
    ]
  );

  // === Color Preview System ===

  /**
   * Gets the preview color based on the current renderer color mode.
   * Ensures consistency between preview and actual particle colors.
   */
  const getPreviewColor = useCallback(
    (velocity?: { x: number; y: number }) => {
      const spawnConfig = getSpawnConfig();

      // If pinned mode is enabled, always show pinned color
      if (spawnConfig.pinned) {
        return PINNED_PARTICLE_COLOR;
      }

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
          // Use spawn config colors
          if (spawnConfig.colors.length > 0) {
            return spawnConfig.colors[
              Math.floor(Math.random() * spawnConfig.colors.length)
            ];
          }
          return getRandomColor();
      }
    },
    [getRenderer, getSpawnConfig]
  );

  // === Draw Mode System ===

  /**
   * Start drawing mode - spawns first particle and initializes drawing state
   */
  const startDrawing = useCallback(
    (x: number, y: number) => {
      const mouseState = mouseStateRef.current;
      const system = getSystem();
      const spawnConfig = getSpawnConfig();
      if (!system) return;

      mouseState.isDrawing = true;
      mouseState.drawnParticles = []; // Reset drawn particles for new session
      mouseState.drawnJoints = []; // Reset drawn joints for new session

      // Spawn the first particle
      const firstParticle = createParticle(
        x,
        y,
        spawnConfig.defaultSize,
        getPreviewColor(),
        undefined,
        spawnConfig.defaultMass,
        spawnConfig.pinned
      );

      system.addParticle(firstParticle);
      mouseState.drawnParticles.push(firstParticle);
      mouseState.lastDrawnParticle = firstParticle;
      mouseState.lastDrawnPosition = { x, y };
    },
    [getSystem, getSpawnConfig, getPreviewColor]
  );

  /**
   * Continue drawing - check distance and spawn/join particles as needed
   */
  const continueDrawing = useCallback(
    (x: number, y: number) => {
      const mouseState = mouseStateRef.current;
      const system = getSystem();
      const joints = getJoints();
      const spawnConfig = getSpawnConfig();

      if (
        !system ||
        !joints ||
        !mouseState.isDrawing ||
        !mouseState.lastDrawnParticle
      )
        return;

      // Calculate distance from last drawn position
      const dx = x - mouseState.lastDrawnPosition.x;
      const dy = y - mouseState.lastDrawnPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if we've moved far enough to spawn a new particle
      if (distance >= spawnConfig.drawStepSize) {
        // Spawn new particle
        const newParticle = createParticle(
          x,
          y,
          spawnConfig.defaultSize,
          getPreviewColor(),
          undefined,
          spawnConfig.defaultMass,
          spawnConfig.pinned
        );

        system.addParticle(newParticle);
        mouseState.drawnParticles.push(newParticle);

        // Create joint between last particle and new particle
        const joint = joints.createJoint({
          particleA: mouseState.lastDrawnParticle,
          particleB: newParticle,
        });

        mouseState.drawnJoints.push(joint);

        // Update state for next particle
        mouseState.lastDrawnParticle = newParticle;
        mouseState.lastDrawnPosition = { x, y };
      }
    },
    [getSystem, getJoints, getSpawnConfig, getPreviewColor]
  );

  /**
   * Stop drawing mode and record drawn particles for undo
   */
  const stopDrawing = useCallback(() => {
    const mouseState = mouseStateRef.current;

    mouseState.isDrawing = false;
    mouseState.lastDrawnParticle = null;
    mouseState.lastDrawnPosition = { x: 0, y: 0 };

    // Record drawn particles and joints for undo
    if (mouseState.drawnParticles.length > 0) {
      undoRedo.current?.recordDrawBatch(
        mouseState.drawnParticles,
        mouseState.drawnJoints,
        getIdCounter()
      );
      mouseState.drawnParticles = [];
      mouseState.drawnJoints = [];
    }
  }, []);

  // === Streaming System ===

  /**
   * Initiates continuous particle streaming at a specified position with given size and mass.
   * Handles both initial particle spawning and setting up interval-based streaming.
   *
   * @param x - World X coordinate for streaming
   * @param y - World Y coordinate for streaming
   * @param size - Size of particles to stream
   * @param mass - Optional mass for particles (uses configured mass if not provided)
   */
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

      // Get spawn config for fresh size (in case stream mode needs current values)
      const spawnConfig = getSpawnConfig();
      // Function to get a random color from the captured colors array
      const getStreamColor = () => {
        if (mouseState.streamColors.length > 0) {
          return mouseState.streamColors[
            Math.floor(Math.random() * mouseState.streamColors.length)
          ];
        }
        // When no custom colors are set, get a fresh random color each time
        // This ensures each particle gets a different color from the default palette
        return getPreviewColor();
      };

      const firstColor = getStreamColor();

      // Spawn the first particle immediately at the exact position
      const system = getSystem();
      if (system) {
        const firstParticle = createParticle(
          x,
          y,
          size,
          firstColor,
          undefined,
          mass,
          spawnConfig.pinned
        );
        system.addParticle(firstParticle);
        mouseState.streamedParticles.push(firstParticle);
      }

      // Then start the interval for subsequent particles
      const streamRate = spawnConfig.streamRate || DEFAULT_STREAM_SPAWN_RATE;
      const streamInterval = 1000 / streamRate; // milliseconds between spawns

      mouseState.streamInterval = window.setInterval(() => {
        const system = getSystem();
        if (system) {
          // Get a new random color for each particle from the captured colors array
          const particleColor = getStreamColor();
          const particle = createParticle(
            mouseState.streamPosition.x,
            mouseState.streamPosition.y,
            size, // Use the size parameter passed to startStreaming
            particleColor, // Use a random color from the captured array
            undefined, // velocity
            mass, // Use the mass parameter passed to startStreaming
            spawnConfig.pinned
          );
          system.addParticle(particle);
          mouseState.streamedParticles.push(particle);
        }
      }, streamInterval);
    },
    [getSystem, getSpawnConfig, getPreviewColor]
  );

  /**
   * Stops the current streaming session and records all streamed particles for undo.
   * Clears the streaming interval and resets streaming state.
   */
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

  // === Joint System Helpers ===

  /**
   * Find particle at the given world position
   */
  const findParticleAtPosition = useCallback(
    (
      worldPos: { x: number; y: number },
      tolerance: number = 20
    ): Particle | null => {
      const system = getSystem();
      const renderer = getRenderer();
      if (!system || !renderer) return null;

      // Convert tolerance from screen pixels to world units
      const worldTolerance = tolerance / renderer.getZoom();

      // Find the closest particle within tolerance
      let closestParticle: Particle | null = null;
      let closestDistance = worldTolerance;

      for (const particle of system.particles) {
        if (particle.mass <= 0) continue; // Skip removed particles

        const dx = particle.position.x - worldPos.x;
        const dy = particle.position.y - worldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy) - particle.size;

        if (distance < closestDistance) {
          closestDistance = distance;
          closestParticle = particle;
        }
      }

      return closestParticle;
    },
    [getSystem, getRenderer]
  );

  /**
   * Check if a joint already exists between two particles (in either direction)
   */
  const hasJointBetween = useCallback(
    (particleA: Particle, particleB: Particle): boolean => {
      const joints = getJoints();
      if (!joints) return false;

      const existingJoints = joints.getAllJoints();
      return existingJoints.some(
        (joint) =>
          (joint.particleA.id === particleA.id &&
            joint.particleB.id === particleB.id) ||
          (joint.particleA.id === particleB.id &&
            joint.particleB.id === particleA.id)
      );
    },
    [getJoints]
  );

  /**
   * Create a joint between two particles
   */
  const createJoint = useCallback(
    (particleA: Particle, particleB: Particle) => {
      const joints = getJoints();
      if (!joints) return null;

      const joint = joints.createJoint({
        particleA,
        particleB,
        // Uses the default type from joints configuration
      });

      return joint;
    },
    [getJoints]
  );

  /**
   * Handle joint creation click
   */
  const handleJointClick = useCallback(
    (worldPos: { x: number; y: number }, keepJoining: boolean = false) => {
      const mouseState = mouseStateRef.current;
      const particle = findParticleAtPosition(worldPos);

      if (!particle) {
        // Clicked on empty space - clear selection
        mouseState.selectedParticle = null;
        mouseState.isCreatingJoint = false;
        return;
      }

      if (!mouseState.selectedParticle) {
        // First particle selection
        mouseState.selectedParticle = particle;
        mouseState.isCreatingJoint = true;
      } else if (mouseState.selectedParticle.id === particle.id) {
        // Clicked same particle - deselect
        mouseState.selectedParticle = null;
        mouseState.isCreatingJoint = false;
      } else {
        // Second particle selection - check for duplicate joint first
        if (hasJointBetween(mouseState.selectedParticle, particle)) {
          // Joint already exists - don't create duplicate, just reset selection
          if (!keepJoining) {
            mouseState.selectedParticle = null;
            mouseState.isCreatingJoint = false;
          } else {
            mouseState.selectedParticle = particle;
          }
          return; // Exit early without creating duplicate joint
        }

        // Create joint (no duplicate exists)
        const joint = createJoint(mouseState.selectedParticle, particle);
        if (joint) {
          mouseState.createdJoints.push(joint.id);

          // Record joint creation for undo
          undoRedo.current?.recordJointCreate(joint, getIdCounter());
        }

        // Reset selection
        if (!keepJoining) {
          mouseState.selectedParticle = null;
          mouseState.isCreatingJoint = false;
        } else {
          mouseState.selectedParticle = particle;
        }
      }
    },
    [findParticleAtPosition, createJoint, hasJointBetween]
  );

  /**
   * Update joint preview (line between selected particle and cursor)
   */
  const updateJointPreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();

    if (!renderer) return;

    if (!mouseState.selectedParticle || !mouseState.isCreatingJoint) {
      // Clear joint preview
      renderer.setJointPreview(null);
      return;
    }

    // Show joint preview line
    renderer.setJointPreview({
      particleA: mouseState.selectedParticle,
      targetPosition: new Vector2D(
        mouseState.currentPos.x,
        mouseState.currentPos.y
      ),
    });
  }, [getRenderer]);

  /**
   * Handle grab tool click - start grabbing a particle
   */
  const handleGrabClick = useCallback(
    (worldPos: { x: number; y: number }) => {
      const mouseState = mouseStateRef.current;
      const particle = findParticleAtPosition(worldPos);

      if (particle) {
        // Start grabbing the particle
        mouseState.grabbedParticle = particle;
        mouseState.isGrabbing = true;

        // Calculate offset from particle center to mouse position
        mouseState.grabOffset = {
          x: worldPos.x - particle.position.x,
          y: worldPos.y - particle.position.y,
        };

        // Initialize velocity tracking
        mouseState.grabPreviousPos = { x: worldPos.x, y: worldPos.y };
        mouseState.grabLastMoveTime = Date.now();
        mouseState.grabVelocity = { x: 0, y: 0 };

        // Mark the particle as grabbed so collision systems can handle it specially
        particle.grabbed = true;

        // Update cursor state for styling
        setIsCurrentlyGrabbing(true);
      }
    },
    [findParticleAtPosition]
  );

  /**
   * Handle pin tool click - toggle particle pinned state
   */
  const handlePinClick = useCallback(
    (worldPos: { x: number; y: number }) => {
      const particle = findParticleAtPosition(worldPos);

      if (particle) {
        // Store the state before toggling
        const wasStaticBefore = particle.pinned || false;
        const wasGrabbedBefore = particle.grabbed || false;

        // Toggle the pinned state
        particle.pinned = !particle.pinned;

        // Record pin/unpin action for undo
        undoRedo.current?.recordPinToggle(
          particle.id,
          wasStaticBefore,
          wasGrabbedBefore,
          getIdCounter()
        );
      }
    },
    [findParticleAtPosition]
  );

  // Helper function to update velocity preview
  const updateVelocityPreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    const spawnConfig = getSpawnConfig();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    // Only allow drag-to-velocity in single mode
    if (spawnConfig.spawnMode !== "single") return;

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
  }, [getRenderer, getPreviewColor, getSpawnConfig]);

  // Helper function to update size preview
  const updateSizePreview = useCallback(() => {
    const mouseState = mouseStateRef.current;
    const renderer = getRenderer();
    const spawnConfig = getSpawnConfig();
    if (!mouseState.isDown || mouseState.isStreaming || !renderer) return;

    // Only allow drag-to-size in single mode
    if (spawnConfig.spawnMode !== "single") return;

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
    mouseState.originalDragIntent = null;
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

      // Handle ESC key to cancel operations
      if (e.key === "Escape") {
        e.preventDefault(); // Prevent any browser ESC behavior

        // Cancel joint creation if a particle is selected
        if (mouseState.selectedParticle && mouseState.isCreatingJoint) {
          mouseState.selectedParticle = null;
          mouseState.isCreatingJoint = false;

          // Clear visual previews
          const renderer = getRenderer();
          if (renderer) {
            renderer.setJointPreview(null);
            renderer.setSelectedParticle(null);
          }
          return;
        }

        // Cancel drag operations if user is currently dragging
        if (mouseState.isDown && mouseState.isDragging) {
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
          startStreaming(
            mouseState.startPos.x,
            mouseState.startPos.y,
            size,
            mass
          );
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
        // Ignore CMD/Ctrl when shift is pressed (streaming mode) or not in single mode
        if (
          !mouseState.shiftPressed &&
          getSpawnConfig().spawnMode === "single"
        ) {
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

        // If mouse is down, switch back to size mode (only in single mode)
        if (
          mouseState.isDown &&
          !mouseState.isStreaming &&
          getSpawnConfig().spawnMode === "single"
        ) {
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

        // Remove all joints connected to this particle immediately
        const joints = getJoints();
        if (joints) {
          joints.removeJointsForParticle(particle);
        }

        // Mark particle for removal
        particle.mass = 0;
        particle.size = 0; // Immediate visual feedback
      });
    },
    [getSystem, getRenderer, getJoints]
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

      // Handle joint mode
      if (toolMode === "joint") {
        const pos = getWorldPosition(e);
        handleJointClick(pos, e.shiftKey);
        return;
      }

      // Handle grab mode
      if (toolMode === "grab") {
        const pos = getWorldPosition(e);
        handleGrabClick(pos);
        return;
      }

      // Handle pin mode
      if (toolMode === "pin") {
        const pos = getWorldPosition(e);
        handlePinClick(pos);
        return;
      }

      const mouseState = mouseStateRef.current;
      const pos = getWorldPosition(e);

      // Ensure canvas has focus for keyboard events
      canvas.focus();

      // Get spawn config early for use throughout the function
      const spawnConfig = getSpawnConfig();

      // Reset streaming state for new interaction - use ONLY the mouse event's modifier keys
      const wasShiftPressedBefore = mouseState.shiftPressed;
      const wasCmdPressedBefore = mouseState.cmdPressed;
      mouseState.shiftPressed = e.shiftKey;
      mouseState.cmdPressed = e.metaKey || e.ctrlKey;
      mouseState.wasStreaming = false; // Reset for new interaction
      mouseState.isStreaming = false; // Make sure we're not streaming from previous interaction
      mouseState.isDragToVelocity =
        mouseState.cmdPressed &&
        !mouseState.shiftPressed &&
        spawnConfig.spawnMode === "single"; // Only allow drag-to-velocity in single mode
      mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity

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
      // Set the original drag intent based on the initial mode
      mouseState.originalDragIntent = mouseState.isDragToVelocity
        ? "velocity"
        : "size";

      // Pick appropriate color based on renderer color mode
      mouseState.previewColor = getPreviewColor();

      // Capture the colors array from spawn config for consistent streaming
      const currentSpawnConfig = getSpawnConfig();
      mouseState.streamColors =
        currentSpawnConfig.colors.length > 0
          ? [...currentSpawnConfig.colors]
          : [];

      // Handle different spawn modes and shift key combinations
      if (spawnConfig.spawnMode === "draw" && !mouseState.shiftPressed) {
        // Draw mode: start drawing
        startDrawing(pos.x, pos.y);
        return; // Don't show preview when drawing
      } else if (
        spawnConfig.spawnMode === "shape" &&
        !mouseState.shiftPressed
      ) {
        // Shape mode: spawn particles immediately
        spawnShapeParticles(
          pos.x,
          pos.y,
          spawnConfig.shapeSides,
          spawnConfig.shapeLength,
          spawnConfig
        );
        // Set mouse state to prevent additional spawning on mouse up
        mouseState.isDown = true;
        mouseState.wasStreaming = true; // Use this flag to prevent spawning in onMouseUp
        return; // Don't show preview when spawning shape
      } else if (
        mouseState.shiftPressed ||
        spawnConfig.spawnMode === "stream"
      ) {
        // Stream mode: start streaming
        let streamSize;
        let streamMass;
        if (spawnConfig.spawnMode === "stream") {
          // In stream mode, always use current size from spawn config
          streamSize = spawnConfig.defaultSize;
          streamMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        } else if (
          mouseState.activeStreamSize > 0 &&
          mouseState.activeStreamMass > 0
        ) {
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
    [
      getCanvas,
      getRenderer,
      startStreaming,
      startDrawing,
      getWorldPosition,
      getPreviewColor,
    ]
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

      // Handle joint mode preview and particle highlighting
      if (toolMode === "joint") {
        mouseState.currentPos = worldPos;

        // Update particle highlighting
        const hoveredParticle = findParticleAtPosition(worldPos);
        mouseState.highlightedParticle = hoveredParticle;
        renderer.setHighlightedParticle(hoveredParticle);

        // Update selected particle rendering
        if (mouseState.selectedParticle) {
          renderer.setSelectedParticle(mouseState.selectedParticle);
        }

        // Update joint preview if creating a joint
        updateJointPreview();

        return;
      }

      // Handle grab mode
      if (toolMode === "grab") {
        mouseState.currentPos = worldPos;

        if (mouseState.isGrabbing && mouseState.grabbedParticle) {
          // Calculate velocity for throwing
          const currentTime = Date.now();
          const deltaTime = Math.max(
            currentTime - mouseState.grabLastMoveTime,
            1
          ); // Prevent division by zero

          const deltaX = worldPos.x - mouseState.grabPreviousPos.x;
          const deltaY = worldPos.y - mouseState.grabPreviousPos.y;

          // Calculate velocity in pixels per millisecond, then convert to reasonable units
          const velocityScale = 0.5; // Adjust this value to control throwing sensitivity
          mouseState.grabVelocity.x =
            (deltaX / deltaTime) * velocityScale * 1000; // Convert to per second
          mouseState.grabVelocity.y =
            (deltaY / deltaTime) * velocityScale * 1000;

          // Update tracking for next frame
          mouseState.grabPreviousPos = { x: worldPos.x, y: worldPos.y };
          mouseState.grabLastMoveTime = currentTime;

          // Update grabbed particle position
          mouseState.grabbedParticle.position.x =
            worldPos.x - mouseState.grabOffset.x;
          mouseState.grabbedParticle.position.y =
            worldPos.y - mouseState.grabOffset.y;

          // Reset velocity to prevent unwanted movement while dragging
          mouseState.grabbedParticle.velocity.x = 0;
          mouseState.grabbedParticle.velocity.y = 0;
        } else {
          // Update particle highlighting for grab tool
          const hoveredParticle = findParticleAtPosition(worldPos);
          mouseState.highlightedParticle = hoveredParticle;
          renderer.setHighlightedParticle(hoveredParticle);
        }

        return;
      }

      // Handle pin mode
      if (toolMode === "pin") {
        mouseState.currentPos = worldPos;

        // Update particle highlighting for pin tool
        const hoveredParticle = findParticleAtPosition(worldPos);
        mouseState.highlightedParticle = hoveredParticle;
        renderer.setHighlightedParticle(hoveredParticle);

        return;
      }

      if (!mouseState.isDown) return;

      mouseState.currentPos = worldPos;

      // Handle draw mode
      if (mouseState.isDrawing) {
        continueDrawing(worldPos.x, worldPos.y);
        return; // Don't handle other mouse move logic when drawing
      }

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
        startStreaming(
          mouseState.startPos.x,
          mouseState.startPos.y,
          size,
          mass
        );
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

      // Handle CMD/Ctrl mode switching (only when not in streaming mode and in single mode)
      if (!mouseState.shiftPressed && getSpawnConfig().spawnMode === "single") {
        if (!wasCmdPressed && mouseState.cmdPressed) {
          // Just pressed CMD: switch to velocity mode
          mouseState.isDragToVelocity = true;
          // Use the last calculated size from the size preview to preserve the current size
          mouseState.velocityModeSize = mouseState.lastCalculatedSize;
          mouseState.activeVelocitySize = mouseState.lastCalculatedSize; // Store for subsequent clicks
          // Keep originalDragIntent as "size" since this was a drag-to-size operation that switched to velocity mode
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

      // Check if we should enter drag mode (only in single mode)
      if (getSpawnConfig().spawnMode === "single") {
        // Adjust threshold based on zoom level - when zoomed out, use smaller threshold
        const currentRenderer = getRenderer();
        const zoomScale = currentRenderer ? currentRenderer.getZoom() : 1;
        const adjustedThreshold = mouseState.dragThreshold / zoomScale;

        if (distance >= adjustedThreshold) {
          mouseState.isDragging = true;
        }
      }

      // Update preview based on current mode (only in single mode)
      if (getSpawnConfig().spawnMode === "single") {
        if (mouseState.isDragToVelocity && !mouseState.shiftPressed) {
          // Velocity mode: update velocity arrow (ignore shift in velocity mode)
          updateVelocityPreview();
        } else if (!mouseState.shiftPressed) {
          // Size mode: update particle size (normal behavior when not streaming)
          updateSizePreview();
        }
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
      continueDrawing,
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

      // Handle grab mode mouse up
      if (toolMode === "grab" && mouseStateRef.current.isGrabbing) {
        const mouseState = mouseStateRef.current;

        if (mouseState.grabbedParticle) {
          // Apply throwing velocity to the particle
          mouseState.grabbedParticle.velocity.x = mouseState.grabVelocity.x;
          mouseState.grabbedParticle.velocity.y = mouseState.grabVelocity.y;

          // Release the particle by unmarking it as grabbed
          mouseState.grabbedParticle.grabbed = false;
        }

        // Reset grab state
        mouseState.grabbedParticle = null;
        mouseState.isGrabbing = false;

        // Update cursor state for styling
        setIsCurrentlyGrabbing(false);
        mouseState.grabOffset = { x: 0, y: 0 };
        mouseState.grabPreviousPos = { x: 0, y: 0 };
        mouseState.grabLastMoveTime = 0;
        mouseState.grabVelocity = { x: 0, y: 0 };

        return;
      }

      const system = getSystem();
      const renderer = getRenderer();
      if (!system || !renderer) return;

      if (!mouseState.isDown) return;

      // Update shift state from mouse event
      mouseState.shiftPressed = e.shiftKey;

      // If we're drawing, stop drawing when mouse is released
      if (mouseState.isDrawing) {
        stopDrawing();
        // Reset mouse state
        mouseState.isDown = false;
        mouseState.isDragging = false;
        mouseState.previewColor = "";
        mouseState.originalDragIntent = null; // Reset drag intent
        return;
      }

      // If we're streaming, always stop when mouse is released
      if (mouseState.isStreaming) {
        stopStreaming();
        // Reset mouse state
        mouseState.isDown = false;
        mouseState.isDragging = false;
        mouseState.previewColor = "";
        mouseState.wasStreaming = false; // Reset for next interaction
        mouseState.originalDragIntent = null; // Reset drag intent
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
        mouseState.originalDragIntent = null; // Reset drag intent
        return;
      }

      const spawnConfig = getSpawnConfig();

      let finalParticle;

      // === Mass Calculation Logic ===
      // The mass calculation depends on the interaction type and original drag intent:
      // 1. Regular Click: Uses spawnConfig.defaultMass
      // 2. Drag-to-Size: Uses calculateMassFromSize(dragSize)
      // 3. Ctrl+Click+Drag: Uses spawnConfig.defaultMass
      // 4. Click+Drag+Ctrl: Uses calculateMassFromSize(dragSize)

      if (mouseState.isDragToVelocity) {
        // Velocity mode: create particle with the stored size and initial velocity
        let finalSize = mouseState.velocityModeSize;
        let finalMass;
        if (!mouseState.isDragging) {
          // Simple click in velocity mode - use spawn config defaults
          finalSize = spawnConfig.defaultSize;
          finalMass = spawnConfig.defaultMass; // Use configured mass from spawn controls
        } else if (mouseState.originalDragIntent === "velocity") {
          // Drag-to-velocity from a simple click (e.g., cmd+click then drag)
          // Use spawn config mass even though isDragging is true
          finalMass = spawnConfig.defaultMass;
        } else {
          // Drag-to-velocity from a drag-to-size operation (e.g., drag then cmd)
          // Calculate mass from the stored size in velocity mode
          finalMass = calculateMassFromSize(finalSize);
        }

        finalParticle = createParticle(
          mouseState.startPos.x,
          mouseState.startPos.y,
          finalSize,
          mouseState.previewColor, // Use the same color as preview
          mouseState.initialVelocity,
          finalMass,
          spawnConfig.pinned
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
          finalMass,
          spawnConfig.pinned
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
      mouseState.originalDragIntent = null; // Reset drag intent
    },
    [
      getSystem,
      getRenderer,
      stopStreaming,
      stopDrawing,
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
    // Stop drawing when mouse leaves canvas
    if (mouseState.isDrawing) {
      stopDrawing();
    }
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
    // Clear joint previews and selections
    mouseState.selectedParticle = null;
    mouseState.highlightedParticle = null;
    mouseState.isCreatingJoint = false;
    renderer.setJointPreview(null);
    renderer.setHighlightedParticle(null);
    renderer.setSelectedParticle(null);

    // Clear grab mode and release grabbed particle
    if (mouseState.isGrabbing && mouseState.grabbedParticle) {
      // Release the particle by unmarking it as grabbed
      mouseState.grabbedParticle.grabbed = false;
    }
    // Reset grab state
    mouseState.grabbedParticle = null;
    mouseState.isGrabbing = false;

    // Update cursor state for styling
    setIsCurrentlyGrabbing(false);
    mouseState.grabOffset = { x: 0, y: 0 };
    mouseState.grabPreviousPos = { x: 0, y: 0 };
    mouseState.grabLastMoveTime = 0;
    mouseState.grabVelocity = { x: 0, y: 0 };

    mouseState.isDown = false;
    mouseState.isDragging = false;
    mouseState.previewColor = "";
    mouseState.wasStreaming = false; // Reset for next interaction
    mouseState.isDragToVelocity = false; // Reset velocity mode
    mouseState.initialVelocity = { x: 0, y: 0 }; // Reset velocity
    mouseState.velocityModeSize = 0; // Reset velocity mode size
    mouseState.originalDragIntent = null; // Reset drag intent
  }, [
    getRenderer,
    stopStreaming,
    stopDrawing,
    getInteraction,
    updateRemovalPreview,
  ]);

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
    isCurrentlyGrabbing,
  };
}
