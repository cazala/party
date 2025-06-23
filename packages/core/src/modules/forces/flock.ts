import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";

// Default constants for Flock behavior
export const DEFAULT_FLOCK_MAX_SPEED = 1000;
export const DEFAULT_FLOCK_COHESION_WEIGHT = 1;
export const DEFAULT_FLOCK_ALIGNMENT_WEIGHT = 1;
export const DEFAULT_FLOCK_SEPARATION_WEIGHT = 2;
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

  separate(particle: Particle, neighbors: Particle[], range: number): Vector2D {
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
      sum.multiply(this.maxSpeed);
      sum.subtract(particle.velocity);
      sum.limit(this.maxSpeed);
    }

    return sum;
  }

  align(particle: Particle, neighbors: Particle[]): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.velocity);
      }
      sum.divide(neighbors.length);
      sum.normalize();
      sum.multiply(this.maxSpeed);

      sum.subtract(particle.velocity).limit(this.maxSpeed);
    }

    return sum;
  }

  cohesion(particle: Particle, neighbors: Particle[]): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.position);
      }
      sum.divide(neighbors.length);
      return this.seek(particle, sum);
    }

    return sum;
  }

  seek(particle: Particle, target: Vector2D): Vector2D {
    const seek = target.clone().subtract(particle.position);
    seek.normalize();
    seek.multiply(this.maxSpeed);
    seek.subtract(particle.velocity).limit(this.maxSpeed);

    return seek;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    particles: Particle[]
  ) {
    const neighbors = particles
      .filter((p) => p !== particle)
      .filter((p) => particle.position.distance(p.position) < this.neighborRadius);

    const separate = this.separate(particle, neighbors, this.separationRange);
    const align = this.align(particle, neighbors);
    const cohesion = this.cohesion(particle, neighbors);

    cohesion.multiply(this.cohesionWeight);
    separate.multiply(this.separationWeight);
    align.multiply(this.alignmentWeight);

    particle.applyForce(separate);
    particle.applyForce(align);
    particle.applyForce(cohesion);

    return Vector2D.zero();
  }
}
