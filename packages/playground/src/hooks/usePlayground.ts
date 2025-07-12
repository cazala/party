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
  Fluid,
  Interaction,
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
  const fluidRef = useRef<Fluid | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const spatialGridRef = useRef<SpatialGrid | null>(null);

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
    const bounds = boundsRef.current;
    const spatialGrid = spatialGridRef.current;
    const zoomState = zoomStateRef.current;

    if (!renderer || !bounds || !spatialGrid) return;

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
      bounds.setCamera(
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
    bounds.setCamera(newCameraX, newCameraY, newZoom);
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
  // Interaction handling (mouse + keyboard)
  // ---------------------------------------------------------------------------
  // All pointer/key logic lives in `useInteractions`.  We simply provide lazy
  // getters so that the helper can always access the *latest* instances.
  const interactions = useInteractions({
    getSystem: () => systemRef.current,
    getRenderer: () => rendererRef.current,
    getCanvas: () => canvasRef.current,
    getInteraction: () => interactionRef.current,
    onZoom: handleZoom,
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

    const gravity = new Gravity({ strength: DEFAULT_GRAVITY_STRENGTH });
    gravityRef.current = gravity;

    const bounds = new Bounds();
    boundsRef.current = bounds;

    const flock = new Flock();
    flockRef.current = flock;

    const collisions = new Collisions();
    collisionsRef.current = collisions;

    const fluid = new Fluid();
    fluidRef.current = fluid;

    const interaction = new Interaction();
    interactionRef.current = interaction;

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
    system.addForce(fluid);
    system.addForce(interaction);

    system.setRenderCallback((system) => {
      renderer.render(system);
    });

    // Initialize bounds with initial camera position and zoom
    bounds.setCamera(0, 0, 1);

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
      systemRef.current.clear();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Programmatic particle spawning helpers
  // ---------------------------------------------------------------------------
  const spawnParticles = useCallback(
    (
      numParticles: number,
      shape: "grid" | "random" | "circle",
      spacing: number,
      particleSize: number = 10,
      _dragThreshold: number = 5,
      radius: number = 100
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

      // Calculate visible world center based on current camera position and zoom
      const renderer = rendererRef.current;
      if (!renderer) return;

      const camera = renderer.getCamera();
      const zoom = renderer.getZoom();

      // Center of visible world area
      const centerX = (-camera.x + canvasWidth / 2) / zoom;
      const centerY = (-camera.y + canvasHeight / 2) / zoom;

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
      } else if (shape === "circle") {
        // Circle placement with uniform distribution in concentric rings
        if (numParticles === 1) {
          // Special case: single particle at center
          const particleRadius = particleSize;
          const area = Math.PI * particleRadius * particleRadius;
          const mass = area / 100;

          const particle = new Particle({
            position: new Vector2D(centerX, centerY),
            velocity: new Vector2D(0, 0),
            acceleration: new Vector2D(0, 0),
            mass: mass,
            size: particleSize,
            color: colors[Math.floor(Math.random() * colors.length)],
          });

          systemRef.current.addParticle(particle);
        } else {
          // Calculate optimal number of rings to fill the entire radius
          const minSpacing = particleSize * 1.5; // Minimum spacing between particles
          
          // Estimate number of rings needed to distribute particles evenly
          const estimatedRings = Math.max(1, Math.ceil(Math.sqrt(numParticles / Math.PI)));
          
          let particlesPlaced = 0;
          
          for (let ring = 0; ring < estimatedRings && particlesPlaced < numParticles; ring++) {
            const ringRadius = ring === 0 ? 0 : (radius * (ring + 1)) / estimatedRings;
            
            // Calculate particles for this ring
            let particlesInRing;
            if (ring === 0) {
              // Center ring gets 1 particle
              particlesInRing = 1;
            } else {
              // Calculate based on circumference and remaining particles
              const circumference = 2 * Math.PI * ringRadius;
              const maxParticlesInRing = Math.max(1, Math.floor(circumference / minSpacing));
              
              // Distribute remaining particles among remaining rings
              const remainingRings = estimatedRings - ring;
              const remainingParticles = numParticles - particlesPlaced;
              const averagePerRing = Math.ceil(remainingParticles / remainingRings);
              
              particlesInRing = Math.min(maxParticlesInRing, averagePerRing, remainingParticles);
            }
            
            for (let p = 0; p < particlesInRing; p++) {
              const angle = (2 * Math.PI * p) / particlesInRing;
              
              // Calculate position relative to center
              const x = centerX + ringRadius * Math.cos(angle);
              const y = centerY + ringRadius * Math.sin(angle);

              // Calculate mass based on area like createParticle function
              const particleRadius = particleSize;
              const area = Math.PI * particleRadius * particleRadius;
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
              particlesPlaced++;
              
              if (particlesPlaced >= numParticles) break;
            }
          }
        }
      } else {
        // Random placement within visible world area
        for (let i = 0; i < numParticles; i++) {
          // Calculate visible world bounds
          const worldLeft = -camera.x / zoom;
          const worldTop = -camera.y / zoom;
          const worldRight = (canvasWidth - camera.x) / zoom;
          const worldBottom = (canvasHeight - camera.y) / zoom;

          // Keep particles within bounds considering their size
          const x =
            worldLeft +
            particleSize +
            Math.random() * (worldRight - worldLeft - particleSize * 2);
          const y =
            worldTop +
            particleSize +
            Math.random() * (worldBottom - worldTop - particleSize * 2);

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
        spawnConfig.dragThreshold,
        spawnConfig.radius
      );
    } else {
      // Fallback to default
      spawnParticles(100, "grid", 50, 10, 5, 100);
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
    fluid: fluidRef.current,
    interaction: interactionRef.current,
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
