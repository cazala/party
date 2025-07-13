import { Particle } from "./particle";
import { SpatialGrid } from "./spatial-grid";
import { Gravity } from "./forces/gravity";
import { Bounds } from "./forces/bounds";
import { Collisions } from "./forces/collisions";
import { Flock } from "./forces/flock";
import { Fluid } from "./forces/fluid";
import { Vector2D } from "./vector";

export interface Force {
  warmup?(particles: Particle[], deltaTime: number): void;
  apply(particle: Particle, spatialGrid: SpatialGrid): void;
}

export interface Config {
  gravity?: {
    strength: number;
    direction: { x: number; y: number };
  };
  bounds?: {
    bounce: number;
    friction: number;
  };
  collisions?: {
    enabled: boolean;
  };
  flock?: {
    cohesionWeight: number;
    alignmentWeight: number;
    separationWeight: number;
    separationRange: number;
    neighborRadius: number;
  };
  fluid?: {
    enabled: boolean;
    influenceRadius: number;
    targetDensity: number;
    pressureMultiplier: number;
    wobbleFactor: number;
    resistance: number;
  };
}

// Default constants for ParticleSystem
export const DEFAULT_SPATIAL_GRID_CELL_SIZE = 100;

export interface SystemOptions {
  width: number;
  height: number;
  cellSize?: number;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public forces: Force[] = [];
  public spatialGrid: SpatialGrid;
  public width: number;
  public height: number;
  public isPlaying: boolean = false;

  private lastTime: number = 0;
  private animationId: number | null = null;

  private renderCallback?: (system: ParticleSystem) => void;

  constructor(options: SystemOptions) {
    this.width = options.width;
    this.height = options.height;

    this.spatialGrid = new SpatialGrid({
      width: this.width,
      height: this.height,
      cellSize: options.cellSize ?? DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
  }

  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  addParticles(particles: Particle[]): void {
    for (const particle of particles) {
      this.addParticle(particle);
    }
  }

  getParticle(id: number): Particle | null {
    const particle = this.particles.find((particle) => particle.id === id);
    return particle || null;
  }

  removeParticle(particle: Particle): void {
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
    }
  }

  addForce(force: Force): void {
    this.forces.push(force);
  }

  removeForce(force: Force): void {
    const index = this.forces.indexOf(force);
    if (index > -1) {
      this.forces.splice(index, 1);
    }
  }

  clearForces(): void {
    this.forces = [];
  }

  update(deltaTime: number): void {
    // Clear and repopulate spatial grid
    this.spatialGrid.clear();

    for (const particle of this.particles) {
      this.spatialGrid.insert(particle);
    }

    for (const force of this.forces) {
      force.warmup?.(this.particles, deltaTime);
    }

    for (const particle of this.particles) {
      for (const force of this.forces) {
        force.apply(particle, this.spatialGrid);
      }
      particle.update(deltaTime);
    }
  }

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastTime = performance.now();
    this.animate();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  reset(): void {
    this.pause();
    this.particles = [];
    this.lastTime = 0;
  }

  clear(): void {
    this.particles = [];
    this.spatialGrid.clear();
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.spatialGrid.setSize(width, height);
  }

  private animate = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);

    this.animationId = requestAnimationFrame(this.animate);

    if (this.renderCallback) {
      this.renderCallback(this);
    }
  };

  setRenderCallback(callback: (system: ParticleSystem) => void): void {
    this.renderCallback = callback;
  }

  clearRenderCallback(): void {
    this.renderCallback = undefined;
  }

  export(): Config {
    const config: Config = {};

    // Export configuration for each force type present in the system
    for (const force of this.forces) {
      if (force instanceof Gravity) {
        config.gravity = {
          strength: force.strength,
          direction: { x: force.direction.x, y: force.direction.y },
        };
      } else if (force instanceof Bounds) {
        config.bounds = {
          bounce: force.bounce,
          friction: force.friction,
        };
      } else if (force instanceof Collisions) {
        config.collisions = {
          enabled: force.enabled,
        };
      } else if (force instanceof Flock) {
        config.flock = {
          cohesionWeight: force.cohesionWeight,
          alignmentWeight: force.alignmentWeight,
          separationWeight: force.separationWeight,
          separationRange: force.separationRange,
          neighborRadius: force.neighborRadius,
        };
      } else if (force instanceof Fluid) {
        config.fluid = {
          enabled: force.enabled,
          influenceRadius: force.influenceRadius,
          targetDensity: force.targetDensity,
          pressureMultiplier: force.pressureMultiplier,
          wobbleFactor: force.wobbleFactor,
          resistance: force.resistance,
        };
      }
    }

    return config;
  }

  import(config: Config): void {
    // Apply configuration for each force type present in the system
    for (const force of this.forces) {
      if (force instanceof Gravity && config.gravity) {
        force.setStrength(config.gravity.strength);
        force.setDirection(
          new Vector2D(config.gravity.direction.x, config.gravity.direction.y)
        );
      } else if (force instanceof Bounds && config.bounds) {
        force.bounce = config.bounds.bounce;
        force.setFriction(config.bounds.friction);
      } else if (force instanceof Collisions && config.collisions) {
        force.setEnabled(config.collisions.enabled);
      } else if (force instanceof Flock && config.flock) {
        force.cohesionWeight = config.flock.cohesionWeight;
        force.alignmentWeight = config.flock.alignmentWeight;
        force.separationWeight = config.flock.separationWeight;
        force.separationRange = config.flock.separationRange;
        force.neighborRadius = config.flock.neighborRadius;
      } else if (force instanceof Fluid && config.fluid) {
        force.setEnabled(config.fluid.enabled);
        force.influenceRadius = config.fluid.influenceRadius;
        force.targetDensity = config.fluid.targetDensity;
        force.pressureMultiplier = config.fluid.pressureMultiplier;
        force.wobbleFactor = config.fluid.wobbleFactor;
        force.resistance = config.fluid.resistance;
      }
    }
  }
}
