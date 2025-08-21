import { useEffect, useRef, useCallback, useState } from "react";
import { WebGPURenderer } from "@cazala/party";
import { ToolMode } from "./useToolMode";

export function useWebGPUPlayground(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  _toolMode: ToolMode = "spawn"
) {
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize WebGPU renderer
  useEffect(() => {
    if (isInitialized || error) {
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
          console.log("Canvas dimensions:", canvasRef.current.width, "x", canvasRef.current.height);
          break;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
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
        const width = canvasRef.current.clientWidth || canvasRef.current.width || 800;
        const height = canvasRef.current.clientHeight || canvasRef.current.height || 600;
        
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
            setTimeout(() => reject(new Error("WebGPU renderer initialization timeout")), 10000)
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
        rendererRef.current = renderer;
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error("=== WEBGPU PLAYGROUND INIT FAILED ===");
        console.error("WebGPU initialization error:", err);
        console.error("Error details:", {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack
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
    };
  }, [isInitialized, error]); // Remove canvasRef.current dependency to avoid infinite loops

  const spawnParticles = useCallback((
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
    if (!rendererRef.current) return;

    // Clear existing particles
    rendererRef.current.clearParticles();

    // Generate particles based on shape
    const particles = [];
    const size = particleSize || 5;
    const mass = particleMass || 1;

    if (shape === "grid") {
      const cols = Math.ceil(Math.sqrt(numParticles));
      const rows = Math.ceil(numParticles / cols);
      const offsetX = -(cols - 1) * spacing / 2;
      const offsetY = -(rows - 1) * spacing / 2;

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
  }, []);

  const setGravityStrength = useCallback((strength: number) => {
    if (rendererRef.current) {
      rendererRef.current.setGravityStrength(strength);
    }
  }, []);

  const play = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.play();
    }
  }, []);

  const pause = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.pause();
    }
  }, []);

  const clear = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.clearParticles();
    }
  }, []);

  const resetParticles = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.reset();
    }
  }, []);

  const getParticleCount = useCallback(() => {
    return rendererRef.current?.getParticleCount() || 0;
  }, []);

  const getFPS = useCallback(() => {
    return rendererRef.current?.getFPS() || 0;
  }, []);

  return {
    renderer: rendererRef.current,
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
    // Dummy values for compatibility
    system: null,
    environment: null,
    boundary: null,
    behavior: null,
    collisions: null,
    fluid: null,
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