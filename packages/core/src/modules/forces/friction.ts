import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Friction
export const DEFAULT_FRICTION_ENABLED = true;
export const DEFAULT_AIR_FRICTION_COEFFICIENT = 0.999; // Very minimal air resistance
export const DEFAULT_FLOOR_FRICTION_COEFFICIENT = 0.85; // High floor friction
export const DEFAULT_REST_THRESHOLD = 0.5; // Speed below which particles stop moving
export const DEFAULT_FLOOR_CONTACT_THRESHOLD = 2; // Distance from floor to be considered "on floor"

export interface FrictionOptions {
  enabled?: boolean;
  airFrictionCoefficient?: number;
  floorFrictionCoefficient?: number;
  restThreshold?: number;
  floorContactThreshold?: number;
}

export class Friction implements Force {
  public enabled: boolean;
  public airFrictionCoefficient: number; // Air resistance (very low)
  public floorFrictionCoefficient: number; // Floor friction (high)
  public restThreshold: number; // Minimum speed before particle stops
  public floorContactThreshold: number; // Distance from floor to apply floor friction

  constructor(options: FrictionOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_FRICTION_ENABLED;
    this.airFrictionCoefficient = options.airFrictionCoefficient ?? DEFAULT_AIR_FRICTION_COEFFICIENT;
    this.floorFrictionCoefficient = options.floorFrictionCoefficient ?? DEFAULT_FLOOR_FRICTION_COEFFICIENT;
    this.restThreshold = options.restThreshold ?? DEFAULT_REST_THRESHOLD;
    this.floorContactThreshold = options.floorContactThreshold ?? DEFAULT_FLOOR_CONTACT_THRESHOLD;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setAirFrictionCoefficient(coefficient: number): void {
    this.airFrictionCoefficient = coefficient;
  }

  setFloorFrictionCoefficient(coefficient: number): void {
    this.floorFrictionCoefficient = coefficient;
  }

  setRestThreshold(threshold: number): void {
    this.restThreshold = threshold;
  }

  setFloorContactThreshold(threshold: number): void {
    this.floorContactThreshold = threshold;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    spatialGrid: SpatialGrid
  ): Vector2D {
    if (!this.enabled) {
      return Vector2D.zero();
    }

    const speed = particle.velocity.magnitude();
    
    // If particle is moving very slowly, stop it completely
    if (speed < this.restThreshold) {
      particle.velocity.set(0, 0);
      return Vector2D.zero();
    }

    // Determine if particle is on the floor or in the air
    const { height } = spatialGrid.getSize();
    const distanceFromFloor = height - particle.position.y - particle.size; // Distance from particle edge to floor
    const isOnFloor = distanceFromFloor <= this.floorContactThreshold;

    // Choose appropriate friction coefficient
    const frictionCoefficient = isOnFloor ? this.floorFrictionCoefficient : this.airFrictionCoefficient;

    // Apply friction as a force opposing velocity
    // F_friction = -velocity * friction_strength
    const frictionStrength = (1 - frictionCoefficient) * 100; // Convert coefficient to force strength
    const frictionForce = particle.velocity.clone().multiply(-frictionStrength);

    return frictionForce;
  }
}

export function createFrictionForce(options: FrictionOptions = {}): Friction {
  return new Friction(options);
}

export const defaultFriction = createFrictionForce();