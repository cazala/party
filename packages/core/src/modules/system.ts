import { Particle } from "./particle";
import { SpatialGrid } from "./spatial-grid";
import { Gravity } from "./forces/gravity";
import { Bounds } from "./forces/bounds";
import { Collisions } from "./forces/collisions";
import { Behavior } from "./forces/behavior";
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
    eat: boolean;
  };
  behavior?: {
    enabled: boolean;
    wanderWeight: number;
    cohesionWeight: number;
    alignmentWeight: number;
    separationWeight: number;
    chaseWeight: number;
    avoidWeight: number;
    separationRange: number;
    viewRadius: number;
    viewAngle: number;
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

  // FPS tracking
  private fpsFrameTimes: number[] = [];
  private fpsMaxSamples: number = 60; // Track last 60 frames
  private currentFPS: number = 0;

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

    // Remove eaten particles (marked with mass = 0)
    this.particles = this.particles.filter((particle) => particle.mass > 0);
  }

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.animate();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.animationId) {
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

  getFPS(): number {
    return this.currentFPS;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.spatialGrid.setSize(width, height);
  }

  private animate = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Update FPS calculation
    this.updateFPS(currentTime);

    if (this.isPlaying) {
      this.update(deltaTime);
    }

    this.animationId = requestAnimationFrame(this.animate);

    if (this.renderCallback) {
      this.renderCallback(this);
    }
  };

  private updateFPS(currentTime: number): void {
    // Add current frame time
    this.fpsFrameTimes.push(currentTime);

    // Remove old frames (keep only last N frames)
    if (this.fpsFrameTimes.length > this.fpsMaxSamples) {
      this.fpsFrameTimes.shift();
    }

    // Calculate FPS from recent frames
    if (this.fpsFrameTimes.length >= 2) {
      const timeSpan =
        this.fpsFrameTimes[this.fpsFrameTimes.length - 1] -
        this.fpsFrameTimes[0];
      const frames = this.fpsFrameTimes.length - 1;
      this.currentFPS = frames / (timeSpan / 1000);
    }
  }

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
          eat: force.eat,
        };
      } else if (force instanceof Behavior) {
        config.behavior = {
          enabled: force.enabled,
          wanderWeight: force.wanderWeight,
          cohesionWeight: force.cohesionWeight,
          alignmentWeight: force.alignmentWeight,
          separationWeight: force.separationWeight,
          chaseWeight: force.chaseWeight,
          avoidWeight: force.avoidWeight,
          separationRange: force.separationRange,
          viewRadius: force.viewRadius,
          viewAngle: force.viewAngle,
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
        force.setEat(config.collisions.eat);
      } else if (force instanceof Behavior && config.behavior) {
        force.setEnabled(config.behavior.enabled);
        force.wanderWeight = config.behavior.wanderWeight;
        force.cohesionWeight = config.behavior.cohesionWeight;
        force.alignmentWeight = config.behavior.alignmentWeight;
        force.separationWeight = config.behavior.separationWeight;
        force.chaseWeight = config.behavior.chaseWeight;
        force.avoidWeight = config.behavior.avoidWeight;
        force.separationRange = config.behavior.separationRange;
        force.viewRadius = config.behavior.viewRadius;
        force.viewAngle = config.behavior.viewAngle;
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
