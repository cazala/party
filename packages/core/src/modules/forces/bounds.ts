import { Vector2D } from "../vector.js";
import { Particle } from "../particle.js";
import { Force } from "../system.js";

// Default constants for Bounds behavior
export const DEFAULT_BOUNDS_BOUNCE = 0.8;

export interface BoundingBoxOptions {
  min: Vector2D;
  max: Vector2D;
  bounce?: number;
  wrap?: boolean;
  kill?: boolean;
}

export class Bounds implements Force {
  public min: Vector2D;
  public max: Vector2D;
  public bounce: number;

  constructor(options: BoundingBoxOptions) {
    this.min = options.min;
    this.max = options.max;
    this.bounce = options.bounce || DEFAULT_BOUNDS_BOUNCE;
  }

  contains(position: Vector2D): boolean {
    return (
      position.x >= this.min.x &&
      position.x <= this.max.x &&
      position.y >= this.min.y &&
      position.y <= this.max.y
    );
  }

  constrain(particle: Particle): void {
    if (!this.contains(particle.position)) {
      this.bounceParticle(particle);
    }
  }

  private bounceParticle(particle: Particle): void {
    if (particle.position.x < this.min.x) {
      particle.position.x = this.min.x;
      particle.velocity.x *= -this.bounce;
    } else if (particle.position.x > this.max.x) {
      particle.position.x = this.max.x;
      particle.velocity.x *= -this.bounce;
    }

    if (particle.position.y < this.min.y) {
      particle.position.y = this.min.y;
      particle.velocity.y *= -this.bounce;
    } else if (particle.position.y > this.max.y) {
      particle.position.y = this.max.y;
      particle.velocity.y *= -this.bounce;
    }
  }

  getWidth(): number {
    return this.max.x - this.min.x;
  }

  getHeight(): number {
    return this.max.y - this.min.y;
  }

  getCenter(): Vector2D {
    return new Vector2D(
      (this.min.x + this.max.x) / 2,
      (this.min.y + this.max.y) / 2
    );
  }

  resize(width: number, height: number): void {
    const center = this.getCenter();
    this.min.set(center.x - width / 2, center.y - height / 2);
    this.max.set(center.x + width / 2, center.y + height / 2);
  }

  apply(particle: Particle) {
    this.constrain(particle);
    return new Vector2D(0, 0);
  }
}
