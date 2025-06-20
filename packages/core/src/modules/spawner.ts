import { Particle, ParticleOptions } from './particle.js';
import { Vector2D } from './vector.js';

export interface SpawnerOptions {
  particleOptions?: Partial<ParticleOptions>;
  spawnRate?: number;
  maxParticles?: number;
}

export type SpawnPattern = 'random' | 'grid' | 'circle' | 'line';

export interface GridSpawnOptions {
  rows: number;
  cols: number;
  spacing: Vector2D;
  center: Vector2D;
}

export interface CircleSpawnOptions {
  center: Vector2D;
  radius: number;
  count: number;
}

export interface LineSpawnOptions {
  start: Vector2D;
  end: Vector2D;
  count: number;
}

export interface RandomSpawnOptions {
  bounds: {
    min: Vector2D;
    max: Vector2D;
  };
  count: number;
}

export class Spawner {
  public particleOptions: Partial<ParticleOptions>;
  public spawnRate: number;
  public maxParticles: number;
  
  private lastSpawnTime: number = 0;

  constructor(options: SpawnerOptions = {}) {
    this.particleOptions = options.particleOptions || {};
    this.spawnRate = options.spawnRate || 10; // particles per second
    this.maxParticles = options.maxParticles || 100;
  }

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
          ...this.particleOptions,
          position
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
        ...this.particleOptions,
        position
      });

      particles.push(particle);
    }

    return particles;
  }

  spawnCircle(options: CircleSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, radius, count } = options;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const position = new Vector2D(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius
      );

      const particle = new Particle({
        ...this.particleOptions,
        position
      });

      particles.push(particle);
    }

    return particles;
  }

  spawnLine(options: LineSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { start, end, count } = options;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const position = new Vector2D(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t
      );

      const particle = new Particle({
        ...this.particleOptions,
        position
      });

      particles.push(particle);
    }

    return particles;
  }

  spawnAt(position: Vector2D, velocity?: Vector2D): Particle {
    return new Particle({
      ...this.particleOptions,
      position: position.clone(),
      velocity: velocity?.clone() || this.particleOptions.velocity
    });
  }

  spawnBurst(position: Vector2D, count: number, speed: number = 100): Particle[] {
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const velocity = Vector2D.fromAngle(angle, speed);
      
      const particle = new Particle({
        ...this.particleOptions,
        position: position.clone(),
        velocity
      });

      particles.push(particle);
    }

    return particles;
  }

  update(_deltaTime: number): Particle[] {
    const currentTime = performance.now() / 1000;
    const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
    const spawnInterval = 1 / this.spawnRate;

    if (timeSinceLastSpawn >= spawnInterval) {
      this.lastSpawnTime = currentTime;
      
      return [new Particle(this.particleOptions)];
    }

    return [];
  }

  setParticleOptions(options: Partial<ParticleOptions>): void {
    this.particleOptions = { ...this.particleOptions, ...options };
  }

  getParticleOptions(): Partial<ParticleOptions> {
    return { ...this.particleOptions };
  }
}