import { useEffect, useRef } from "react";
import {
  Canvas2DRenderer,
  Gravity,
  Particle,
  ParticleSystem,
  Vector2D,
  Bounds,
  Flock,
} from "../../../core/src";

export function useParty() {
  const systemRef = useRef<ParticleSystem | null>(null);
  const gravityRef = useRef<Gravity | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const flockRef = useRef<Flock | null>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);

  useEffect(() => {
    if (systemRef.current) return;

    const gravity = new Gravity({ strength: 0.01 });
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
    });
    rendererRef.current = renderer;

    system.addParticle(
      new Particle({
        position: new Vector2D(100, 100),
        velocity: new Vector2D(0, 0),
        acceleration: new Vector2D(0, 0),
        mass: 1,
        size: 10,
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
          color: ["#FFFFFF", "#FF0000", "#00FF00", "#0000FF"][
            (Math.random() * 4) | 0
          ],
        })
      );
    });

    setInterval(() => {
      renderer.render(system);
    }, 1000 / 60);

    system.play();
  }, []);

  return {
    system: systemRef.current,
    gravity: gravityRef.current,
    bounds: boundsRef.current,
    flock: flockRef.current,
    renderer: rendererRef.current,
  };
}
