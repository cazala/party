import { Particle } from "../particle";
import { Force } from "../system";
import { Vector2D } from "../vector";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Behavior
export const DEFAULT_BEHAVIOR_ENABLED = true;
export const DEFAULT_BEHAVIOR_WANDER_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_COHESION_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_SEPARATION_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_CHASE_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_AVOID_WEIGHT = 0;
export const DEFAULT_BEHAVIOR_SEPARATION_RANGE = 30;
export const DEFAULT_BEHAVIOR_VIEW_RADIUS = 100;
export const DEFAULT_BEHAVIOR_VIEW_ANGLE = 2 * Math.PI; // Full circle in radians (360°)

export class Behavior implements Force {
  public enabled: boolean;
  wanderWeight: number;
  cohesionWeight: number;
  alignmentWeight: number;
  separationWeight: number;
  chaseWeight: number;
  avoidWeight: number;
  separationRange: number;
  viewRadius: number;
  viewAngle: number; // Field of view angle in radians
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
      viewRadius?: number;
      viewAngle?: number; // Field of view angle in radians
    } = {}
  ) {
    this.enabled = options.enabled ?? DEFAULT_BEHAVIOR_ENABLED;
    this.wanderWeight = options.wanderWeight ?? DEFAULT_BEHAVIOR_WANDER_WEIGHT;
    this.cohesionWeight =
      options.cohesionWeight ?? DEFAULT_BEHAVIOR_COHESION_WEIGHT;
    this.alignmentWeight =
      options.alignmentWeight ?? DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT;
    this.separationWeight =
      options.separationWeight ?? DEFAULT_BEHAVIOR_SEPARATION_WEIGHT;
    this.chaseWeight = options.chaseWeight ?? DEFAULT_BEHAVIOR_CHASE_WEIGHT;
    this.avoidWeight = options.avoidWeight ?? DEFAULT_BEHAVIOR_AVOID_WEIGHT;
    this.separationRange =
      options.separationRange ?? DEFAULT_BEHAVIOR_SEPARATION_RANGE;
    this.viewRadius = options.viewRadius ?? DEFAULT_BEHAVIOR_VIEW_RADIUS;
    this.viewAngle = options.viewAngle ?? DEFAULT_BEHAVIOR_VIEW_ANGLE;
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
        // Create repulsion force away from heavier particle
        const repulsion = particle.position.clone().subtract(neighbor.position);
        const distance = repulsion.magnitude();
        if (distance > this.viewRadius / 2) {
          continue;
        }

        const massDifference = (neighbor.mass - particle.mass) / neighbor.mass;

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

  filterByFieldOfView(particle: Particle, neighbors: Particle[]): Particle[] {
    // If particle has no velocity, it can see in all directions
    if (particle.velocity.magnitude() === 0) {
      return neighbors;
    }

    const normalizedVelocity = particle.velocity.clone().normalize();
    const cosHalfViewAngle = Math.cos(this.viewAngle / 2);

    return neighbors.filter((neighbor) => {
      const toNeighbor = neighbor.position.clone().subtract(particle.position);
      const normalizedDirection = toNeighbor.normalize();

      const dot = normalizedVelocity.dot(normalizedDirection);
      return dot >= cosHalfViewAngle;
    });
  }

  filterByNarrowFieldOfView(
    particle: Particle,
    neighbors: Particle[]
  ): Particle[] {
    // If particle has no velocity, it can see in all directions
    if (particle.velocity.magnitude() === 0) {
      return neighbors;
    }

    const normalizedVelocity = particle.velocity.clone().normalize();
    const cosQuarterViewAngle = Math.cos(this.viewAngle / 6);

    return neighbors.filter((neighbor) => {
      const toNeighbor = neighbor.position.clone().subtract(particle.position);
      const normalizedDirection = toNeighbor.normalize();

      const dot = normalizedVelocity.dot(normalizedDirection);
      return dot >= cosQuarterViewAngle;
    });
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
    if (!this.enabled || particle.pinned) {
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
      this.viewRadius
    );

    // Apply field of view filtering to all neighbors (except wander which doesn't use neighbors)
    const filteredNeighbors = this.filterByFieldOfView(particle, neighbors);

    // Only compute forces that have non-zero weights
    if (this.wanderWeight > 0) {
      const wander = this.wander(particle);
      wander.multiply(this.wanderWeight);
      particle.applyForce(wander);
    }

    if (this.separationWeight > 0) {
      const separate = this.separate(
        particle,
        filteredNeighbors,
        this.separationRange
      );
      separate.multiply(this.separationWeight);
      particle.applyForce(separate);
    }

    if (this.alignmentWeight > 0) {
      const align = this.align(particle, filteredNeighbors);
      align.multiply(this.alignmentWeight);
      particle.applyForce(align);
    }

    if (this.cohesionWeight > 0) {
      const cohesion = this.cohesion(particle, filteredNeighbors);
      cohesion.multiply(this.cohesionWeight);
      particle.applyForce(cohesion);
    }

    if (this.chaseWeight > 0) {
      const chaseNeighbors = this.filterByNarrowFieldOfView(
        particle,
        filteredNeighbors
      );
      const chase = this.chase(particle, chaseNeighbors);
      chase.multiply(this.chaseWeight).limit(50000 * this.chaseWeight);
      particle.applyForce(chase);
    }

    if (this.avoidWeight > 0) {
      const avoid = this.avoid(particle, filteredNeighbors);
      avoid.multiply(this.avoidWeight).limit(50000 * this.avoidWeight);
      particle.applyForce(avoid);
    }
  }

  /**
   * Clears the wander map to free up memory from old particle references
   */
  clearWanderMap(): void {
    this.wanderMap = {};
  }

  /**
   * Implements the Force interface clear method
   */
  clear(): void {
    this.clearWanderMap();
  }
}
