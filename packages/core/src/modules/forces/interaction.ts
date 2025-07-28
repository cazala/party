import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

export interface InteractionOptions {
  position?: Vector2D;
  radius?: number;
  strength?: number;
}

export class Interaction implements Force {
  public position: Vector2D;
  public radius: number;
  public strength: number;
  public isActive: boolean = false;
  private mode: "attract" | "repel" = "attract";

  constructor(options: InteractionOptions = {}) {
    this.position = options.position || new Vector2D(0, 0);
    this.radius = options.radius || 200;
    this.strength = options.strength || 5000;
  }

  setPosition(x: number, y: number): void {
    this.position.set(x, y);
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }

  setStrength(strength: number): void {
    this.strength = strength;
  }

  setActive(active: boolean): void {
    this.isActive = active;
  }

  attract(): void {
    this.mode = "attract";
    this.isActive = true;
  }

  repel(): void {
    this.mode = "repel";
    this.isActive = true;
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    if (!this.isActive || particle.pinned) return;

    // Calculate distance from interaction point to particle
    const dx = this.position.x - particle.position.x;
    const dy = this.position.y - particle.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Skip if particle is outside interaction radius
    if (distance > this.radius || distance === 0) return;

    // Calculate force direction (normalized)
    const forceDirection = new Vector2D(dx / distance, dy / distance);

    // Calculate force magnitude with falloff based on distance
    // Closer particles experience stronger force
    const distanceRatio = 1 - distance / this.radius;
    const forceMagnitude = this.strength * distanceRatio * particle.mass;

    // Apply force in appropriate direction
    const force = forceDirection.multiply(
      this.mode === "attract" ? forceMagnitude : -forceMagnitude
    );

    particle.applyForce(force);
  }
}
