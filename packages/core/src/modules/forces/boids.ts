import { Particle } from "../particle";
import { Force } from "../system";
import { Vector2D } from "../vector";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Boids behavior
export const DEFAULT_BOIDS_ENABLED = true;
export const DEFAULT_BOIDS_WANDER_WEIGHT = 0;
export const DEFAULT_BOIDS_COHESION_WEIGHT = 0;
export const DEFAULT_BOIDS_ALIGNMENT_WEIGHT = 0;
export const DEFAULT_BOIDS_SEPARATION_WEIGHT = 0;
export const DEFAULT_BOIDS_CHASE_WEIGHT = 0;
export const DEFAULT_BOIDS_AVOID_WEIGHT = 0;
export const DEFAULT_BOIDS_SEPARATION_RANGE = 30;
export const DEFAULT_BOIDS_NEIGHBOR_RADIUS = 100;

export class Boids implements Force {
  public enabled: boolean;
  wanderWeight: number;
  cohesionWeight: number;
  alignmentWeight: number;
  separationWeight: number;
  chaseWeight: number;
  avoidWeight: number;
  separationRange: number;
  neighborRadius: number;
  wanderMap: Record<number, Vector2D> = {};

  constructor(
    options: {
      enabled?: boolean;
      wanderWeight?: number;
      cohesionWeight?: number;
      alignmentWeight?: number;
      separationWeight?: number;
      chaseWeight?: number;
      avoidWeight?: number;
      separationRange?: number;
      neighborRadius?: number;
    } = {}
  ) {
    this.enabled = options.enabled ?? DEFAULT_BOIDS_ENABLED;
    this.wanderWeight = options.wanderWeight ?? DEFAULT_BOIDS_WANDER_WEIGHT;
    this.cohesionWeight =
      options.cohesionWeight ?? DEFAULT_BOIDS_COHESION_WEIGHT;
    this.alignmentWeight =
      options.alignmentWeight ?? DEFAULT_BOIDS_ALIGNMENT_WEIGHT;
    this.separationWeight =
      options.separationWeight ?? DEFAULT_BOIDS_SEPARATION_WEIGHT;
    this.chaseWeight = options.chaseWeight ?? DEFAULT_BOIDS_CHASE_WEIGHT;
    this.avoidWeight = options.avoidWeight ?? DEFAULT_BOIDS_AVOID_WEIGHT;
    this.separationRange =
      options.separationRange ?? DEFAULT_BOIDS_SEPARATION_RANGE;
    this.neighborRadius =
      options.neighborRadius ?? DEFAULT_BOIDS_NEIGHBOR_RADIUS;
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
      sum.multiply(1000);
      sum.subtract(particle.velocity);
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
      sum.multiply(1000);

      sum.subtract(particle.velocity);
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
    seek.multiply(1000);
    seek.subtract(particle.velocity);

    return seek;
  }

  chase(particle: Particle, neighbors: Particle[]): Vector2D {
    const chaseForce = new Vector2D(0, 0);

    for (const neighbor of neighbors) {
      // Only chase particles with smaller mass
      if (particle.mass > neighbor.mass) {
        const massDifference = (particle.mass - neighbor.mass) / particle.mass;
        const seekForce = this.seek(particle, neighbor.position);

        // Apply mass difference multiplier to increase effect based on mass ratio
        seekForce.multiply(massDifference * particle.mass);
        chaseForce.add(seekForce);
      }
    }

    return chaseForce;
  }

  avoid(particle: Particle, neighbors: Particle[]): Vector2D {
    const avoidForce = new Vector2D(0, 0);

    for (const neighbor of neighbors) {
      // Only avoid particles with larger mass
      if (particle.mass < neighbor.mass) {
        const massDifference = (neighbor.mass - particle.mass) / neighbor.mass;

        // Create repulsion force away from heavier particle
        const repulsion = particle.position.clone().subtract(neighbor.position);
        const distance = repulsion.magnitude();

        if (distance > 0) {
          repulsion.normalize();
          repulsion.multiply(100000);

          // Apply mass difference multiplier and linear distance scaling
          repulsion.multiply(massDifference * (1 / Math.max(distance, 1)));
          avoidForce.add(repulsion);
        }
      }
    }

    return avoidForce;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  wander(particle: Particle): Vector2D {
    let wanderForce = this.wanderMap[particle.id];
    if (Math.random() < 0.01 || !wanderForce) {
      wanderForce = Vector2D.random()
        .normalize()
        .multiply(1000 * particle.mass);
      this.wanderMap[particle.id] = wanderForce;
      return wanderForce;
    }

    return Vector2D.zero();
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.enabled) {
      return;
    }

    // Calculate effective maxSpeed - use a fixed value of 1000 when forces are active
    const hasActiveForces =
      this.cohesionWeight > 0 ||
      this.alignmentWeight > 0 ||
      this.separationWeight > 0 ||
      this.wanderWeight > 0 ||
      this.chaseWeight > 0 ||
      this.avoidWeight > 0;

    // Early return if no forces are active
    if (!hasActiveForces) {
      return;
    }

    // Use spatial grid for efficient neighbor lookup - only when needed
    const neighbors = spatialGrid.getParticles(
      particle.position,
      this.neighborRadius
    );

    // Only compute forces that have non-zero weights
    if (this.wanderWeight > 0) {
      const wander = this.wander(particle);
      wander.multiply(this.wanderWeight);
      particle.applyForce(wander);
    }

    if (this.separationWeight > 0) {
      const separate = this.separate(particle, neighbors, this.separationRange);
      separate.multiply(this.separationWeight);
      particle.applyForce(separate);
    }

    if (this.alignmentWeight > 0) {
      const align = this.align(particle, neighbors);
      align.multiply(this.alignmentWeight);
      particle.applyForce(align);
    }

    if (this.cohesionWeight > 0) {
      const cohesion = this.cohesion(particle, neighbors);
      cohesion.multiply(this.cohesionWeight);
      particle.applyForce(cohesion);
    }

    if (this.chaseWeight > 0) {
      const chaseNeighbors = spatialGrid.getParticles(
        particle.position,
        this.neighborRadius * 2
      );
      const chase = this.chase(particle, chaseNeighbors);
      chase.multiply(this.chaseWeight);
      particle.applyForce(chase);
    }

    if (this.avoidWeight > 0) {
      const avoidNeighbors = spatialGrid.getParticles(
        particle.position,
        this.neighborRadius * 1.5
      );
      const avoid = this.avoid(particle, avoidNeighbors);
      avoid.multiply(this.avoidWeight);
      particle.applyForce(avoid);
    }
  }
}
