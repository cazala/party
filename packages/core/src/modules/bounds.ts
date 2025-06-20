import { Vector2D } from './vector.js';
import { Particle } from './particle.js';
import { ForceFunction } from './system.js';

export interface BoundingBoxOptions {
  min: Vector2D;
  max: Vector2D;
  bounce?: number;
  wrap?: boolean;
  kill?: boolean;
}

export class BoundingBox {
  public min: Vector2D;
  public max: Vector2D;
  public bounce: number;
  public wrap: boolean;
  public kill: boolean;

  constructor(options: BoundingBoxOptions) {
    this.min = options.min;
    this.max = options.max;
    this.bounce = options.bounce || 0.8;
    this.wrap = options.wrap || false;
    this.kill = options.kill || false;
  }

  contains(position: Vector2D): boolean {
    return position.x >= this.min.x && 
           position.x <= this.max.x && 
           position.y >= this.min.y && 
           position.y <= this.max.y;
  }

  constrain(particle: Particle): void {
    if (this.kill && !this.contains(particle.position)) {
      // For now, just reset position to center when killed
      // In the future, this could remove the particle from the system
      particle.position.set(this.getCenter().x, this.getCenter().y);
      particle.velocity.set(0, 0);
      return;
    }

    if (this.wrap) {
      this.wrapParticle(particle);
    } else {
      this.bounceParticle(particle);
    }
  }

  private wrapParticle(particle: Particle): void {
    if (particle.position.x < this.min.x) {
      particle.position.x = this.max.x;
    } else if (particle.position.x > this.max.x) {
      particle.position.x = this.min.x;
    }

    if (particle.position.y < this.min.y) {
      particle.position.y = this.max.y;
    } else if (particle.position.y > this.max.y) {
      particle.position.y = this.min.y;
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

  getConstraintForce(): ForceFunction {
    return (particle: Particle): Vector2D => {
      this.constrain(particle);
      return Vector2D.zero();
    };
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
    this.min = new Vector2D(center.x - width / 2, center.y - height / 2);
    this.max = new Vector2D(center.x + width / 2, center.y + height / 2);
  }

  move(position: Vector2D): void {
    const width = this.getWidth();
    const height = this.getHeight();
    this.min = new Vector2D(position.x, position.y);
    this.max = new Vector2D(position.x + width, position.y + height);
  }

  clone(): BoundingBox {
    return new BoundingBox({
      min: this.min.clone(),
      max: this.max.clone(),
      bounce: this.bounce,
      wrap: this.wrap,
      kill: this.kill
    });
  }
}

export function createScreenBounds(width: number, height: number, options: Partial<BoundingBoxOptions> = {}): BoundingBox {
  return new BoundingBox({
    min: new Vector2D(0, 0),
    max: new Vector2D(width, height),
    ...options
  });
}