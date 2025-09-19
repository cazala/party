import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";
import { Vector } from "../webgpu/vector";

// Default constants for Boundary behavior
export const DEFAULT_BOUNDARY_BOUNCE = 0.4;
export const DEFAULT_BOUNDARY_MIN_BOUNCE_VELOCITY = 50; // Below this speed, bounce is reduced further
export const DEFAULT_BOUNDARY_REPEL_DISTANCE = 0; // No repel distance by default
export const DEFAULT_BOUNDARY_REPEL_STRENGTH = 0; // No repel strength by default
export const DEFAULT_BOUNDARY_MODE = "bounce"; // Default boundary mode
export const DEFAULT_BOUNDARY_FRICTION = 0.1;

export type BoundaryMode = "bounce" | "kill" | "warp" | "none";

export interface BoundaryOptions {
  bounce?: number;
  minBounceVelocity?: number;
  repelDistance?: number;
  repelStrength?: number;
  mode?: BoundaryMode;
  friction?: number;
}

export class Boundary implements Force {
  public bounce: number;
  public repelDistance: number;
  public repelStrength: number;
  public mode: BoundaryMode;
  public friction: number;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;

  constructor(options: BoundaryOptions = {}) {
    this.bounce = options.bounce || DEFAULT_BOUNDARY_BOUNCE;
    this.repelDistance =
      options.repelDistance || DEFAULT_BOUNDARY_REPEL_DISTANCE;
    this.repelStrength =
      options.repelStrength || DEFAULT_BOUNDARY_REPEL_STRENGTH;
    this.mode = options.mode || DEFAULT_BOUNDARY_MODE;
    this.friction = options.friction ?? DEFAULT_BOUNDARY_FRICTION;
  }

  setCamera(cameraX: number, cameraY: number, zoom: number): void {
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoom = zoom;
  }

  setFriction(friction: number): void {
    this.friction = Math.max(0, Math.min(1, friction)); // Clamp between 0 and 1
  }

  setRepelDistance(distance: number): void {
    this.repelDistance = distance;
  }

  setRepelStrength(strength: number): void {
    this.repelStrength = strength;
  }

  setMode(mode: BoundaryMode): void {
    this.mode = mode;
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

  private applyRepelForce(particle: Particle, spatialGrid: SpatialGrid): void {
    if (this.repelStrength <= 0) return;

    // For modes other than "none", we can optimize by skipping repel when distance is 0
    // since boundary constraints will handle keeping particles in bounds
    if (this.mode !== "none" && this.repelDistance <= 0) return;

    const { width, height } = spatialGrid.getSize();
    const radius = particle.size;

    // Calculate visible world bounds accounting for camera position and zoom
    const worldLeft = -this.cameraX / this.zoom;
    const worldTop = -this.cameraY / this.zoom;
    const worldRight = (width - this.cameraX) / this.zoom;
    const worldBottom = (height - this.cameraY) / this.zoom;

    // Calculate distances to each wall (negative means outside viewport)
    const distToLeft = particle.position.x - (worldLeft + radius);
    const distToRight = worldRight - radius - particle.position.x;
    const distToTop = particle.position.y - (worldTop + radius);
    const distToBottom = worldBottom - radius - particle.position.y;

    let forceX = 0;
    let forceY = 0;

    if (this.repelDistance <= 0) {
      // When repel distance is 0, apply full force to any particle outside viewport
      // Left wall - particle is outside left boundary
      if (distToLeft < 0) {
        forceX += this.repelStrength;
      }
      // Right wall - particle is outside right boundary
      if (distToRight < 0) {
        forceX -= this.repelStrength;
      }
      // Top wall - particle is outside top boundary
      if (distToTop < 0) {
        forceY += this.repelStrength;
      }
      // Bottom wall - particle is outside bottom boundary
      if (distToBottom < 0) {
        forceY -= this.repelStrength;
      }
    } else {
      // Standard repel behavior: gradual force within repel distance
      // Apply repel force from left wall
      if (distToLeft < this.repelDistance && distToLeft > 0) {
        const forceRatio =
          (this.repelDistance - distToLeft) / this.repelDistance;
        forceX += forceRatio * this.repelStrength;
      }

      // Apply repel force from right wall
      if (distToRight < this.repelDistance && distToRight > 0) {
        const forceRatio =
          (this.repelDistance - distToRight) / this.repelDistance;
        forceX -= forceRatio * this.repelStrength;
      }

      // Apply repel force from top wall
      if (distToTop < this.repelDistance && distToTop > 0) {
        const forceRatio =
          (this.repelDistance - distToTop) / this.repelDistance;
        forceY += forceRatio * this.repelStrength;
      }

      // Apply repel force from bottom wall
      if (distToBottom < this.repelDistance && distToBottom > 0) {
        const forceRatio =
          (this.repelDistance - distToBottom) / this.repelDistance;
        forceY -= forceRatio * this.repelStrength;
      }
    }

    // Apply the combined repel force using particle.applyForce()
    if (forceX !== 0 || forceY !== 0) {
      const repelForce = new Vector(forceX, forceY);
      particle.applyForce(repelForce);
    }
  }

  private handleBounce(particle: Particle, spatialGrid: SpatialGrid): void {
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
      if (this.friction > 0) {
        particle.velocity.y *= 1 - this.friction;
      }
    }

    // Right wall collision
    else if (particle.position.x > worldRight - radius) {
      particle.position.x = worldRight - radius;
      particle.velocity.x = -Math.abs(particle.velocity.x) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce y velocity)
      if (this.friction > 0) {
        particle.velocity.y *= 1 - this.friction;
      }
    }

    // Top wall collision
    if (particle.position.y < worldTop + radius) {
      particle.position.y = worldTop + radius;
      particle.velocity.y = Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      if (this.friction > 0) {
        particle.velocity.x *= 1 - this.friction;
      }
    }

    // Bottom wall collision
    else if (particle.position.y > worldBottom - radius) {
      particle.position.y = worldBottom - radius;
      particle.velocity.y = -Math.abs(particle.velocity.y) * this.bounce; // Force velocity away from wall
      // Apply tangential friction (reduce x velocity)
      if (this.friction > 0) {
        particle.velocity.x *= 1 - this.friction;
      }
    }
  }

  private handleKill(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.contains(particle, spatialGrid)) {
      // Kill particle by setting mass to 0
      particle.mass = 0;
    }
  }

  private handleWarp(particle: Particle, spatialGrid: SpatialGrid): void {
    const { width, height } = spatialGrid.getSize();
    const radius = particle.size;

    // Calculate visible world bounds accounting for camera position and zoom
    const worldLeft = -this.cameraX / this.zoom;
    const worldTop = -this.cameraY / this.zoom;
    const worldRight = (width - this.cameraX) / this.zoom;
    const worldBottom = (height - this.cameraY) / this.zoom;

    // Left/Right warp
    if (particle.position.x < worldLeft - radius) {
      particle.position.x = worldRight + radius;
    } else if (particle.position.x > worldRight + radius) {
      particle.position.x = worldLeft - radius;
    }

    // Top/Bottom warp
    if (particle.position.y < worldTop - radius) {
      particle.position.y = worldBottom + radius;
    } else if (particle.position.y > worldBottom + radius) {
      particle.position.y = worldTop - radius;
    }
  }

  constrain(particle: Particle, spatialGrid: SpatialGrid): void {
    switch (this.mode) {
      case "bounce":
        if (!this.contains(particle, spatialGrid)) {
          this.handleBounce(particle, spatialGrid);
        }
        break;
      case "kill":
        this.handleKill(particle, spatialGrid);
        break;
      case "warp":
        this.handleWarp(particle, spatialGrid);
        break;
      case "none":
        // No boundary constraints - particles can move freely outside viewport
        // Only repel forces (if enabled) will be applied
        break;
    }
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    // Always apply repel force if enabled (even in "none" mode)
    this.applyRepelForce(particle, spatialGrid);

    // Apply boundary behavior
    this.constrain(particle, spatialGrid);
  }
}
