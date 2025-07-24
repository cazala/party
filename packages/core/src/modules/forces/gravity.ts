import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Gravity
export const DEFAULT_GRAVITY_STRENGTH = 0;
export const DEFAULT_GRAVITY_DIRECTION = new Vector2D(0, 1); // Downward
export const DEFAULT_GRAVITY_ANGLE = Math.PI / 2; // radians (90 degrees, downward)

export interface GravityOptions {
  strength?: number;
  direction?: Vector2D;
  /** Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up) */
  angle?: number;
}

export class Gravity implements Force {
  public strength: number;
  public direction: Vector2D;

  constructor(options: GravityOptions = {}) {
    this.strength = options.strength || DEFAULT_GRAVITY_STRENGTH;
    this.direction = options.direction || DEFAULT_GRAVITY_DIRECTION.clone();
  }

  setStrength(strength: number): void {
    this.strength = strength;
  }

  setDirection(direction: Vector2D): void {
    this.direction = direction.clone().normalize();
  }

  /**
   * Set gravity direction from angle in radians
   * @param angle Angle in radians (0 = right, π/2 = down, π = left, 3π/2 = up)
   */
  setDirectionFromAngle(angle: number): void {
    this.direction = Vector2D.fromAngle(angle);
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    const force = this.direction
      .clone()
      .normalize()
      .multiply(this.strength * particle.mass);
    particle.applyForce(force);
  }
}

export function createGravityForce(
  strength: number = DEFAULT_GRAVITY_STRENGTH,
  direction: Vector2D = DEFAULT_GRAVITY_DIRECTION
): Gravity {
  return new Gravity({ strength, direction });
}

export const defaultGravity = createGravityForce();
