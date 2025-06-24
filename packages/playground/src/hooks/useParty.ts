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
} from "../../../core/src";
import { DEFAULT_GRAVITY_STRENGTH } from "../../../core/src/modules/forces/gravity.js";

// Streaming configuration
const STREAM_SPAWN_RATE = 10; // particles per second
const STREAM_SPAWN_INTERVAL = 1000 / STREAM_SPAWN_RATE; // milliseconds between spawns

export function useParty() {
  const systemRef = useRef<ParticleSystem | null>(null);
  const gravityRef = useRef<Gravity | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const flockRef = useRef<Flock | null>(null);
  const collisionsRef = useRef<Collisions | null>(null);
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

    // Mouse state for drag-to-size particle spawning
    let mouseState = {
      isDown: false,
      startPos: { x: 0, y: 0 },
      currentPos: { x: 0, y: 0 },
      isDragging: false,
      dragThreshold: 5, // Will be updated with spawn config
      previewColor: "", // Store the color for the current drag session
      // Streaming state
      isStreaming: false,
      streamInterval: null as number | null,
      streamSize: 0,
      streamPosition: { x: 0, y: 0 },
      shiftPressed: false,
      wasStreaming: false, // Track if we were streaming during this mouse session
      activeStreamSize: 0, // Size to use for streaming while shift is held down
    };

    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const getDistance = (
      pos1: { x: number; y: number },
      pos2: { x: number; y: number }
    ) => {
      return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
    };

    const calculateParticleSize = (distance: number) => {
      const spawnConfig = (window as any).__getSpawnConfig?.();
      const baseSize = spawnConfig?.particleSize || 10;

      // If user hasn't entered drag mode yet, use default size for small movements
      if (!mouseState.isDragging && distance < mouseState.dragThreshold) {
        return baseSize;
      }

      // Once in drag mode, always calculate size based on distance (no clamping to default)
      const calculatedSize = Math.max(3, Math.min(50, distance / 2));
      return calculatedSize;
    };

    const getRandomColor = () => {
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
      return colors[(Math.random() * colors.length) | 0];
    };

    const createParticle = (
      x: number,
      y: number,
      size: number,
      color?: string
    ) => {
      // Make mass proportional to area: mass = π * (radius)² / scale_factor
      // radius = size (since size IS the radius), scale_factor keeps default reasonable
      const radius = size;
      const area = Math.PI * radius * radius;
      const mass = area / 100; // Scale factor to keep default size=10 around mass=3.14

      return new Particle({
        position: new Vector2D(x, y),
        velocity: new Vector2D(0, 0),
        acceleration: new Vector2D(0, 0),
        mass,
        size,
        color: color || getRandomColor(),
      });
    };

    // Streaming functions
    const startStreaming = (x: number, y: number, size: number) => {
      if (mouseState.isStreaming) {
        stopStreaming();
      }
      
      mouseState.isStreaming = true;
      mouseState.streamPosition = { x, y };
      mouseState.streamSize = size;
      
      // Spawn the first particle immediately at the exact position
      const firstParticle = createParticle(x, y, size);
      system.addParticle(firstParticle);
      
      // Then start the interval for subsequent particles
      mouseState.streamInterval = window.setInterval(() => {
        const particle = createParticle(
          mouseState.streamPosition.x,
          mouseState.streamPosition.y,
          mouseState.streamSize
        );
        system.addParticle(particle);
      }, STREAM_SPAWN_INTERVAL);
    };

    const stopStreaming = () => {
      if (mouseState.streamInterval) {
        clearInterval(mouseState.streamInterval);
        mouseState.streamInterval = null;
      }
      mouseState.isStreaming = false;
    };

    // Keyboard event listeners for shift key detection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        mouseState.shiftPressed = true;
        
        // If mouse is down and we're not streaming yet, start streaming
        if (mouseState.isDown && !mouseState.isStreaming) {
          const distance = getDistance(mouseState.startPos, mouseState.currentPos);
          const size = calculateParticleSize(distance);
          startStreaming(mouseState.startPos.x, mouseState.startPos.y, size);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        mouseState.shiftPressed = false;
        mouseState.activeStreamSize = 0; // Reset stream size when shift is released
        if (mouseState.isStreaming) {
          stopStreaming();
          mouseState.wasStreaming = true;
        }
      }
    };

    // Add keyboard listeners to both window and canvas
    // Make canvas focusable
    canvas.setAttribute('tabindex', '0');
    canvas.style.outline = 'none'; // Remove focus outline
    
    // Test function to check if keyboard events work at all
    const testKeyHandler = (_e: KeyboardEvent) => {
      // Keyboard events for debugging if needed
    };
    
    // Add global keyboard listeners - these should always work
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', testKeyHandler);
    
    // Also add to window as backup
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // And to canvas for when it has focus
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);
    
    // Focus the canvas so it can receive keyboard events
    canvas.focus();
    
    // Add click handler to refocus canvas
    canvas.addEventListener('click', () => {
      canvas.focus();
    });
    

    canvas.addEventListener("mousedown", (e) => {
      const pos = getMousePos(e);
      
      // Ensure canvas has focus for keyboard events
      canvas.focus();
      
      // Reset streaming state for new interaction - use ONLY the mouse event's shiftKey
      const wasShiftPressedBefore = mouseState.shiftPressed;
      mouseState.shiftPressed = e.shiftKey;
      mouseState.wasStreaming = false; // Reset for new interaction
      mouseState.isStreaming = false; // Make sure we're not streaming from previous interaction
      
      // If shift was released between interactions, reset the active stream size
      if (wasShiftPressedBefore && !mouseState.shiftPressed) {
        mouseState.activeStreamSize = 0;
      }

      // Update threshold from current spawn config
      const spawnConfig = (window as any).__getSpawnConfig?.();
      if (spawnConfig?.dragThreshold !== undefined) {
        mouseState.dragThreshold = spawnConfig.dragThreshold;
      }

      mouseState.isDown = true;
      mouseState.startPos = pos;
      mouseState.currentPos = pos;
      mouseState.isDragging = false;

      // Pick a random color for this drag session and store it
      mouseState.previewColor = getRandomColor();

      // If shift is pressed during mouse down, start streaming immediately
      if (mouseState.shiftPressed) {
        let streamSize;
        if (mouseState.activeStreamSize > 0) {
          // Use the preserved size from previous drag-to-size
          streamSize = mouseState.activeStreamSize;
        } else {
          // Use default size for first shift+click
          streamSize = spawnConfig?.particleSize || 10;
          mouseState.activeStreamSize = streamSize; // Store for subsequent clicks
        }
        startStreaming(pos.x, pos.y, streamSize);
        mouseState.wasStreaming = true; // Mark that we were streaming
        return; // Don't show preview when streaming
      }

      // Create and show preview particle with the selected color
      const distance = 0;
      const size = calculateParticleSize(distance);
      const previewParticle = createParticle(
        pos.x,
        pos.y,
        size,
        mouseState.previewColor
      );
      renderer.setPreviewParticle(previewParticle, false); // Not in drag mode yet
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!mouseState.isDown) return;
      
      const pos = getMousePos(e);
      mouseState.currentPos = pos;
      
      // Update shift state from mouse event
      const wasShiftPressed = mouseState.shiftPressed;
      mouseState.shiftPressed = e.shiftKey;
      
      // If shift was just released during streaming, stop streaming
      if (wasShiftPressed && !mouseState.shiftPressed && mouseState.isStreaming) {
        stopStreaming();
        mouseState.wasStreaming = true; // Mark that we were streaming
        // Don't show preview again - user already placed particles via streaming
      }
      
      // If shift was just pressed during mouse move, start streaming
      if (!wasShiftPressed && mouseState.shiftPressed && !mouseState.isStreaming) {
        const distance = getDistance(mouseState.startPos, mouseState.currentPos);
        const size = calculateParticleSize(distance);
        mouseState.activeStreamSize = size; // Store this size for subsequent clicks
        startStreaming(mouseState.startPos.x, mouseState.startPos.y, size);
        mouseState.wasStreaming = true; // Mark that we were streaming
        // Hide the preview particle when streaming starts
        renderer.setPreviewParticle(null, false);
      }
      
      // If we're streaming, update the stream position to follow the cursor
      if (mouseState.isStreaming) {
        mouseState.streamPosition = { x: pos.x, y: pos.y };
        return; // Don't update preview when streaming
      }
      
      // If we were streaming during this session, don't show preview
      if (mouseState.wasStreaming) {
        return;
      }
      
      const distance = getDistance(mouseState.startPos, pos);

      // Check if we should enter drag mode
      if (distance >= mouseState.dragThreshold) {
        mouseState.isDragging = true;
      }

      // Update preview particle size based on distance, but keep the same color
      const size = calculateParticleSize(distance);
      const previewParticle = createParticle(
        mouseState.startPos.x,
        mouseState.startPos.y,
        size,
        mouseState.previewColor
      );
      renderer.setPreviewParticle(previewParticle, mouseState.isDragging); // Show dashed outline only when dragging
    });

    canvas.addEventListener("mouseup", (e) => {
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
        mouseState.isDown = false;
        mouseState.isDragging = false;
        mouseState.previewColor = "";
        mouseState.wasStreaming = false; // Reset for next interaction
        return;
      }

      const distance = getDistance(mouseState.startPos, mouseState.currentPos);
      const size = calculateParticleSize(distance);

      // Add the final particle to the system with the same color as preview
      const finalParticle = createParticle(
        mouseState.startPos.x,
        mouseState.startPos.y,
        size,
        mouseState.previewColor
      );
      system.addParticle(finalParticle);

      // Clear preview particle
      renderer.setPreviewParticle(null, false);

      // Reset mouse state
      mouseState.isDown = false;
      mouseState.isDragging = false;
      mouseState.previewColor = "";
      mouseState.wasStreaming = false; // Reset for next interaction
    });

    canvas.addEventListener("mouseleave", () => {
      // Stop streaming when mouse leaves canvas
      if (mouseState.isStreaming) {
        stopStreaming();
      }
      // Clear preview particle when mouse leaves canvas
      renderer.setPreviewParticle(null, false);
      mouseState.isDown = false;
      mouseState.isDragging = false;
      mouseState.previewColor = "";
      mouseState.wasStreaming = false; // Reset for next interaction
    });

    setInterval(() => {
      renderer.render(system);
    }, 1000 / 60);

    system.play();

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', testKeyHandler);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('keyup', handleKeyUp);
      if (mouseState.streamInterval) {
        clearInterval(mouseState.streamInterval);
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
      systemRef.current.particles = [];
    }
  }, []);

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
