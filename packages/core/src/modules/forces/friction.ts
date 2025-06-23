import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Friction
export const DEFAULT_FRICTION_ENABLED = true;
export const DEFAULT_FRICTION_COEFFICIENT = 0.98; // Very subtle damping by default
export const DEFAULT_REST_THRESHOLD = 0.5; // Speed below which particles stop moving

export interface FrictionOptions {
  enabled?: boolean;
  coefficient?: number;
  restThreshold?: number;
}

export class Friction implements Force {
  public enabled: boolean;
  public coefficient: number; // Multiplier applied to velocity each frame (< 1.0 = damping)
  public restThreshold: number; // Minimum speed before particle stops

  constructor(options: FrictionOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_FRICTION_ENABLED;
    this.coefficient = options.coefficient ?? DEFAULT_FRICTION_COEFFICIENT;
    this.restThreshold = options.restThreshold ?? DEFAULT_REST_THRESHOLD;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setCoefficient(coefficient: number): void {
    this.coefficient = coefficient;
  }

  setRestThreshold(threshold: number): void {
    this.restThreshold = threshold;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    _spatialGrid: SpatialGrid
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

    // Apply friction as a force opposing velocity
    // F_friction = -velocity * friction_strength
    const frictionStrength = (1 - this.coefficient) * 100; // Convert coefficient to force strength
    const frictionForce = particle.velocity.clone().multiply(-frictionStrength);

    return frictionForce;
  }
}

export function createFrictionForce(options: FrictionOptions = {}): Friction {
  return new Friction(options);
}

export const defaultFriction = createFrictionForce();