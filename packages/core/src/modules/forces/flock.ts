import { Particle } from "../particle";
import { Force } from "../system";
import { Vector2D } from "../vector";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Flock behavior
export const DEFAULT_FLOCK_MAX_SPEED = 0; // Auto-managed when forces are active
export const DEFAULT_FLOCK_WANDER_WEIGHT = 0;
export const DEFAULT_FLOCK_COHESION_WEIGHT = 0;
export const DEFAULT_FLOCK_ALIGNMENT_WEIGHT = 0;
export const DEFAULT_FLOCK_SEPARATION_WEIGHT = 0;
export const DEFAULT_FLOCK_SEPARATION_RANGE = 30;
export const DEFAULT_FLOCK_NEIGHBOR_RADIUS = 100;

export class Flock implements Force {
  maxSpeed: number;

  wanderWeight: number;
  cohesionWeight: number;
  alignmentWeight: number;
  separationWeight: number;
  separationRange: number;
  neighborRadius: number;
  wanderMap: Record<number, Vector2D> = {};

  constructor(
    options: {
      maxSpeed?: number;
      wanderWeight?: number;
      cohesionWeight?: number;
      alignmentWeight?: number;
      separationWeight?: number;
      separationRange?: number;
      neighborRadius?: number;
    } = {}
  ) {
    this.maxSpeed = options.maxSpeed ?? DEFAULT_FLOCK_MAX_SPEED;
    this.wanderWeight = options.wanderWeight ?? DEFAULT_FLOCK_WANDER_WEIGHT;
    this.cohesionWeight =
      options.cohesionWeight ?? DEFAULT_FLOCK_COHESION_WEIGHT;
    this.alignmentWeight =
      options.alignmentWeight ?? DEFAULT_FLOCK_ALIGNMENT_WEIGHT;
    this.separationWeight =
      options.separationWeight ?? DEFAULT_FLOCK_SEPARATION_WEIGHT;
    this.separationRange =
      options.separationRange ?? DEFAULT_FLOCK_SEPARATION_RANGE;
    this.neighborRadius =
      options.neighborRadius ?? DEFAULT_FLOCK_NEIGHBOR_RADIUS;
  }

  separate(
    particle: Particle,
    neighbors: Particle[],
    range: number,
    effectiveMaxSpeed: number
  ): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        const d = particle.position.distance(neighbor.position);
        if (d < range) {
          const diff = particle.position.clone().subtract(neighbor.position);
          diff.normalize();
          if (d > 0) {
            diff.divide(d);
            sum.add(diff);
          }
        }
      }
      sum.divide(neighbors.length);
      sum.normalize();
      sum.multiply(effectiveMaxSpeed);
      sum.subtract(particle.velocity);
      sum.limit(effectiveMaxSpeed);
    }

    return sum;
  }

  align(
    particle: Particle,
    neighbors: Particle[],
    effectiveMaxSpeed: number
  ): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.velocity);
      }
      sum.divide(neighbors.length);
      sum.normalize();
      sum.multiply(effectiveMaxSpeed);

      sum.subtract(particle.velocity).limit(effectiveMaxSpeed);
    }

    return sum;
  }

  cohesion(
    particle: Particle,
    neighbors: Particle[],
    effectiveMaxSpeed: number
  ): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.position);
      }
      sum.divide(neighbors.length);
      return this.seek(particle, sum, effectiveMaxSpeed);
    }

    return sum;
  }

  seek(
    particle: Particle,
    target: Vector2D,
    effectiveMaxSpeed: number
  ): Vector2D {
    const seek = target.clone().subtract(particle.position);
    seek.normalize();
    seek.multiply(effectiveMaxSpeed);
    seek.subtract(particle.velocity).limit(effectiveMaxSpeed);

    return seek;
  }

  wander(particle: Particle, effectiveMaxSpeed: number): Vector2D {
    let wanderForce = this.wanderMap[particle.id];
    if (Math.random() < 0.05 || !wanderForce) {
      wanderForce = Vector2D.random().normalize().multiply(1000);
      wanderForce.limit(effectiveMaxSpeed);
      this.wanderMap[particle.id] = wanderForce;
      return wanderForce;
    }

    return Vector2D.zero();
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    // Calculate effective maxSpeed - use user maxSpeed or minimum default when forces are active
    const hasActiveForces =
      this.cohesionWeight > 0 ||
      this.alignmentWeight > 0 ||
      this.separationWeight > 0 ||
      this.wanderWeight > 0;

    // Early return if no forces are active
    if (!hasActiveForces) {
      return;
    }

    const effectiveMaxSpeed = Math.max(this.maxSpeed, 1000);

    // Use spatial grid for efficient neighbor lookup - only when needed
    const neighbors = spatialGrid.getParticles(
      particle.position,
      this.neighborRadius
    );

    // Only compute forces that have non-zero weights
    if (this.wanderWeight > 0) {
      const wander = this.wander(particle, effectiveMaxSpeed);
      wander.multiply(this.wanderWeight);
      particle.applyForce(wander);
    }

    if (this.separationWeight > 0) {
      const separate = this.separate(
        particle,
        neighbors,
        this.separationRange,
        effectiveMaxSpeed
      );
      separate.multiply(this.separationWeight);
      particle.applyForce(separate);
    }

    if (this.alignmentWeight > 0) {
      const align = this.align(particle, neighbors, effectiveMaxSpeed);
      align.multiply(this.alignmentWeight);
      particle.applyForce(align);
    }

    if (this.cohesionWeight > 0) {
      const cohesion = this.cohesion(particle, neighbors, effectiveMaxSpeed);
      cohesion.multiply(this.cohesionWeight);
      particle.applyForce(cohesion);
    }
  }
}
