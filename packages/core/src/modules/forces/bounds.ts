import { Vector2D } from "../vector.js";
import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Bounds behavior
export const DEFAULT_BOUNDS_BOUNCE = 0.6; // Reduced from 0.8 for more energy dissipation
export const DEFAULT_BOUNDS_FRICTION = 0.1; // Tangential friction along walls
export const DEFAULT_BOUNDS_MIN_BOUNCE_VELOCITY = 50; // Below this speed, bounce is reduced further

export interface BoundingBoxOptions {
  bounce?: number;
  friction?: number;
  minBounceVelocity?: number;
  wrap?: boolean;
  kill?: boolean;
}

export class Bounds implements Force {
  public bounce: number;
  public friction: number;

  constructor(options: BoundingBoxOptions = {}) {
    this.bounce = options.bounce || DEFAULT_BOUNDS_BOUNCE;
    this.friction = options.friction || DEFAULT_BOUNDS_FRICTION;
  }

  setFriction(friction: number): void {
    this.friction = friction;
  }

  contains(particle: Particle, spatialGrid: SpatialGrid): boolean {
    const { width, height } = spatialGrid.getSize();
    const radius = particle.size; // particle.size is the radius
    return (
      particle.position.x >= radius &&
      particle.position.x <= width - radius &&
      particle.position.y >= radius &&
      particle.position.y <= height - radius
    );
  }

  constrain(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.contains(particle, spatialGrid)) {
      this.bounceParticle(particle, spatialGrid);
    }
  }

  private bounceParticle(particle: Particle, spatialGrid: SpatialGrid): void {
    const { width, height } = spatialGrid.getSize();
    const radius = particle.size; // particle.size is the radius

    // Left wall collision
    if (particle.position.x < radius) {
      particle.position.x = radius; // Keep particle edge at wall
      particle.velocity.x = Math.abs(particle.velocity.x) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce y velocity)
      particle.velocity.y *= 1 - this.friction;
    }

    // Right wall collision
    else if (particle.position.x > width - radius) {
      particle.position.x = width - radius; // Keep particle edge at wall
      particle.velocity.x = -Math.abs(particle.velocity.x) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce y velocity)
      particle.velocity.y *= 1 - this.friction;
    }

    // Top wall collision
    if (particle.position.y < radius) {
      particle.position.y = radius; // Keep particle edge at wall
      particle.velocity.y = Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      particle.velocity.x *= 1 - this.friction;
    }

    // Bottom wall collision
    else if (particle.position.y > height - radius) {
      particle.position.y = height - radius; // Keep particle edge at wall
      particle.velocity.y = -Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      particle.velocity.x *= 1 - this.friction;
    }
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    spatialGrid: SpatialGrid
  ) {
    this.constrain(particle, spatialGrid);
    return new Vector2D(0, 0);
  }
}
