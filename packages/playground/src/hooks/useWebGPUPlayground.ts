import { useEffect, useRef, useCallback, useState } from "react";
import {
  Environment,
  Boundary,
  Collisions,
  Fluid,
  Behavior,
  Sensors,
  Trails,
  Interaction,
  Engine,
  WebGPUSpawner,
} from "@cazala/party";
import { Particle as ParticleRenderer } from "@cazala/party";
import { ToolMode } from "./useToolMode";

const zoomSensitivity = 0.01;

export function useWebGPUPlayground(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  _toolMode: ToolMode = "spawn"
) {
  const engineRef = useRef<Engine | null>(null);
  const environmentRef = useRef<Environment | null>(null);
  const boundaryRef = useRef<Boundary | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const fluidRef = useRef<Fluid | null>(null);
  const behaviorRef = useRef<Behavior | null>(null);
  const sensorsRef = useRef<Sensors | null>(null);
  const trailsRef = useRef<Trails | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWebGPU, setUseWebGPU] = useState(false);

  // Store state for engine switching
  const engineStateRef = useRef<{
    particles?: any[];
    moduleSettings?: {
      environment?: any;
      boundary?: any;
      collisions?: any;
      fluid?: any;
      behavior?: any;
      sensors?: any;
      trails?: any;
      interaction?: any;
    };
    coordinateState?: {
      size: { width: number; height: number };
      camera: { x: number; y: number };
      zoom: number;
    };
  }>({});

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
    const engine = engineRef.current;
    const zoomState = zoomStateRef.current;

    if (!engine) return;

    const currentZoom = engine.getZoom();
    const camera = engine.getCamera();

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
      engine.setZoom(zoomState.targetZoom);
      engine.setCamera(zoomState.targetCameraX, zoomState.targetCameraY);

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

    engine.setZoom(newZoom);
    engine.setCamera(newCameraX, newCameraY);

    // Continue animation
    zoomState.animationId = requestAnimationFrame(animateZoom);
  }, []);

  const handleZoom = useCallback(
    (deltaY: number, centerX: number, centerY: number) => {
      const engine = engineRef.current;
      const zoomState = zoomStateRef.current;
      if (!engine) return;

      // Use configurable zoom sensitivity
      const zoomDirection = deltaY > 0 ? -zoomSensitivity : zoomSensitivity;

      const currentTargetZoom = zoomState.isAnimating
        ? zoomState.targetZoom
        : engine.getZoom();
      // Clamp target zoom to renderer's min/max (renderer will further clamp)
      const newTargetZoom = Math.max(
        0.1,
        Math.min(2, currentTargetZoom + zoomDirection)
      );

      // Calculate camera adjustment to zoom towards the cursor position
      const currentTargetCamera = zoomState.isAnimating
        ? { x: zoomState.targetCameraX, y: zoomState.targetCameraY }
        : engine.getCamera();

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

  // Initialize WebGPU renderer
  useEffect(() => {
    let cancelled = false;

    // Clean up previous engine when switching types (state already captured in toggle function)
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
      environmentRef.current = null;
      boundaryRef.current = null;
      collisionsRef.current = null;
      fluidRef.current = null;
      behaviorRef.current = null;
      sensorsRef.current = null;
      trailsRef.current = null;
      interactionRef.current = null;
      setIsInitialized(false);
      setError(null);
    }

    async function waitForCanvasAndInit() {
      // Wait a bit for React to recreate the canvas with new key
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Poll for canvas availability
      const maxAttempts = 50; // 5 seconds with 100ms intervals
      let attempts = 0;

      while (attempts < maxAttempts && !cancelled) {
        if (canvasRef.current) {
          break;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (cancelled) return;

      if (!canvasRef.current) {
        setError("Canvas element not available");
        return;
      }

      try {
        const width = canvasRef.current.width || 800;
        const height = canvasRef.current.height || 600;
        setError(null);

        // Create a default particle system with default modules and attach it BEFORE exposing renderer
        try {
          // Create a live Environment instance to manage state
          const environment = new Environment({
            gravityStrength: 0,
            dirX: 0,
            dirY: 1,
            inertia: 0,
            friction: 0,
            damping: 0,
          });
          const boundary = new Boundary({
            restitution: 0.6,
            friction: 0.1,
            mode: "bounce",
          });
          const collisions = new Collisions({ restitution: 0.8 });
          const fluid = new Fluid({ enabled: false });
          const behavior = new Behavior({ enabled: false });
          const sensors = new Sensors({ enabled: false });
          const interaction = new Interaction({
            enabled: false,
            strength: 10000,
            radius: 500,
          });

          const trails = new Trails({ enabled: false });
          const particle = new ParticleRenderer();

          // Initialize simulation parameters
          const forces = [
            environment,
            boundary,
            collisions,
            behavior,
            fluid,
            sensors,
            interaction,
          ];
          const render = [trails, particle];
          // Try creating the engine with retries for context conflicts
          let engine;
          let initSuccess = false;
          const maxRetries = 3;

          for (let retry = 0; retry < maxRetries && !initSuccess; retry++) {
            try {
              if (retry > 0) {
                await new Promise((resolve) =>
                  setTimeout(resolve, 200 * retry)
                );
              }

              engine = new Engine({
                canvas: canvasRef.current,
                forces,
                render,
                runtime: useWebGPU ? "webgpu" : "cpu",
              });
              await engine.initialize();
              initSuccess = true;
            } catch (initError: any) {
              if (engine) {
                try {
                  engine.destroy();
                } catch (destroyError) {
                  console.warn("Error destroying failed engine:", destroyError);
                }
                engine = null;
              }

              // If this is the last retry, throw the error
              if (retry === maxRetries - 1) {
                throw initError;
              }
            }
          }

          if (!engine) {
            throw new Error("Failed to create engine after retries");
          }

          // Set initial size for the engine
          engine.setSize(width, height);
          engineRef.current = engine;
          environmentRef.current = environment;
          boundaryRef.current = boundary;
          collisionsRef.current = collisions;
          fluidRef.current = fluid;
          behaviorRef.current = behavior;
          sensorsRef.current = sensors;
          trailsRef.current = trails;
          interactionRef.current = interaction;
        } catch (sysErr) {
          // If WebGPU fails and we were trying WebGPU, fallback to CPU
          if (
            useWebGPU &&
            (sysErr as Error).message.includes("WebGPU context")
          ) {
            setUseWebGPU(false);
            return; // Let the useEffect re-run with CPU mode
          }
        }

        // Let the engine fully initialize before restoring state
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Pause physics during state restoration to prevent corruption
        if (engineRef.current) {
          engineRef.current.pause();
        }

        // Restore captured state if available (after engine is fully set up)
        if (
          engineStateRef.current.particles ||
          engineStateRef.current.moduleSettings
        ) {
          // First, restore module settings using dynamic import
          if (engineStateRef.current.moduleSettings && engineRef.current) {
            try {
              engineRef.current.import(engineStateRef.current.moduleSettings);
            } catch (settingsError) {
              console.error(
                "Failed to restore module settings:",
                settingsError
              );
            }
          }

          // Then restore particles
          if (
            engineStateRef.current.particles &&
            engineStateRef.current.particles.length > 0 &&
            engineRef.current
          ) {
            try {
              const particles = engineStateRef.current.particles;

              // Deep clone the particles to avoid reference issues
              const clonedParticles = particles.map((p) => ({
                position: { x: p.position.x, y: p.position.y },
                velocity: { x: p.velocity.x, y: p.velocity.y }, // Preserve velocity for both engines
                size: p.size,
                mass: p.mass,
                color: {
                  r: p.color.r,
                  g: p.color.g,
                  b: p.color.b,
                  a: p.color.a,
                },
              }));

              engineRef.current.setParticles(clonedParticles);
            } catch (particlesError) {
              console.error("Failed to restore particles:", particlesError);
            }
          }

          // Ensure the engine is playing after restoration
          if (engineRef.current) {
            // Restore coordinate system state if available to maintain consistent positioning
            if (engineStateRef.current.coordinateState) {
              const coordState = engineStateRef.current.coordinateState;
              engineRef.current.setSize(
                coordState.size.width,
                coordState.size.height
              );
              engineRef.current.setCamera(
                coordState.camera.x,
                coordState.camera.y
              );
              engineRef.current.setZoom(coordState.zoom);
            } else {
              // If no coordinate state, sync canvas size
              const currentCanvasWidth = canvasRef.current.width || width;
              const currentCanvasHeight = canvasRef.current?.height || height;
              engineRef.current.setSize(
                currentCanvasWidth,
                currentCanvasHeight
              );
              // Reset camera/zoom to ensure particles are visible
              engineRef.current.setCamera(0, 0);
              engineRef.current.setZoom(1);
            }

            // Wait a moment for everything to settle, then start physics
            setTimeout(() => {
              if (engineRef.current) {
                engineRef.current.play();
              }
            }, 100);
          }

          // Clear the captured state after restoration
          engineStateRef.current = {};
        }

        setIsInitialized(true);
      } catch (err) {
        setError(
          `${useWebGPU ? "WebGPU" : "CPU"} initialization failed: ` +
            (err as Error).message
        );
      }
    }

    waitForCanvasAndInit();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      environmentRef.current = null;
      boundaryRef.current = null;
      collisionsRef.current = null;
      fluidRef.current = null;
      behaviorRef.current = null;
      sensorsRef.current = null;

      // Cleanup zoom animation
      const zoomState = zoomStateRef.current;
      if (zoomState.animationId) {
        cancelAnimationFrame(zoomState.animationId);
        zoomState.animationId = null;
        zoomState.isAnimating = false;
      }
    };
  }, [useWebGPU]); // Re-initialize when engine type changes

  // Wire mouse input to WebGPU Interaction module
  useEffect(() => {
    const canvas = canvasRef.current;
    const interaction = interactionRef.current;
    if (!canvas || !interaction) return;

    const screenToWorld = (sx: number, sy: number) => {
      const size = engineRef.current?.getSize() || { width: 800, height: 600 };
      const engine = engineRef.current;
      const cam = engine?.getCamera() || { x: 0, y: 0 };
      const zoom = engine?.getZoom() || 1;
      const rect = canvas.getBoundingClientRect();
      const scaleX = size.width / Math.max(rect.width, 1e-6);
      const scaleY = size.height / Math.max(rect.height, 1e-6);
      const px = sx * scaleX;
      const py = sy * scaleY;
      const dx = px - size.width / 2;
      const dy = py - size.height / 2;
      const wx = cam.x + dx / Math.max(zoom, 1e-6);
      const wy = cam.y + dy / Math.max(zoom, 1e-6);
      return { x: wx, y: wy };
    };

    const updateMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToWorld(sx, sy);
      interaction.setMousePosition(x, y);
    };

    const onMouseMove = (e: MouseEvent) => {
      updateMousePos(e);
    };

    const onMouseDown = (e: MouseEvent) => {
      updateMousePos(e);
      // Spawn tool should not trigger interaction
      const tool = (window as any).__webgpu_tool as
        | "cursor"
        | "spawn"
        | undefined;
      if (tool === "spawn") {
        // Translate to world coords and append a particle
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const size = 5;
        const mass = 1;
        const { x, y } = screenToWorld(sx, sy);
        const sys = engineRef.current as any;
        if (sys?.addParticle) {
          sys.addParticle({ position: [x, y], velocity: [0, 0], size, mass });
        }
        engineRef.current?.play();
        return;
      }
      if (e.button === 0) {
        interaction.setInputButton(0);
      } else if (e.button === 2) {
        interaction.setInputButton(1);
      }
    };

    const onMouseUp = () => {
      interaction.setInputButton(2); // none
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
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
  }, [canvasRef.current, interactionRef.current]);

  const spawnParticles = useCallback(
    (
      numParticles: number,
      shape: "grid" | "random" | "circle" | "donut" | "square",
      spacing: number,
      particleSize: number,
      radius?: number,
      colors?: string[],
      velocityConfig?: any,
      innerRadius?: number,
      squareSize?: number,
      cornerRadius?: number,
      particleMass?: number
    ) => {
      const engine = engineRef.current;
      if (!engine) {
        return;
      }

      // Clear existing particles
      engine.clear();

      // Generate particles using WebGPUSpawner (camera-centered)
      const spawner = new WebGPUSpawner();

      const cam = engine.getCamera();
      // Compute world-space bounds matching the current viewport (fill screen)
      const size = engine.getSize();
      const zoom = engine.getZoom();
      const worldWidth = size.width / Math.max(zoom, 0.0001);
      const worldHeight = size.height / Math.max(zoom, 0.0001);

      const particles = spawner.initParticles({
        count: numParticles,
        colors,
        shape,
        center: cam,
        spacing,
        radius: radius || 100,
        innerRadius: innerRadius || 50,
        squareSize: squareSize || 200,
        cornerRadius: cornerRadius || 0,
        size: particleSize || 5,
        mass: particleMass || 1,
        bounds: { width: worldWidth, height: worldHeight },
        velocity: velocityConfig
          ? {
              speed: velocityConfig.speed,
              direction: velocityConfig.direction,
              angle:
                velocityConfig.direction === "custom"
                  ? (velocityConfig.angle * Math.PI) / 180
                  : undefined,
            }
          : undefined,
      });

      // Apply UI-selected colors randomly to spawned particles if provided
      // kept for reference if needed in future color utils

      engine.setParticles(particles);
    },
    [isInitialized]
  );

  const play = useCallback(() => {
    if (engineRef.current) {
      engineRef.current?.play();
    }
  }, [isInitialized]);

  const pause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
  }, [isInitialized]);

  const clear = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.clear();
      // Ensure the loop continues so the cleared scene is presented
      engineRef.current.play();
    }
  }, [isInitialized]);

  const resetParticles = useCallback(() => {
    // Deprecated in favor of restarting via spawn from UI state.
    // Keep as a no-op that clears and resumes.
    if (engineRef.current) {
      engineRef.current.clear();
      engineRef.current.play();
    }
  }, [isInitialized]);

  const getParticleCount = useCallback(() => {
    return engineRef.current?.getCount() || 0;
  }, [isInitialized]);

  const getFPS = useCallback(() => {
    return engineRef.current?.getFPS() || 0;
  }, [isInitialized]);

  const toggleEngineType = useCallback(async () => {
    // Always clear previous state first to avoid reuse
    engineStateRef.current = {};

    // Capture state BEFORE changing useWebGPU (which triggers canvas recreation)
    if (engineRef.current) {
      try {
        // For WebGPU engines, pause and wait to ensure latest GPU state is captured
        if (useWebGPU) {
          engineRef.current.pause();
          // Wait for current frame to complete and GPU pipeline to settle
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Capture particles
        let particles = await engineRef.current.getParticles();
        engineStateRef.current.particles = particles;

        // Capture coordinate system state
        const captureSize = engineRef.current.getSize();
        const captureCamera = engineRef.current.getCamera();
        const captureZoom = engineRef.current.getZoom();
        engineStateRef.current.coordinateState = {
          size: captureSize,
          camera: captureCamera,
          zoom: captureZoom,
        };

        // Capture module settings using dynamic export
        const moduleSettings = engineRef.current.export();
        engineStateRef.current.moduleSettings = moduleSettings;
      } catch (captureError) {
        console.error(
          `Failed to capture ${useWebGPU ? "WebGPU" : "CPU"} engine state:`,
          captureError
        );
        engineStateRef.current = {}; // Reset on error
      }
    } else {
      engineStateRef.current = {}; // Ensure clean state
    }

    setUseWebGPU(!useWebGPU);
  }, [useWebGPU]);

  return {
    system: engineRef.current,
    environment: environmentRef.current,
    boundary: boundaryRef.current,
    collisions: collisionsRef.current,
    fluid: fluidRef.current,
    behavior: behaviorRef.current,
    sensors: sensorsRef.current,
    trails: trailsRef.current,
    interaction: interactionRef.current,
    isInitialized,
    error,
    spawnParticles,
    play,
    pause,
    clear,
    resetParticles,
    getParticleCount,
    getFPS,
    handleZoom,
    useWebGPU,
    toggleEngineType,
    engineType: useWebGPU ? "webgpu" : "cpu", // For canvas key
  };
}
