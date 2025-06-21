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
        mass: 1,
        size: 10,
      })
    );

    system.addForce(new Gravity({ strength: 0.01 }));
    system.addForce(
      new Bounds({
        min: new Vector2D(0, 0),
        max: new Vector2D(1500, 840),
        bounce: 0.8,
      })
    );
    system.addForce(new Flock());

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

    console.log(system.isPlaying);
  }, []);

  return ref.current;
}
