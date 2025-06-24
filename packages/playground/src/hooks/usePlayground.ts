import { useEffect, useRef, useCallback } from "react";
import {
  Canvas2DRenderer,
  Gravity,
  Particle,
  ParticleSystem,
  Vector2D,
  Bounds,
  Flock,
  Collisions,
  type SpatialGrid,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
  DEFAULT_GRAVITY_STRENGTH,
} from "@party/core";
import { useInteractions } from "./useInteractions";

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
export function usePlayground(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const systemRef = useRef<ParticleSystem | null>(null);
  // Individual force/utility refs – kept outside of React state because the
  // physics engine mutates them on every tick.
  const gravityRef = useRef<Gravity | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const flockRef = useRef<Flock | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const spatialGridRef = useRef<SpatialGrid | null>(null);

  // ---------------------------------------------------------------------------
  // Interaction handling (mouse + keyboard)
  // ---------------------------------------------------------------------------
  // All pointer/key logic lives in `useInteractions`.  We simply provide lazy
  // getters so that the helper can always access the *latest* instances.
  const interactions = useInteractions({
    getSystem: () => systemRef.current,
    getRenderer: () => rendererRef.current,
    getCanvas: () => canvasRef.current,
  });

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
      }
    };
  }, [canvasRef, interactions]);

  // ---------------------------------------------------------------------------
  // Engine bootstrap – only runs once on mount.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (systemRef.current) return;

    const gravity = new Gravity({ strength: DEFAULT_GRAVITY_STRENGTH });
    gravityRef.current = gravity;

    const bounds = new Bounds();
    boundsRef.current = bounds;

    const flock = new Flock();
    flockRef.current = flock;

    const collisions = new Collisions();
    collisionsRef.current = collisions;

    const system = new ParticleSystem({
      width: canvasRef.current?.width || 1200,
      height: canvasRef.current?.height || 800,
      cellSize: DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
    systemRef.current = system;
    spatialGridRef.current = system.spatialGrid;
    const renderer = new Canvas2DRenderer({
      canvas: canvasRef.current!,
      clearColor: "#0D0D12",
    });
    rendererRef.current = renderer;

    system.addForce(gravity);
    system.addForce(bounds);
    system.addForce(flock);
    system.addForce(collisions);

    setInterval(() => {
      renderer.render(system);
    }, 1000 / 60);

    system.play();

    // Cleanup function
    return () => {
      interactions.cleanup();
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
      systemRef.current.particles = [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Programmatic particle spawning helpers
  // ---------------------------------------------------------------------------
  const spawnParticles = useCallback(
    (
      numParticles: number,
      shape: "grid" | "random",
      spacing: number,
      particleSize: number = 10,
      _dragThreshold: number = 5
    ) => {
      if (!systemRef.current) return;

      // dragThreshold is handled via spawn config in mouse events
      // Clear existing particles
      systemRef.current.particles = [];

      const colors = [
        "#F8F8F8", // Bright White
        "#FF3C3C", // Neon Red
        "#00E0FF", // Cyber Cyan
        "#C85CFF", // Electric Purple
        "#AFFF00", // Lime Neon
        "#FF2D95", // Hot Magenta
        "#FF6A00", // Sunset Orange
        "#3B82F6", // Deep Blue Glow
        "#00FFC6", // Turquoise Mint
      ];

      const canvasWidth = systemRef.current.width;
      const canvasHeight = systemRef.current.height;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      if (shape === "grid") {
        const particlesPerRow = Math.ceil(Math.sqrt(numParticles));
        const particlesPerCol = Math.ceil(numParticles / particlesPerRow);

        // Ensure spacing is at least particle diameter to prevent touching
        const safeSpacing = Math.max(spacing, particleSize * 2);

        for (let i = 0; i < numParticles; i++) {
          const x =
            centerX +
            ((i % particlesPerRow) - particlesPerRow / 2 + 0.5) * safeSpacing;
          const y =
            centerY +
            (Math.floor(i / particlesPerRow) - particlesPerCol / 2 + 0.5) *
              safeSpacing;

          // Calculate mass based on area like createParticle function
          const radius = particleSize;
          const area = Math.PI * radius * radius;
          const mass = area / 100;

          const particle = new Particle({
            position: new Vector2D(x, y),
            velocity: new Vector2D(0, 0),
            acceleration: new Vector2D(0, 0),
            mass: mass, // Mass proportional to area
            size: particleSize,
            color: colors[Math.floor(Math.random() * colors.length)],
          });

          systemRef.current.addParticle(particle);
        }
      } else {
        // Random placement
        for (let i = 0; i < numParticles; i++) {
          // Keep particles within bounds considering their size
          const x =
            particleSize + Math.random() * (canvasWidth - particleSize * 2);
          const y =
            particleSize + Math.random() * (canvasHeight - particleSize * 2);

          // Calculate mass based on area like createParticle function
          const radius = particleSize;
          const area = Math.PI * radius * radius;
          const mass = area / 100;

          const particle = new Particle({
            position: new Vector2D(x, y),
            velocity: new Vector2D(0, 0),
            acceleration: new Vector2D(0, 0),
            mass: mass, // Mass proportional to area
            size: particleSize,
            color: colors[Math.floor(Math.random() * colors.length)],
          });

          systemRef.current.addParticle(particle);
        }
      }
    },
    []
  );

  // Replace the entire particle array based on the current spawn configuration
  // exposed globally by the Controls sidebar.
  const resetParticles = useCallback(() => {
    // This will be called with current spawn config from Controls
    const spawnConfig = (window as any).__getSpawnConfig?.();
    if (spawnConfig) {
      spawnParticles(
        spawnConfig.numParticles,
        spawnConfig.shape,
        spawnConfig.spacing,
        spawnConfig.particleSize,
        spawnConfig.dragThreshold
      );
    } else {
      // Fallback to default
      spawnParticles(100, "grid", 50, 10, 5);
    }
  }, [spawnParticles]);

  const updateGravity = useCallback((strength: number) => {
    if (gravityRef.current) {
      gravityRef.current.strength = strength;
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
    gravity: gravityRef.current,
    bounds: boundsRef.current,
    flock: flockRef.current,
    collisions: collisionsRef.current,
    renderer: rendererRef.current,
    spatialGrid: spatialGridRef.current,
    // Control functions
    play,
    pause,
    clear,
    resetParticles,
    spawnParticles,
    updateGravity,
    addParticle,
    updateParticleDefaults,
  };
}
