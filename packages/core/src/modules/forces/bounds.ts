import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

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
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;

  constructor(options: BoundingBoxOptions = {}) {
    this.bounce = options.bounce || DEFAULT_BOUNDS_BOUNCE;
    this.friction = options.friction || DEFAULT_BOUNDS_FRICTION;
  }

  setCamera(cameraX: number, cameraY: number, zoom: number): void {
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoom = zoom;
  }

  setFriction(friction: number): void {
    this.friction = friction;
  }

  contains(particle: Particle, spatialGrid: SpatialGrid): boolean {
    const { width, height } = spatialGrid.getSize();
    const radius = particle.size; // particle.size is the radius

    // Calculate visible world bounds accounting for camera position and zoom
    const worldLeft = -this.cameraX / this.zoom;
    const worldTop = -this.cameraY / this.zoom;
    const worldRight = (width - this.cameraX) / this.zoom;
    const worldBottom = (height - this.cameraY) / this.zoom;

    return (
      particle.position.x >= worldLeft + radius &&
      particle.position.x <= worldRight - radius &&
      particle.position.y >= worldTop + radius &&
      particle.position.y <= worldBottom - radius
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

    // Calculate visible world bounds accounting for camera position and zoom
    const worldLeft = -this.cameraX / this.zoom;
    const worldTop = -this.cameraY / this.zoom;
    const worldRight = (width - this.cameraX) / this.zoom;
    const worldBottom = (height - this.cameraY) / this.zoom;

    // Left wall collision
    if (particle.position.x < worldLeft + radius) {
      particle.position.x = worldLeft + radius;
      particle.velocity.x = Math.abs(particle.velocity.x) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce y velocity)
      particle.velocity.y *= 1 - this.friction;
    }

    // Right wall collision
    else if (particle.position.x > worldRight - radius) {
      particle.position.x = worldRight - radius;
      particle.velocity.x = -Math.abs(particle.velocity.x) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce y velocity)
      particle.velocity.y *= 1 - this.friction;
    }

    // Top wall collision
    if (particle.position.y < worldTop + radius) {
      particle.position.y = worldTop + radius;
      particle.velocity.y = Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      particle.velocity.x *= 1 - this.friction;
    }

    // Bottom wall collision
    else if (particle.position.y > worldBottom - radius) {
      particle.position.y = worldBottom - radius;
      particle.velocity.y = -Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      particle.velocity.x *= 1 - this.friction;
    }
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    this.constrain(particle, spatialGrid);
  }
}
