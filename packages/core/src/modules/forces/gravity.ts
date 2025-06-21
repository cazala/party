import { Vector2D } from "../vector.js";
import { Particle } from "../particle.js";
import { Force } from "../system.js";

export interface GravityOptions {
  strength?: number;
  direction?: Vector2D;
}

export class Gravity implements Force {
  public strength: number;
  public direction: Vector2D;

  constructor(options: GravityOptions = {}) {
    this.strength = options.strength || 9.8;
    this.direction = options.direction || new Vector2D(0, 1); // Default: downward
  }

  setStrength(strength: number): void {
    this.strength = strength;
  }

  setDirection(direction: Vector2D): void {
    this.direction = direction.clone().normalize();
  }

  setDirectionFromAngle(angle: number): void {
    this.direction = Vector2D.fromAngle(angle);
  }

  apply(particle: Particle) {
    return this.direction.clone().normalize().multiply(this.strength * particle.mass);
  }
}

export function createGravityForce(
  strength: number = 9.8,
  direction: Vector2D = new Vector2D(0, 1)
): Gravity {
  return new Gravity({ strength, direction });
}

export const defaultGravity = createGravityForce();
