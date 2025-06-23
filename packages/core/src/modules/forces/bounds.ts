import { Vector2D } from "../vector.js";
import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Bounds behavior
export const DEFAULT_BOUNDS_BOUNCE = 0.8;

export interface BoundingBoxOptions {
  bounce?: number;
  wrap?: boolean;
  kill?: boolean;
}

export class Bounds implements Force {
  public bounce: number;

  constructor(options: BoundingBoxOptions = {}) {
    this.bounce = options.bounce || DEFAULT_BOUNDS_BOUNCE;
  }

  contains(position: Vector2D, spatialGrid: SpatialGrid): boolean {
    const { width, height } = spatialGrid.getSize();
    return (
      position.x >= 0 &&
      position.x <= width &&
      position.y >= 0 &&
      position.y <= height
    );
  }

  constrain(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.contains(particle.position, spatialGrid)) {
      this.bounceParticle(particle, spatialGrid);
    }
  }

  private bounceParticle(particle: Particle, spatialGrid: SpatialGrid): void {
    const { width, height } = spatialGrid.getSize();
    const maxX = width;
    const maxY = height;

    if (particle.position.x < 0) {
      particle.position.x = 0;
      particle.velocity.x *= -this.bounce;
    } else if (particle.position.x > maxX) {
      particle.position.x = maxX;
      particle.velocity.x *= -this.bounce;
    }

    if (particle.position.y < 0) {
      particle.position.y = 0;
      particle.velocity.y *= -this.bounce;
    } else if (particle.position.y > maxY) {
      particle.position.y = maxY;
      particle.velocity.y *= -this.bounce;
    }
  }

  apply(particle: Particle, _deltaTime: number, _index: number, spatialGrid: SpatialGrid) {
    this.constrain(particle, spatialGrid);
    return new Vector2D(0, 0);
  }
}
