import { Particle, ParticleOptions } from "./particle.js";
import { Vector2D } from "./vector.js";

export interface GridSpawnOptions {
  particleOptions?: ParticleOptions;
  rows: number;
  cols: number;
  spacing: Vector2D;
  center: Vector2D;
}

export interface RandomSpawnOptions {
  particleOptions?: ParticleOptions;
  bounds: {
    min: Vector2D;
    max: Vector2D;
  };
  count: number;
}

export class Spawner {
  constructor() {}

  spawnGrid(options: GridSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { rows, cols, spacing, center } = options;

    const totalWidth = (cols - 1) * spacing.x;
    const totalHeight = (rows - 1) * spacing.y;
    const startX = center.x - totalWidth / 2;
    const startY = center.y - totalHeight / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = new Vector2D(
          startX + col * spacing.x,
          startY + row * spacing.y
        );

        const particle = new Particle({
          ...options.particleOptions,
          position,
        });

        particles.push(particle);
      }
    }

    return particles;
  }

  spawnRandom(options: RandomSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { bounds, count } = options;

    for (let i = 0; i < count; i++) {
      const position = new Vector2D(
        Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
        Math.random() * (bounds.max.y - bounds.min.y) + bounds.min.y
      );

      const particle = new Particle({
        ...options.particleOptions,
        position,
      });

      particles.push(particle);
    }

    return particles;
  }
}
