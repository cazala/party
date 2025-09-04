import { useEffect, useRef, useCallback, useState } from "react";
import {
  WebGPURenderer,
  WebGPUParticleSystem,
  simulationModule,
} from "@cazala/party";
import { Environment } from "@cazala/party/modules/webgpu/shaders/modules/environment";
import { Boundary } from "@cazala/party/modules/webgpu/shaders/modules/boundary";
import { Collisions } from "@cazala/party/modules/webgpu/shaders/modules/collisions";
import { Fluid } from "@cazala/party/modules/webgpu/shaders/modules/fluid";
import { Behavior as WebGPUBehavior } from "@cazala/party/modules/webgpu/shaders/modules/behavior";
import { ToolMode } from "./useToolMode";

export function useWebGPUPlayground(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  _toolMode: ToolMode = "spawn"
) {
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const systemRef = useRef<WebGPUParticleSystem | null>(null);
  const environmentRef = useRef<Environment | null>(null);
  const boundaryRef = useRef<Boundary | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
  const fluidRef = useRef<Fluid | null>(null);
  const behaviorRef = useRef<WebGPUBehavior | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log(
    "WebGPU hook instance:",
    instanceId.current,
    "initialized:",
    isInitialized
  );

  // Initialize WebGPU renderer
  useEffect(() => {
    // Only run if we don't already have a renderer
    if (rendererRef.current || error) {
      return;
    }

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
        console.log("Creating WebGPU renderer...");
        // Use actual canvas dimensions from clientWidth/clientHeight for proper sizing
        const width =
          canvasRef.current.clientWidth || canvasRef.current.width || 800;
        const height =
          canvasRef.current.clientHeight || canvasRef.current.height || 600;

        console.log("Canvas dimensions for WebGPU:", width, "x", height);

        const renderer = new WebGPURenderer({
          canvas: canvasRef.current,
          width,
          height,
        });
        console.log("WebGPU renderer created successfully");

        console.log("Initializing WebGPU renderer...");

        try {
          // Add a timeout to the initialization
          const initPromise = renderer.initialize();
          const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(
              () => reject(new Error("WebGPU renderer initialization timeout")),
              10000
            )
          );

          const success = await Promise.race([initPromise, timeoutPromise]);
          console.log("WebGPU initialization result:", success);

          if (!success) {
            console.error("WebGPU renderer initialize() returned false");
            setError("Failed to initialize WebGPU renderer.");
            return;
          }
        } catch (initError) {
          console.error("Error during renderer initialization:", initError);
          throw initError; // Re-throw to be caught by outer catch
        }

        console.log("=== WEBGPU PLAYGROUND INIT SUCCESS ===");
        setError(null);

        // Create a default particle system with default modules and attach it BEFORE exposing renderer
        try {
          // Create a live Environment instance to manage state
          const environment = new Environment({
            strength: 0,
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
          const behavior = new WebGPUBehavior({ enabled: true });
          // Initialize simulation parameters
          const modules = [
            simulationModule,
            environment,
            boundary,
            collisions,
            behavior,
            fluid,
          ];
          const system = new WebGPUParticleSystem(renderer, modules);
          await system.initialize();
          systemRef.current = system;
          environmentRef.current = environment;
          boundaryRef.current = boundary;
          collisionsRef.current = collisions;
          fluidRef.current = fluid;
          behaviorRef.current = behavior;
        } catch (sysErr) {
          console.error(
            "Failed to create/attach WebGPU particle system:",
            sysErr
          );
        }

        rendererRef.current = renderer;
        console.log(
          "Renderer set to rendererRef.current:",
          !!rendererRef.current
        );
        console.log("Renderer instance:", renderer);
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
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      systemRef.current = null;
      environmentRef.current = null;
      boundaryRef.current = null;
    };
  }, []); // Run once on mount, cleanup on unmount

  const spawnParticles = useCallback(
    (
      numParticles: number,
      shape: "grid" | "random" | "circle" | "donut" | "square",
      spacing: number,
      particleSize: number,
      radius?: number,
      _colors?: string[],
      velocityConfig?: any,
      _innerRadius?: number,
      _squareSize?: number,
      _cornerRadius?: number,
      particleMass?: number,
      _enableJoints?: boolean
    ) => {
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
          rendererExists: !!rendererRef.current,
          rendererValue: rendererRef.current,
          isInitialized,
        }
      );

      if (!rendererRef.current || !systemRef.current) {
        console.warn(
          "WebGPU renderer or system not available for spawning particles (rendererRef.current:",
          rendererRef.current,
          "systemRef.current:",
          systemRef.current,
          ")"
        );
        return;
      }

      // Clear existing particles
      rendererRef.current.clearParticles();

      // Generate particles based on shape
      const particles = [];
      const size = particleSize || 5;
      const mass = particleMass || 1;

      if (shape === "grid") {
        const cols = Math.ceil(Math.sqrt(numParticles));
        const rows = Math.ceil(numParticles / cols);
        const offsetX = (-(cols - 1) * spacing) / 2;
        const offsetY = (-(rows - 1) * spacing) / 2;

        for (let i = 0; i < numParticles; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          particles.push({
            x: offsetX + col * spacing,
            y: offsetY + row * spacing,
            vx: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            vy: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            size,
            mass,
          });
        }
      } else if (shape === "random") {
        const bounds = 400; // Random area size
        for (let i = 0; i < numParticles; i++) {
          particles.push({
            x: (Math.random() - 0.5) * bounds,
            y: (Math.random() - 0.5) * bounds,
            vx: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            vy: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            size,
            mass,
          });
        }
      } else if (shape === "circle") {
        const r = radius || 100;
        for (let i = 0; i < numParticles; i++) {
          const angle = (i / numParticles) * Math.PI * 2;
          particles.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            vx: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            vy: (Math.random() - 0.5) * (velocityConfig?.speed || 0),
            size,
            mass,
          });
        }
      }
      // Add other shapes as needed

      rendererRef.current.spawnParticles(particles);
    },
    [isInitialized]
  );

  // Update WebGPU environment gravity strength uniform
  const setGravityStrength = useCallback(
    (strength: number) => {
      const env = environmentRef.current;
      env?.setStrength(strength);
    },
    [isInitialized]
  );

  const play = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.play();
    }
  }, [isInitialized]);

  const pause = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.pause();
    }
  }, [isInitialized]);

  const clear = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.clearParticles();
    }
  }, [isInitialized]);

  const resetParticles = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.reset();
    }
  }, [isInitialized]);

  const getParticleCount = useCallback(() => {
    return rendererRef.current?.getParticleCount() || 0;
  }, [isInitialized]);

  const getFPS = useCallback(() => {
    return rendererRef.current?.getFPS() || 0;
  }, [isInitialized]);

  // Constrain iterations control
  const constrainIterationsRef = useRef<number>(50);
  const setConstrainIterations = useCallback((v: number) => {
    constrainIterationsRef.current = Math.max(1, Math.floor(v));
    // Expose to renderer/system via a side-channel
    (rendererRef.current as any)?.system?.setConstrainIterations?.(
      constrainIterationsRef.current
    );
  }, []);

  return {
    renderer: rendererRef.current,
    system: systemRef.current,
    environment: environmentRef.current,
    boundary: boundaryRef.current,
    collisions: collisionsRef.current,
    fluid: fluidRef.current,
    behavior: behaviorRef.current,
    isInitialized,
    error,
    spawnParticles,
    setGravityStrength,
    play,
    pause,
    clear,
    resetParticles,
    getParticleCount,
    getFPS,
    setConstrainIterations,
    // Dummy values for compatibility
    interaction: null,
    sensors: null,
    joints: null,
    spatialGrid: null,
    zoomStateRef: { current: { x: 0, y: 0, zoom: 1 } },
    undoRedo: null,
    setSpawnConfig: () => {},
    setEmitterConfig: () => {},
    currentlyGrabbedParticle: null,
    handleGrabToJoint: () => {},
    isCreatingJoint: false,
    handleJointToSpawn: () => {},
  };
}
