import { useEffect, useRef, useCallback, useState } from "react";
import { Engine, simulationModule, WebGPUSpawner } from "@cazala/party";
import { Environment } from "@cazala/party/modules/webgpu/modules/environment";
import { Boundary } from "@cazala/party/modules/webgpu/modules/boundary";
import { Collisions } from "@cazala/party/modules/webgpu/modules/collisions";
import { Fluid } from "@cazala/party/modules/webgpu/modules/fluid";
import { Behavior } from "@cazala/party/modules/webgpu/modules/behavior";
import { Sensors } from "@cazala/party/modules/webgpu/modules/sensors";
import { Trails } from "@cazala/party/modules/webgpu/modules/trails";
import { Interaction } from "@cazala/party/modules/webgpu/modules/interaction";
import { ParticleRenderer } from "@cazala/party/modules/webgpu/modules/particle-renderer";
import { gridModule } from "@cazala/party/modules/webgpu/modules/grid";
import { ToolMode } from "./useToolMode";
// import { GPUResources } from "@cazala/party/modules/webgpu/runtime/gpu-resources";

const zoomSensitivity = 0.01;

export function useWebGPUPlayground(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  _toolMode: ToolMode = "spawn"
) {
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const systemRef = useRef<Engine | null>(null);
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
    const system = systemRef.current;
    const zoomState = zoomStateRef.current;

    if (!system) return;

    const currentZoom = system.getZoom();
    const camera = system.getCamera();

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
      system.setZoom(zoomState.targetZoom);
      system.setCamera(zoomState.targetCameraX, zoomState.targetCameraY);

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

    system.setZoom(newZoom);
    system.setCamera(newCameraX, newCameraY);

    // Continue animation
    zoomState.animationId = requestAnimationFrame(animateZoom);
  }, []);

  const handleZoom = useCallback(
    (deltaY: number, centerX: number, centerY: number) => {
      const system = systemRef.current;
      const zoomState = zoomStateRef.current;
      if (!system) return;

      // Use configurable zoom sensitivity
      const zoomDirection = deltaY > 0 ? -zoomSensitivity : zoomSensitivity;

      const currentTargetZoom = zoomState.isAnimating
        ? zoomState.targetZoom
        : system.getZoom();
      // Clamp target zoom to renderer's min/max (renderer will further clamp)
      const newTargetZoom = Math.max(
        0.1,
        Math.min(2, currentTargetZoom + zoomDirection)
      );

      // Calculate camera adjustment to zoom towards the cursor position
      const currentTargetCamera = zoomState.isAnimating
        ? { x: zoomState.targetCameraX, y: zoomState.targetCameraY }
        : system.getCamera();

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

  console.log(
    "WebGPU hook instance:",
    instanceId.current,
    "initialized:",
    isInitialized
  );

  // Initialize WebGPU renderer
  useEffect(() => {
    let cancelled = false;

    async function waitForCanvasAndInit() {
      // Poll for canvas availability
      const maxAttempts = 50; // 5 seconds with 100ms intervals
      let attempts = 0;

      while (attempts < maxAttempts && !cancelled) {
        console.log(`WebGPU: Attempt ${attempts + 1} - checking for canvas...`);

        if (canvasRef.current) {
          console.log("=== WEBGPU PLAYGROUND INIT START ===");
          console.log("Canvas element found:", canvasRef.current);
          console.log(
            "Canvas dimensions:",
            canvasRef.current.width,
            "x",
            canvasRef.current.height
          );
          break;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (cancelled) return;

      if (!canvasRef.current) {
        console.error("Canvas not found after polling");
        setError("Canvas element not available");
        return;
      }

      try {
        // Create WebGPU renderer directly (diagnostics already validated WebGPU support)
        console.log("Creating WebGPU engine...");
        // Use actual canvas dimensions from clientWidth/clientHeight for proper sizing
        const width =
          canvasRef.current.clientWidth || canvasRef.current.width || 800;
        const height =
          canvasRef.current.clientHeight || canvasRef.current.height || 600;

        console.log("Canvas dimensions for WebGPU:", width, "x", height);

        console.log("WebGPU engine created successfully");

        console.log("Initializing WebGPU engine...");

        console.log("=== WEBGPU PLAYGROUND INIT SUCCESS ===");
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
          const trails = new Trails({ enabled: false });
          const sensors = new Sensors({ enabled: false });
          const interaction = new Interaction({
            enabled: false,
            strength: 10000,
            radius: 500,
          });
          // Initialize simulation parameters
          const modules = [
            simulationModule,
            gridModule,
            environment,
            boundary,
            collisions,
            behavior,
            fluid,
            sensors,
            interaction,
            // Render modules
            trails,
            // Render modules (put ParticleRenderer last so particles draw after effects)
            new ParticleRenderer(),
          ];
          const system = new Engine(canvasRef.current, modules);
          await system.initialize();
          system.setSize(width, height);
          systemRef.current = system;
          environmentRef.current = environment;
          boundaryRef.current = boundary;
          collisionsRef.current = collisions;
          fluidRef.current = fluid;
          behaviorRef.current = behavior;
          sensorsRef.current = sensors;
          trailsRef.current = trails;
          interactionRef.current = interaction;
        } catch (sysErr) {
          console.error(
            "Failed to create/attach WebGPU particle system:",
            sysErr
          );
        }
        setIsInitialized(true);
      } catch (err) {
        console.error("=== WEBGPU PLAYGROUND INIT FAILED ===");
        console.error("WebGPU initialization error:", err);
        console.error("Error details:", {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        });
        setError("WebGPU initialization failed: " + (err as Error).message);
      }
    }

    waitForCanvasAndInit();

    return () => {
      cancelled = true;
      if (systemRef.current) {
        systemRef.current.destroy();
        systemRef.current = null;
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
  }, []); // Run once on mount, cleanup on unmount

  // Wire mouse input to WebGPU Interaction module
  useEffect(() => {
    const canvas = canvasRef.current;
    const interaction = interactionRef.current;
    if (!canvas || !interaction) return;

    const screenToWorld = (sx: number, sy: number) => {
      const size = systemRef.current?.getSize() || { width: 800, height: 600 };
      const system = systemRef.current;
      const cam = system?.getCamera() || { x: 0, y: 0 };
      const zoom = system?.getZoom() || 1;
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
        const sys = systemRef.current as any;
        if (sys?.addParticle) {
          sys.addParticle({ position: [x, y], velocity: [0, 0], size, mass });
        }
        systemRef.current?.play();
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
      const system = systemRef.current;
      console.log(
        "WebGPU spawnParticles called (instance " + instanceId.current + "):",
        {
          numParticles,
          shape,
          spacing,
          particleSize,
          radius,
          velocityConfig,
          particleMass,
          isInitialized,
        }
      );

      if (!system) {
        console.warn(
          "WebGPU system not available for spawning particles (systemRef.current:",
          "systemRef.current:",
          system,
          ")"
        );
        return;
      }

      // Clear existing particles
      system.clear();

      // Generate particles using WebGPUSpawner (camera-centered)
      const spawner = new WebGPUSpawner();

      const cam = system.getCamera();
      // Compute world-space bounds matching the current viewport (fill screen)
      const size = system.getSize();
      const zoom = system.getZoom();
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

      system.setParticles(particles);
    },
    [isInitialized]
  );

  const play = useCallback(() => {
    if (systemRef.current) {
      systemRef.current?.play();
    }
  }, [isInitialized]);

  const pause = useCallback(() => {
    if (systemRef.current) {
      systemRef.current.pause();
    }
  }, [isInitialized]);

  const clear = useCallback(() => {
    if (systemRef.current) {
      systemRef.current.clear();
      // Ensure the loop continues so the cleared scene is presented
      systemRef.current.play();
    }
  }, [isInitialized]);

  const resetParticles = useCallback(() => {
    // Deprecated in favor of restarting via spawn from UI state.
    // Keep as a no-op that clears and resumes.
    if (systemRef.current) {
      systemRef.current.clear();
      systemRef.current.play();
    }
  }, [isInitialized]);

  const getParticleCount = useCallback(() => {
    return systemRef.current?.getCount() || 0;
  }, [isInitialized]);

  const getFPS = useCallback(() => {
    return systemRef.current?.getFPS() || 0;
  }, [isInitialized]);

  return {
    system: systemRef.current,
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
  };
}
