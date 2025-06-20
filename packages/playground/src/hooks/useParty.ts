import { useEffect, useRef } from "react";
import {
  Canvas2DRenderer,
  Gravity,
  Particle,
  ParticleSystem,
  Vector2D,
  Bounds,
} from "../../../core/src";

export function useParty() {
  const ref = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    if (ref.current) return;
    const system = new ParticleSystem();
    ref.current = system;

    system.addParticle(
      new Particle({
        position: new Vector2D(100, 100),
        velocity: new Vector2D(0, 0),
        acceleration: new Vector2D(0, 0),
        mass: 100,
        size: 10,
      })
    );

    const gravity = new Gravity({ strength: 1000 });
    const bounds = new Bounds({
      min: new Vector2D(0, 0),
      max: new Vector2D(500, 500),
      bounce: 0.8,
    });
    system.addForce(gravity);
    system.addForce(bounds);

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const renderer = new Canvas2DRenderer({
      canvas,
    });

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const position = new Vector2D(x, y);
      system.addParticle(
        new Particle({
          position,
          velocity: new Vector2D(0, 0),
          mass: 100,
          size: 10,
        })
      );
    });

    setInterval(() => {
      renderer.render(system);
    }, 1000 / 60);

    system.play();

    console.log(system.isPlaying);
  }, []);

  return ref.current;
}
