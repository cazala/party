import { Particle, ParticleOptions } from "./particle";
import { Vector2D } from "./vector";

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

export interface CircleSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector2D;
  radius: number;
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

  spawnCircle(options: CircleSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, radius, count } = options;

    if (count === 1) {
      // Special case: single particle at center
      const particle = new Particle({
        ...options.particleOptions,
        position: new Vector2D(center.x, center.y),
      });
      particles.push(particle);
      return particles;
    }

    // Calculate optimal number of rings to fill the entire radius
    const particleSize = options.particleOptions?.size || 10;
    const minSpacing = particleSize * 1.5; // Minimum spacing between particles
    
    // Estimate number of rings needed to distribute particles evenly
    const estimatedRings = Math.max(1, Math.ceil(Math.sqrt(count / Math.PI)));
    
    let particlesPlaced = 0;
    
    for (let ring = 0; ring < estimatedRings && particlesPlaced < count; ring++) {
      const ringRadius = ring === 0 ? 0 : (radius * (ring + 1)) / estimatedRings;
      
      // Calculate particles for this ring
      let particlesInRing;
      if (ring === 0) {
        // Center ring gets 1 particle
        particlesInRing = 1;
      } else {
        // Calculate based on circumference and remaining particles
        const circumference = 2 * Math.PI * ringRadius;
        const maxParticlesInRing = Math.max(1, Math.floor(circumference / minSpacing));
        
        // Distribute remaining particles among remaining rings
        const remainingRings = estimatedRings - ring;
        const remainingParticles = count - particlesPlaced;
        const averagePerRing = Math.ceil(remainingParticles / remainingRings);
        
        particlesInRing = Math.min(maxParticlesInRing, averagePerRing, remainingParticles);
      }
      
      for (let p = 0; p < particlesInRing; p++) {
        const angle = (2 * Math.PI * p) / particlesInRing;
        
        const position = new Vector2D(
          center.x + ringRadius * Math.cos(angle),
          center.y + ringRadius * Math.sin(angle)
        );

        const particle = new Particle({
          ...options.particleOptions,
          position,
        });

        particles.push(particle);
        particlesPlaced++;
        
        if (particlesPlaced >= count) break;
      }
    }

    return particles;
  }
}
