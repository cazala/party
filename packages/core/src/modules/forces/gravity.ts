import { Vector2D } from '../vector.js';
import { Particle } from '../particle.js';
import { ForceFunction } from '../system.js';

export interface GravityOptions {
  strength?: number;
  direction?: Vector2D;
}

export class Gravity {
  public strength: number;
  public direction: Vector2D;

  constructor(options: GravityOptions = {}) {
    this.strength = options.strength || 9.8;
    this.direction = options.direction || new Vector2D(0, 1); // Default: downward
  }

  getForce(): ForceFunction {
    return (particle: Particle): Vector2D => {
      return this.direction.normalize().multiply(this.strength * particle.mass);
    };
  }

  setStrength(strength: number): void {
    this.strength = strength;
  }

  setDirection(direction: Vector2D): void {
    this.direction = direction.normalize();
  }

  setDirectionFromAngle(angle: number): void {
    this.direction = Vector2D.fromAngle(angle);
  }
}

export function createGravityForce(strength: number = 9.8, direction: Vector2D = new Vector2D(0, 1)): ForceFunction {
  const normalizedDirection = direction.normalize();
  
  return (particle: Particle): Vector2D => {
    return normalizedDirection.multiply(strength * particle.mass);
  };
}

export const defaultGravity = createGravityForce();