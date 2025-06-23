import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Flock behavior
export const DEFAULT_FLOCK_MAX_SPEED = 0; // Auto-managed when forces are active
export const DEFAULT_FLOCK_COHESION_WEIGHT = 0;
export const DEFAULT_FLOCK_ALIGNMENT_WEIGHT = 0;
export const DEFAULT_FLOCK_SEPARATION_WEIGHT = 0;
export const DEFAULT_FLOCK_SEPARATION_RANGE = 30;
export const DEFAULT_FLOCK_NEIGHBOR_RADIUS = 100;

export class Flock implements Force {
  maxSpeed: number;

  cohesionWeight: number;
  alignmentWeight: number;
  separationWeight: number;
  separationRange: number;
  neighborRadius: number;

  constructor(
    options: {
      maxSpeed?: number;
      cohesionWeight?: number;
      alignmentWeight?: number;
      separationWeight?: number;
      separationRange?: number;
      neighborRadius?: number;
    } = {}
  ) {
    this.maxSpeed = options.maxSpeed ?? DEFAULT_FLOCK_MAX_SPEED;
    this.cohesionWeight = options.cohesionWeight ?? DEFAULT_FLOCK_COHESION_WEIGHT;
    this.alignmentWeight = options.alignmentWeight ?? DEFAULT_FLOCK_ALIGNMENT_WEIGHT;
    this.separationWeight = options.separationWeight ?? DEFAULT_FLOCK_SEPARATION_WEIGHT;
    this.separationRange = options.separationRange ?? DEFAULT_FLOCK_SEPARATION_RANGE;
    this.neighborRadius = options.neighborRadius ?? DEFAULT_FLOCK_NEIGHBOR_RADIUS;
  }

  separate(particle: Particle, neighbors: Particle[], range: number, effectiveMaxSpeed: number): Vector2D {
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

  align(particle: Particle, neighbors: Particle[], effectiveMaxSpeed: number): Vector2D {
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

  cohesion(particle: Particle, neighbors: Particle[], effectiveMaxSpeed: number): Vector2D {
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

  seek(particle: Particle, target: Vector2D, effectiveMaxSpeed: number): Vector2D {
    const seek = target.clone().subtract(particle.position);
    seek.normalize();
    seek.multiply(effectiveMaxSpeed);
    seek.subtract(particle.velocity).limit(effectiveMaxSpeed);

    return seek;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    spatialGrid: SpatialGrid
  ) {
    // Calculate effective maxSpeed - use user maxSpeed or minimum default when forces are active
    const hasActiveForces = this.cohesionWeight > 0 || this.alignmentWeight > 0 || this.separationWeight > 0;
    const effectiveMaxSpeed = hasActiveForces ? Math.max(this.maxSpeed, 1000) : this.maxSpeed;

    // Use spatial grid for efficient neighbor lookup
    const neighbors = spatialGrid.getNeighbors(particle, this.neighborRadius);

    const separate = this.separate(particle, neighbors, this.separationRange, effectiveMaxSpeed);
    const align = this.align(particle, neighbors, effectiveMaxSpeed);
    const cohesion = this.cohesion(particle, neighbors, effectiveMaxSpeed);

    cohesion.multiply(this.cohesionWeight);
    separate.multiply(this.separationWeight);
    align.multiply(this.alignmentWeight);

    particle.applyForce(separate);
    particle.applyForce(align);
    particle.applyForce(cohesion);

    return Vector2D.zero();
  }
}
