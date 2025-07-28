import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Physics
export const DEFAULT_GRAVITY_STRENGTH = 0;
export const DEFAULT_GRAVITY_DIRECTION = new Vector2D(0, 1); // Downward
export const DEFAULT_GRAVITY_ANGLE = Math.PI / 2; // radians (90 degrees, downward)
export const DEFAULT_INERTIA = 0;
export const DEFAULT_FRICTION = 0;

export interface PhysicsOptions {
  gravity?: {
    strength?: number;
    direction?: Vector2D;
    /** Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up) */
    angle?: number;
  };
  inertia?: number;
  friction?: number;
}

export class Physics implements Force {
  public gravity: {
    strength: number;
    direction: Vector2D;
  };
  public inertia: number;
  public friction: number;

  // Store previous positions for inertia calculation
  private previousPositions: Map<number, Vector2D> = new Map();

  constructor(options: PhysicsOptions = {}) {
    this.gravity = {
      strength: options.gravity?.strength || DEFAULT_GRAVITY_STRENGTH,
      direction:
        options.gravity?.direction || DEFAULT_GRAVITY_DIRECTION.clone(),
    };
    this.inertia = options.inertia || DEFAULT_INERTIA;
    this.friction = options.friction || DEFAULT_FRICTION;
  }

  // Gravity methods (backward compatibility)
  get strength(): number {
    return this.gravity.strength;
  }

  set strength(value: number) {
    this.gravity.strength = value;
  }

  get direction(): Vector2D {
    return this.gravity.direction;
  }

  set direction(value: Vector2D) {
    this.gravity.direction = value.clone().normalize();
  }

  setStrength(strength: number): void {
    this.gravity.strength = strength;
  }

  setDirection(direction: Vector2D): void {
    this.gravity.direction = direction.clone().normalize();
  }

  /**
   * Set gravity direction from angle in radians
   * @param angle Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up)
   */
  setDirectionFromAngle(angle: number): void {
    this.gravity.direction = Vector2D.fromAngle(angle);
  }

  setInertia(inertia: number): void {
    this.inertia = Math.max(0, Math.min(1, inertia)); // Clamp between 0 and 1
  }

  setFriction(friction: number): void {
    this.friction = Math.max(0, Math.min(1, friction)); // Clamp between 0 and 1
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    if (particle.static || particle.grabbed) {
      return;
    }

    const currentPosition = particle.position.clone();
    const previousPosition = this.previousPositions.get(particle.id);

    // Apply gravity force
    if (this.gravity.strength !== 0) {
      const gravityForce = this.gravity.direction
        .clone()
        .normalize()
        .multiply(this.gravity.strength * particle.mass);
      particle.applyForce(gravityForce);
    }

    // Apply inertia (momentum from actual position change)
    if (this.inertia > 0 && previousPosition) {
      // Calculate actual velocity from position change
      const actualVelocity = currentPosition.clone().subtract(previousPosition);
      const inertiaForce = actualVelocity
        .clone()
        .multiply(this.inertia * particle.mass);
      particle.applyForce(inertiaForce);
    }

    // Apply friction (dampen current velocity)
    if (this.friction > 0) {
      const frictionForce = particle.velocity
        .clone()
        .multiply(-this.friction * particle.mass);
      particle.applyForce(frictionForce);
    }

    // Store current position for next frame
    this.previousPositions.set(particle.id, currentPosition);
  }

  /**
   * Clean up stored positions for removed particles
   */
  cleanupRemovedParticles(activeParticleIds: Set<number>): void {
    for (const particleId of this.previousPositions.keys()) {
      if (!activeParticleIds.has(particleId)) {
        this.previousPositions.delete(particleId);
      }
    }
  }

  /**
   * Clear all stored positions (useful for resets)
   */
  clearPositionHistory(): void {
    this.previousPositions.clear();
  }
}

export function createPhysicsForce(
  gravity: { strength?: number; direction?: Vector2D } = {},
  inertia: number = DEFAULT_INERTIA,
  friction: number = DEFAULT_FRICTION
): Physics {
  return new Physics({
    gravity: {
      strength: gravity.strength || DEFAULT_GRAVITY_STRENGTH,
      direction: gravity.direction || DEFAULT_GRAVITY_DIRECTION,
    },
    inertia,
    friction,
  });
}

export const defaultPhysics = createPhysicsForce();

// Legacy exports for backward compatibility
export type Gravity = Physics;
export const Gravity = Physics;
export const createGravityForce = createPhysicsForce;
export const defaultGravity = defaultPhysics;
