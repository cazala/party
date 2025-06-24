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
  Friction,
  type SpatialGrid,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
} from "../../../core/src";
import { DEFAULT_GRAVITY_STRENGTH } from "../../../core/src/modules/forces/gravity.js";

export function useParty() {
  const systemRef = useRef<ParticleSystem | null>(null);
  const gravityRef = useRef<Gravity | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const flockRef = useRef<Flock | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const frictionRef = useRef<Friction | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const spatialGridRef = useRef<SpatialGrid | null>(null);

  useEffect(() => {
    if (systemRef.current) return;

    const gravity = new Gravity({ strength: DEFAULT_GRAVITY_STRENGTH });
    gravityRef.current = gravity;

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;

    const bounds = new Bounds();
    boundsRef.current = bounds;

    const flock = new Flock();
    flockRef.current = flock;

    const collisions = new Collisions();
    collisionsRef.current = collisions;

    const friction = new Friction();
    frictionRef.current = friction;

    const system = new ParticleSystem({
      width: canvas.width || 1200,
      height: canvas.height || 800,
      cellSize: DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
    systemRef.current = system;
    spatialGridRef.current = system.spatialGrid;
    const renderer = new Canvas2DRenderer({
      canvas,
      clearColor: "#0D0D12",
    });
    rendererRef.current = renderer;

    system.addForce(gravity);
    system.addForce(bounds);
    system.addForce(flock);
    system.addForce(collisions);
    system.addForce(friction);

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const position = new Vector2D(x, y);
      
      // Get current particle size from spawn config, fallback to 10
      const spawnConfig = (window as any).__getSpawnConfig?.();
      const currentSize = spawnConfig?.particleSize || 10;
      
      system.addParticle(
        new Particle({
          position,
          velocity: new Vector2D(0, 0),
          mass: 1,
          size: currentSize,
          color: [
            "#F8F8F8", // Bright White
            "#FF3C3C", // Neon Red
            "#00E0FF", // Cyber Cyan
            "#C85CFF", // Electric Purple
            "#AFFF00", // Lime Neon
            "#FF2D95", // Hot Magenta
            "#FF6A00", // Sunset Orange
            "#3B82F6", // Deep Blue Glow
            "#00FFC6", // Turquoise Mint
          ][(Math.random() * 9) | 0],
        })
      );
    });

    setInterval(() => {
      renderer.render(system);
    }, 1000 / 60);

    system.play();
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

  const spawnParticles = useCallback(
    (numParticles: number, shape: "grid" | "random", spacing: number, particleSize: number = 10) => {
      if (!systemRef.current) return;

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

          const particle = new Particle({
            position: new Vector2D(x, y),
            velocity: new Vector2D(0, 0),
            acceleration: new Vector2D(0, 0),
            mass: 1,
            size: particleSize,
            color: colors[Math.floor(Math.random() * colors.length)],
          });

          systemRef.current.addParticle(particle);
        }
      } else {
        // Random placement
        for (let i = 0; i < numParticles; i++) {
          // Keep particles within bounds considering their size
          const x = particleSize + Math.random() * (canvasWidth - particleSize * 2);
          const y = particleSize + Math.random() * (canvasHeight - particleSize * 2);

          const particle = new Particle({
            position: new Vector2D(x, y),
            velocity: new Vector2D(0, 0),
            acceleration: new Vector2D(0, 0),
            mass: 1,
            size: particleSize,
            color: colors[Math.floor(Math.random() * colors.length)],
          });

          systemRef.current.addParticle(particle);
        }
      }
    },
    []
  );

  const resetParticles = useCallback(() => {
    // This will be called with current spawn config from Controls
    const spawnConfig = (window as any).__getSpawnConfig?.();
    if (spawnConfig) {
      spawnParticles(
        spawnConfig.numParticles,
        spawnConfig.shape,
        spawnConfig.spacing,
        spawnConfig.particleSize
      );
    } else {
      // Fallback to default
      spawnParticles(100, "grid", 50, 10);
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
    system: systemRef.current,
    gravity: gravityRef.current,
    bounds: boundsRef.current,
    flock: flockRef.current,
    collisions: collisionsRef.current,
    friction: frictionRef.current,
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
