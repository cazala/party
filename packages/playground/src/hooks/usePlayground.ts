import { useEffect, useRef, useCallback, useState } from "react";
import {
  Canvas2DRenderer,
  Physics,
  Particle,
  System,
  Vector2D,
  Boundary,
  Behavior,
  Collisions,
  Fluid,
  Interaction,
  Sensors,
  Joints,
  type SpatialGrid,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
  DEFAULT_GRAVITY_STRENGTH,
  getIdCounter,
  Spawner,
  type VelocityConfig,
  degToRad,
} from "@cazala/party";
import { useInteractions } from "./useInteractions";
import { SpawnConfig } from "../components/control-sections/SpawnControls";
import { EmitterConfig } from "../components/control-sections/EmitterControls";
import { ToolMode } from "./useToolMode";
import { useUndoRedo } from "./useUndoRedo";
import { calculateMassFromSize } from "../utils/particle";

/**
 * Custom React hook that wires together the core particle *engine* with the
 * interactive playground UI.
 *
 * It is responsible for:
 * 1.  Lazy-initialising the `ParticleSystem`, renderer and default forces
 *     when the component mounts.
 * 2.  Exposing a set of imperative helpers (`play`, `pause`, `spawnParticles`, …)
 *     that UI components can call.
 * 3.  Delegating all pointer/keyboard interaction logic to `useInteractions`,
 *     which in turn feeds previews / particles back into the system.
 *
 * Consumers only access **live** instances (system, gravity, bounds, …) via
 * the returned fields – these are updated through mutable refs so re-renders
 * aren't triggered for every internal mutation.
 */
export function usePlayground(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  toolMode: ToolMode = "spawn"
) {
  const systemRef = useRef<System | null>(null);
  // Individual force/utility refs – kept outside of React state because the
  // physics engine mutates them on every tick.
  const physicsRef = useRef<Physics | null>(null);
  const boundsRef = useRef<Boundary | null>(null);
  const behaviorRef = useRef<Behavior | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const fluidRef = useRef<Fluid | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const sensorsRef = useRef<Sensors | null>(null);
  const jointsRef = useRef<Joints | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const spatialGridRef = useRef<SpatialGrid | null>(null);

  // Spawn configuration state
  const [spawnConfig, setSpawnConfig] = useState<SpawnConfig>({
    defaultSize: 10,
    defaultMass: calculateMassFromSize(10),
    colors: [], // Empty array means use default palette
    spawnMode: "single",
    streamRate: 10,
    drawStepSize: 20,
    pinned: false,
    shapeSides: 3,
    shapeLength: 50,
  });

  // Emitter configuration state
  const [emitterConfig, setEmitterConfig] = useState<EmitterConfig>({
    particleSize: 10,
    particleMass: calculateMassFromSize(10),
    rate: 10, // particles per second
    direction: 0, // angle in radians (pointing right)
    speed: 100, // scalar velocity
    amplitude: Math.PI * 2, // 360 degrees in radians (full spread)
    colors: [], // Empty array means use default palette
    zIndex: 0, // default render depth
    // Lifetime properties
    infinite: true, // particles live forever by default
    duration: 5000, // 5 seconds when not infinite
    endSizeMultiplier: 1, // no size change by default
    endAlpha: 1, // no alpha change by default
    endColors: [], // no end color change by default
    endSpeedMultiplier: 1, // no speed change by default
  });

  // ---------------------------------------------------------------------------
  // Zoom handling
  // ---------------------------------------------------------------------------
  const zoomStateRef = useRef({
    targetZoom: 1,
    targetCameraX: 0,
    targetCameraY: 0,
    isAnimating: false,
    animationId: null as number | null,
  });

  const animateZoom = useCallback(() => {
    const renderer = rendererRef.current;
    const boundary = boundsRef.current;
    const spatialGrid = spatialGridRef.current;
    const zoomState = zoomStateRef.current;

    if (!renderer || !boundary || !spatialGrid) return;

    const currentZoom = renderer.getZoom();
    const camera = renderer.getCamera();

    // Smooth interpolation with easing
    const easeFactor = 0.15; // Higher = faster, lower = smoother
    const zoomDiff = zoomState.targetZoom - currentZoom;
    const cameraDiffX = zoomState.targetCameraX - camera.x;
    const cameraDiffY = zoomState.targetCameraY - camera.y;

    // Check if we're close enough to the target (within 0.01% difference)
    const threshold = 0.001;
    if (
      Math.abs(zoomDiff) < threshold &&
      Math.abs(cameraDiffX) < threshold &&
      Math.abs(cameraDiffY) < threshold
    ) {
      // Animation complete - set exact target values
      renderer.setZoom(zoomState.targetZoom);
      renderer.setCamera(zoomState.targetCameraX, zoomState.targetCameraY);
      boundary.setCamera(
        zoomState.targetCameraX,
        zoomState.targetCameraY,
        zoomState.targetZoom
      );
      spatialGrid.setCamera(
        zoomState.targetCameraX,
        zoomState.targetCameraY,
        zoomState.targetZoom
      );

      zoomState.isAnimating = false;
      if (zoomState.animationId) {
        cancelAnimationFrame(zoomState.animationId);
        zoomState.animationId = null;
      }
      return;
    }

    // Apply smooth interpolation
    const newZoom = currentZoom + zoomDiff * easeFactor;
    const newCameraX = camera.x + cameraDiffX * easeFactor;
    const newCameraY = camera.y + cameraDiffY * easeFactor;

    renderer.setZoom(newZoom);
    renderer.setCamera(newCameraX, newCameraY);
    boundary.setCamera(newCameraX, newCameraY, newZoom);
    spatialGrid.setCamera(newCameraX, newCameraY, newZoom);

    // Continue animation
    zoomState.animationId = requestAnimationFrame(animateZoom);
  }, []);

  const handleZoom = useCallback(
    (deltaY: number, centerX: number, centerY: number) => {
      const renderer = rendererRef.current;
      const zoomState = zoomStateRef.current;
      if (!renderer) return;

      // Much smaller zoom steps for smoother control
      const zoomSensitivity = 0.01; // Reduced from 0.1 (10x smoother)
      const zoomDirection = deltaY > 0 ? -zoomSensitivity : zoomSensitivity;

      const currentTargetZoom = zoomState.isAnimating
        ? zoomState.targetZoom
        : renderer.getZoom();
      const newTargetZoom = Math.max(
        0.1,
        Math.min(2, currentTargetZoom + zoomDirection)
      );

      // Calculate camera adjustment to zoom towards the cursor position
      const currentTargetCamera = zoomState.isAnimating
        ? { x: zoomState.targetCameraX, y: zoomState.targetCameraY }
        : renderer.getCamera();

      const zoomDelta = newTargetZoom / currentTargetZoom;
      const newTargetCameraX =
        currentTargetCamera.x +
        (centerX - currentTargetCamera.x) * (1 - zoomDelta);
      const newTargetCameraY =
        currentTargetCamera.y +
        (centerY - currentTargetCamera.y) * (1 - zoomDelta);

      // Update target values
      zoomState.targetZoom = newTargetZoom;
      zoomState.targetCameraX = newTargetCameraX;
      zoomState.targetCameraY = newTargetCameraY;

      // Start animation if not already running
      if (!zoomState.isAnimating) {
        zoomState.isAnimating = true;
        zoomState.animationId = requestAnimationFrame(animateZoom);
      }
    },
    [animateZoom]
  );

  // ---------------------------------------------------------------------------
  // Undo/Redo system
  // ---------------------------------------------------------------------------
  const undoRedo = useUndoRedo(
    () => systemRef.current,
    () => jointsRef.current,
    () => systemRef.current?.emitters || null
  );
  const undoRedoRef = useRef(undoRedo);
  undoRedoRef.current = undoRedo;

  // ---------------------------------------------------------------------------
  // Interaction handling (mouse + keyboard)
  // ---------------------------------------------------------------------------
  // All pointer/key logic lives in `useInteractions`.  We simply provide lazy
  // getters so that the helper can always access the *latest* instances.
  const interactions = useInteractions({
    getSystem: () => systemRef.current,
    getRenderer: () => rendererRef.current,
    getCanvas: () => canvasRef.current,
    getInteraction: () => interactionRef.current,
    getJoints: () => jointsRef.current,
    getEmitters: () => systemRef.current?.emitters || null,
    getSpawnConfig: () => spawnConfig,
    getEmitterConfig: () => emitterConfig,
    onZoom: handleZoom,
    toolMode,
    undoRedo: undoRedoRef,
  });

  // Extract interaction state and handlers for tool switching
  const {
    currentlyGrabbedParticle,
    handleGrabToJoint,
    handleJointToSpawn,
    isCreatingJoint,
  } = interactions;

  // Attach / detach low-level DOM listeners once – they call back into the
  // `spawner` helpers defined above.
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.addEventListener("mousedown", interactions.onMouseDown);
      canvasRef.current.addEventListener("mousemove", interactions.onMouseMove);
      canvasRef.current.addEventListener("mouseup", interactions.onMouseUp);
      canvasRef.current.addEventListener(
        "mouseleave",
        interactions.onMouseLeave
      );
      canvasRef.current.addEventListener(
        "contextmenu",
        interactions.onContextMenu
      );
      canvasRef.current.addEventListener("wheel", interactions.onWheel);
    }
    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener(
          "mousedown",
          interactions.onMouseDown
        );
        canvasRef.current.removeEventListener(
          "mousemove",
          interactions.onMouseMove
        );
        canvasRef.current.removeEventListener(
          "mouseup",
          interactions.onMouseUp
        );
        canvasRef.current.removeEventListener(
          "mouseleave",
          interactions.onMouseLeave
        );
        canvasRef.current.removeEventListener(
          "contextmenu",
          interactions.onContextMenu
        );
        canvasRef.current.removeEventListener("wheel", interactions.onWheel);
      }
    };
  }, [canvasRef, interactions]);

  // ---------------------------------------------------------------------------
  // Engine bootstrap – only runs once on mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (systemRef.current) return;

    const physics = new Physics({
      gravity: { strength: DEFAULT_GRAVITY_STRENGTH },
    });
    physicsRef.current = physics;

    const boundary = new Boundary({ physics: physics });
    boundsRef.current = boundary;

    const behavior = new Behavior({ enabled: false }); // Playground default: on
    behaviorRef.current = behavior;

    const joints = new Joints({ enabled: true }); // Playground default: on
    jointsRef.current = joints;

    const collisions = new Collisions({ joints: joints, physics: physics });
    collisionsRef.current = collisions;

    const fluid = new Fluid({ enabled: false }); // Playground default: off
    fluidRef.current = fluid;

    const interaction = new Interaction();
    interactionRef.current = interaction;

    const sensors = new Sensors({ enableTrail: false }); // Playground default: off
    sensorsRef.current = sensors;

    const system = new System({
      width: canvasRef.current?.width || 1200,
      height: canvasRef.current?.height || 800,
      cellSize: DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
    systemRef.current = system;
    spatialGridRef.current = system.spatialGrid;
    const renderer = new Canvas2DRenderer({
      canvas: canvasRef.current!,
      clearColor: "#000000",
      sensors: sensors,
    });
    rendererRef.current = renderer;

    // Connect renderer to sensors for pixel reading
    sensors.setRenderer(renderer);

    system.addForce(physics);
    system.addForce(boundary);
    system.addForce(behavior);
    system.addForce(collisions);
    system.addForce(fluid);
    system.addForce(interaction);
    system.addForce(sensors);
    system.addForce(joints);

    system.setRenderCallback((system) => {
      renderer.render(system);
    });

    // Initialize boundary with initial camera position and zoom
    boundary.setCamera(0, 0, 1);

    system.play();

    interactions.setupKeyboardListeners();

    // Cleanup function
    return () => {
      interactions.cleanup();

      // Cleanup zoom animation
      const zoomState = zoomStateRef.current;
      if (zoomState.animationId) {
        cancelAnimationFrame(zoomState.animationId);
        zoomState.animationId = null;
        zoomState.isAnimating = false;
      }
    };
  }, []);

  const play = useCallback(() => {
    if (systemRef.current) {
      systemRef.current.play();
    }
  }, []);

  const pause = useCallback(() => {
    if (systemRef.current) {
      systemRef.current.pause();
    }
  }, []);

  const clear = useCallback(() => {
    if (systemRef.current) {
      // Record particles before clearing for undo
      if (systemRef.current.particles.length > 0) {
        undoRedo.recordSystemClear(
          [...systemRef.current.particles],
          getIdCounter()
        );
      }
      systemRef.current.clear();

      // Clear all joints when clearing particles
      if (jointsRef.current) {
        jointsRef.current.clear();
      }

      // Clear the canvas completely (full background repaint with 100% alpha)
      if (rendererRef.current) {
        rendererRef.current.clearCanvas();
      }
    }
  }, [undoRedo]);

  // ---------------------------------------------------------------------------
  // Programmatic particle spawning helpers
  // ---------------------------------------------------------------------------
  const spawnParticles = useCallback(
    (
      numParticles: number,
      shape: "grid" | "random" | "circle" | "donut" | "square",
      spacing: number,
      particleSize: number = 10,
      radius: number = 100,
      colors?: string[],
      velocityConfig?: {
        speed: number;
        direction:
          | "random"
          | "in"
          | "out"
          | "custom"
          | "clockwise"
          | "counter-clockwise";
        angle: number;
      },
      innerRadius: number = 50,
      squareSize: number = 200,
      cornerRadius: number = 0,
      particleMass?: number
    ) => {
      if (!systemRef.current) return;

      // Clear existing particles
      systemRef.current.particles = [];

      // Clear the canvas completely (full background repaint with 100% alpha)
      if (rendererRef.current) {
        rendererRef.current.clearCanvas();
      }

      const canvasWidth = systemRef.current.width;
      const canvasHeight = systemRef.current.height;

      // Calculate visible world center based on current camera position and zoom
      const renderer = rendererRef.current;
      if (!renderer) return;

      const camera = renderer.getCamera();
      const zoom = renderer.getZoom();

      // Center of visible world area
      const centerX = (-camera.x + canvasWidth / 2) / zoom;
      const centerY = (-camera.y + canvasHeight / 2) / zoom;
      const center = new Vector2D(centerX, centerY);

      // Use colors array directly - no conversion needed

      // Convert playground velocity config to core VelocityConfig
      const coreVelocityConfig: VelocityConfig | undefined = velocityConfig
        ? {
            speed: velocityConfig.speed,
            direction: velocityConfig.direction,
            angle: degToRad(velocityConfig.angle), // Convert degrees to radians
            center: center,
          }
        : undefined;

      // Get current spawn config when function is called, not as dependency
      const currentSpawnConfig = spawnConfig;

      // Common particle options
      const particleOptions = {
        mass: particleMass ?? currentSpawnConfig.defaultMass,
        size: particleSize,
        acceleration: new Vector2D(0, 0),
        pinned: currentSpawnConfig.pinned,
      };

      const spawner = new Spawner();

      // Use the initParticles utility for simplified spawning
      const particles = spawner.initParticles({
        count: numParticles,
        shape,
        center,
        particleOptions,
        velocityConfig: coreVelocityConfig,
        colors:
          colors ||
          (currentSpawnConfig.colors.length > 0
            ? currentSpawnConfig.colors
            : undefined),
        spacing,
        radius,
        innerRadius,
        squareSize,
        cornerRadius,
        camera: { position: new Vector2D(camera.x, camera.y), zoom },
        canvasSize: { width: canvasWidth, height: canvasHeight },
      });

      // Add all particles to the system
      for (const particle of particles) {
        systemRef.current.addParticle(particle);
      }
    },
    [] // No dependencies - get current values when called
  );

  // Replace the entire particle array based on the current spawn configuration
  // exposed globally by the Controls sidebar.
  const resetParticles = useCallback(() => {
    // Clear the canvas completely (full background repaint with 100% alpha)
    if (rendererRef.current) {
      rendererRef.current.clearCanvas();
    }

    // Clear all joints when restarting
    if (jointsRef.current) {
      jointsRef.current.clear();
    }

    // This will be called with current spawn config from Controls
    const initConfig = (window as any).__getInitConfig?.();
    if (initConfig) {
      spawnParticles(
        initConfig.numParticles,
        initConfig.shape,
        initConfig.spacing,
        initConfig.particleSize,
        initConfig.radius,
        initConfig.colors,
        initConfig.velocityConfig,
        initConfig.innerRadius,
        initConfig.squareSize,
        initConfig.cornerRadius
      );
    } else {
      // Fallback to default
      spawnParticles(100, "grid", 50, 10, 100);
    }
  }, [spawnParticles]);

  const updateGravity = useCallback((strength: number) => {
    if (physicsRef.current) {
      physicsRef.current.setStrength(strength);
    }
  }, []);

  const updateInertia = useCallback((inertia: number) => {
    if (physicsRef.current) {
      physicsRef.current.setInertia(inertia);
    }
  }, []);

  const updateFriction = useCallback((friction: number) => {
    if (physicsRef.current) {
      physicsRef.current.setFriction(friction);
    }
  }, []);

  const addParticle = useCallback(
    (
      x: number,
      y: number,
      options?: Partial<{
        mass: number;
        size: number;
        color: string;
      }>
    ) => {
      if (systemRef.current) {
        const particle = new Particle({
          position: new Vector2D(x, y),
          velocity: new Vector2D(0, 0),
          acceleration: new Vector2D(0, 0),
          mass: options?.mass || 1,
          size: options?.size || 10,
          color:
            options?.color ||
            [
              "#F8F8F8", // Bright White
              "#FF3C3C", // Neon Red
              // "#00E0FF", // Cyber Cyan
              // "#C85CFF", // Electric Purple
              // "#AFFF00", // Lime Neon
              // "#FF2D95", // Hot Magenta
              // "#FF6A00", // Sunset Orange
              // "#3B82F6", // Deep Blue Glow
              // "#00FFC6", // Turquoise Mint
            ][(Math.random() * 9) | 0],
        });
        systemRef.current.addParticle(particle);
      }
    },
    []
  );

  const updateParticleDefaults = useCallback(
    (options: { mass?: number; size?: number }) => {
      // This will affect new particles created via click
      // We store the defaults for the click handler
      const canvas = document.getElementById("canvas") as HTMLCanvasElement;
      if (canvas && systemRef.current) {
        // Remove existing click listener and add new one with updated defaults
        const newClickHandler = (e: MouseEvent) => {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          addParticle(x, y, options);
        };

        // Store the handler reference for cleanup
        (canvas as any).__clickHandler = newClickHandler;
        canvas.addEventListener("click", newClickHandler);
      }
    },
    [addParticle]
  );

  return {
    // Live engine handles ------------------------------------------------------
    system: systemRef.current,
    physics: physicsRef.current,
    boundary: boundsRef.current,
    behavior: behaviorRef.current,
    collisions: collisionsRef.current,
    fluid: fluidRef.current,
    interaction: interactionRef.current,
    sensors: sensorsRef.current,
    joints: jointsRef.current,
    renderer: rendererRef.current,
    spatialGrid: spatialGridRef.current,
    zoomStateRef, // Expose zoom state for session loading
    undoRedo, // Expose undo/redo for session loading
    // Control functions
    play,
    pause,
    clear,
    resetParticles,
    spawnParticles,
    updateGravity,
    updateInertia,
    updateFriction,
    addParticle,
    updateParticleDefaults,
    // Spawn config
    spawnConfig,
    setSpawnConfig,
    // Emitter config
    emitterConfig,
    setEmitterConfig,
    // Grab state for cursor styling
    currentlyGrabbedParticle,
    // Grab-to-joint handler
    handleGrabToJoint,
    // Joint creation state and handler
    isCreatingJoint,
    handleJointToSpawn,
  };
}
