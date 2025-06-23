import { useEffect, useRef, useCallback } from "react";
import {
  Canvas2DRenderer,
  Gravity,
  Particle,
  ParticleSystem,
  Vector2D,
  Bounds,
  Flock,
} from "../../../core/src";
import { DEFAULT_GRAVITY_STRENGTH } from "../../../core/src/modules/forces/gravity.js";

export function useParty() {
  const systemRef = useRef<ParticleSystem | null>(null);
  const gravityRef = useRef<Gravity | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const flockRef = useRef<Flock | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);

  useEffect(() => {
    if (systemRef.current) return;

    const gravity = new Gravity({ strength: DEFAULT_GRAVITY_STRENGTH });
    gravityRef.current = gravity;

    const bounds = new Bounds({
      min: new Vector2D(0, 0),
      max: new Vector2D(1500, 840),
    });
    boundsRef.current = bounds;

    const flock = new Flock();
    flockRef.current = flock;

    const system = new ParticleSystem();
    systemRef.current = system;

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const renderer = new Canvas2DRenderer({
      canvas,
      clearColor: "#0D0D12",
    });
    rendererRef.current = renderer;

    system.addParticle(
      new Particle({
        position: new Vector2D(100, 100),
        velocity: new Vector2D(0, 0),
        acceleration: new Vector2D(0, 0),
        mass: 1,
        size: 10,
        color: "#F8F8F8",
      })
    );

    system.addForce(gravity);
    system.addForce(bounds);
    system.addForce(flock);

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const position = new Vector2D(x, y);
      system.addParticle(
        new Particle({
          position,
          velocity: new Vector2D(0, 0),
          mass: 1,
          size: 10,
          color: [
            "#F8F8F8",    // Bright White
            "#FF3C3C",    // Neon Red
            "#00E0FF",    // Cyber Cyan
            "#C85CFF",    // Electric Purple
            "#AFFF00",    // Lime Neon
            "#FF2D95",    // Hot Magenta
            "#FF6A00",    // Sunset Orange
            "#3B82F6",    // Deep Blue Glow
            "#00FFC6",    // Turquoise Mint
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
              "#F8F8F8",    // Bright White
              "#FF3C3C",    // Neon Red
              "#00E0FF",    // Cyber Cyan
              "#C85CFF",    // Electric Purple
              "#AFFF00",    // Lime Neon
              "#FF2D95",    // Hot Magenta
              "#FF6A00",    // Sunset Orange
              "#3B82F6",    // Deep Blue Glow
              "#00FFC6",    // Turquoise Mint
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
    renderer: rendererRef.current,
    // Control functions
    play,
    pause,
    clear,
    updateGravity,
    addParticle,
    updateParticleDefaults,
  };
}
