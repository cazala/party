import { Particle } from "../particle";
import { Force } from "../system";
import { Vector } from "../vector";
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
  wanderMap: Record<number, Vector> = {};

  // Enhanced wander state tracking
  private wanderStates: Record<
    number,
    {
      targetDirection: Vector;
      directionChangeTimer: number;
      speedMultiplier: number;
      noiseOffset: number;
      lastUpdateTime: number;
    }
  > = {};

  /**
   * Simple 1D noise function for smooth random values
   * Returns value between -1 and 1
   */
  private simpleNoise(x: number): number {
    const n = Math.sin(x * 12.9898) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  /**
   * Smooth noise function combining multiple octaves
   */
  private smoothNoise(x: number): number {
    return (
      this.simpleNoise(x) * 0.5 +
      this.simpleNoise(x * 2.7) * 0.25 +
      this.simpleNoise(x * 5.3) * 0.125 +
      this.simpleNoise(x * 11.1) * 0.0625
    );
  }

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

  separate(particle: Particle, neighbors: Particle[], range: number): Vector {
    const sum = new Vector(0, 0);

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

  align(particle: Particle, neighbors: Particle[]): Vector {
    const sum = new Vector(0, 0);

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

  cohesion(particle: Particle, neighbors: Particle[]): Vector {
    const sum = new Vector(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.position);
      }
      sum.divide(neighbors.length);
      return this.seek(particle, sum);
    }

    return sum;
  }

  seek(particle: Particle, target: Vector): Vector {
    const seek = target.clone().subtract(particle.position);
    seek.normalize();
    seek.multiply(1000);
    seek.subtract(particle.velocity);

    return seek;
  }

  chase(particle: Particle, neighbors: Particle[]): Vector {
    const chaseForce = new Vector(0, 0);

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

  avoid(particle: Particle, neighbors: Particle[]): Vector {
    const avoidForce = new Vector(0, 0);

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

  wander(particle: Particle): Vector {
    const currentTime = Date.now() * 0.001; // Convert to seconds

    // Initialize or get wander state for this particle
    let state = this.wanderStates[particle.id];
    if (!state) {
      state = this.wanderStates[particle.id] = {
        targetDirection: Vector.random().normalize(),
        directionChangeTimer: 0,
        speedMultiplier: 1,
        noiseOffset: Math.random() * 1000, // Random starting point for noise
        lastUpdateTime: currentTime,
      };
    }

    const actualDeltaTime = Math.min(currentTime - state.lastUpdateTime, 0.1); // Cap delta time
    state.lastUpdateTime = currentTime;

    // Scale behavior based on wander weight intensity
    const intensity = Math.min(this.wanderWeight, 2.0); // Cap at 2.0 for extreme behavior

    // Direction change frequency: calm (every 2-4s) to frantic (every 0.2-0.5s)
    const directionChangeFrequency = Math.max(0.2, 4.0 - intensity * 3.8);

    // Update direction change timer
    state.directionChangeTimer -= actualDeltaTime;

    // Time to change direction or pick new target
    if (state.directionChangeTimer <= 0) {
      // For high intensity: more random, sharp changes
      // For low intensity: gentle, flowing changes
      const randomness = Math.min(intensity * 0.7, 1.0);
      const smoothness = 1.0 - randomness;

      // Combine smooth noise with random changes
      const noiseInfluence = this.smoothNoise(state.noiseOffset) * smoothness;
      const randomInfluence = (Math.random() * 2 - 1) * randomness;

      // Create new target direction
      const angle =
        Math.atan2(state.targetDirection.y, state.targetDirection.x) +
        (noiseInfluence + randomInfluence) * Math.PI * 0.5; // Max 90° turn

      state.targetDirection.set(Math.cos(angle), Math.sin(angle));

      // Reset timer with some variation
      const variation = 1 + (Math.random() * 2 - 1) * 0.5; // ±50% variation
      state.directionChangeTimer = directionChangeFrequency * variation;

      // Advance noise offset for next change
      state.noiseOffset += 0.1 + intensity * 0.1;
    }

    // Calculate speed variation using sine waves for natural rhythm
    const speedNoiseTime = currentTime * (0.5 + intensity * 1.5); // Faster oscillation for higher intensity
    const speedVariation =
      Math.sin(speedNoiseTime) * Math.sin(speedNoiseTime * 1.7) * 0.5 + 0.5;

    // Speed multiplier: calm (0.3-1.0) to frantic (0.1-2.5)
    const minSpeed = Math.max(0.1, 0.5 - intensity * 0.4);
    const maxSpeed = 0.5 + intensity * 2.0;
    state.speedMultiplier = minSpeed + speedVariation * (maxSpeed - minSpeed);

    // Create steering force towards target direction

    // Calculate steering force (how much to turn towards target)
    const steerStrength = 0.3 + intensity * 0.7; // Gentle to aggressive steering
    const desiredVelocity = state.targetDirection
      .clone()
      .multiply(1000 * particle.mass * state.speedMultiplier);

    const steer = desiredVelocity
      .clone()
      .subtract(particle.velocity)
      .multiply(steerStrength);

    // Add some perpendicular noise for more organic movement
    const perpendicular = new Vector(
      -state.targetDirection.y,
      state.targetDirection.x
    );
    const perpendicularNoise =
      this.smoothNoise(state.noiseOffset + currentTime) * intensity * 200;
    steer.add(perpendicular.multiply(perpendicularNoise));

    // Apply intensity scaling to final force
    steer.multiply(intensity);

    return steer;
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
    this.wanderStates = {};
  }

  /**
   * Implements the Force interface clear method
   */
  clear(): void {
    this.clearWanderMap();
  }
}
