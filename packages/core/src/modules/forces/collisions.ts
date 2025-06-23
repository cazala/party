import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Collisions
export const DEFAULT_COLLISIONS_ENABLED = false;
export const DEFAULT_COLLISIONS_DAMPING = 0.7;
export const DEFAULT_COLLISIONS_MIN_FORCE = 50;
export const DEFAULT_COLLISIONS_MAX_FORCE = 2000;

export interface CollisionsOptions {
  enabled?: boolean;
  damping?: number;
  minForce?: number;
  maxForce?: number;
}

export class Collisions implements Force {
  public enabled: boolean;
  public damping: number;
  public minForce: number;
  public maxForce: number;

  constructor(options: CollisionsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_COLLISIONS_ENABLED;
    this.damping = options.damping ?? DEFAULT_COLLISIONS_DAMPING;
    this.minForce = options.minForce ?? DEFAULT_COLLISIONS_MIN_FORCE;
    this.maxForce = options.maxForce ?? DEFAULT_COLLISIONS_MAX_FORCE;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDamping(damping: number): void {
    this.damping = damping;
  }

  setMinForce(minForce: number): void {
    this.minForce = minForce;
  }

  setMaxForce(maxForce: number): void {
    this.maxForce = maxForce;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    spatialGrid: SpatialGrid
  ): Vector2D {
    if (!this.enabled) {
      return Vector2D.zero();
    }

    const force = new Vector2D(0, 0);

    // Get nearby particles using spatial grid (check larger radius for collision detection)
    const neighbors = spatialGrid.getNeighbors(particle, particle.size * 2);

    for (const other of neighbors) {
      if (other === particle) continue;

      const collisionForce = this.checkCollision(particle, other);
      if (collisionForce) {
        force.add(collisionForce);
      }
    }

    return force;
  }

  private checkCollision(
    particle1: Particle,
    particle2: Particle
  ): Vector2D | null {
    const distance = particle1.position.distance(particle2.position);
    const combinedRadius = particle1.size + particle2.size; // Sum of both radii (size IS radius)

    // Check if particles are colliding (overlapping)
    if (distance >= combinedRadius) {
      return null;
    }

    // Calculate collision vector (from particle2 to particle1)
    const collisionVector = particle1.position
      .clone()
      .subtract(particle2.position);

    // Prevent division by zero
    if (distance === 0) {
      // Particles are at exact same position - separate them with random direction
      const angle = Math.random() * Math.PI * 2;
      collisionVector.set(Math.cos(angle), Math.sin(angle));
      // Move them apart immediately
      const separationDistance = combinedRadius * 0.51; // Slightly more than touching
      particle1.position.set(
        particle1.position.x + collisionVector.x * separationDistance,
        particle1.position.y + collisionVector.y * separationDistance
      );
      particle2.position.set(
        particle2.position.x - collisionVector.x * separationDistance,
        particle2.position.y - collisionVector.y * separationDistance
      );
      return Vector2D.zero(); // No force needed since we corrected positions
    }

    // SYMMETRY BREAKING: Detect near-perfect vertical or horizontal alignment
    const dx = Math.abs(collisionVector.x);
    const dy = Math.abs(collisionVector.y);
    const alignmentThreshold = 0.05; // Very small horizontal/vertical component indicates alignment

    // Check if particles are nearly perfectly aligned vertically or horizontally
    const isNearlyVertical = dx < alignmentThreshold && dy > 0.95;
    const isNearlyHorizontal = dy < alignmentThreshold && dx > 0.95;

    if (isNearlyVertical || isNearlyHorizontal) {
      // Add small random perturbation to break symmetry
      const perturbationStrength = 0.1;
      const randomAngle = (Math.random() - 0.5) * Math.PI * 0.2; // ±18 degrees

      // Rotate the collision vector slightly
      const cos = Math.cos(randomAngle);
      const sin = Math.sin(randomAngle);
      const newX = collisionVector.x * cos - collisionVector.y * sin;
      const newY = collisionVector.x * sin + collisionVector.y * cos;

      collisionVector.set(newX, newY);

      // Also add small random position perturbations to particles
      const perturbX = (Math.random() - 0.5) * perturbationStrength;
      const perturbY = (Math.random() - 0.5) * perturbationStrength;

      particle1.position.add(new Vector2D(perturbX, perturbY));
      particle2.position.add(new Vector2D(-perturbX, -perturbY));
    }

    // Normalize the collision vector
    collisionVector.normalize();

    // Calculate overlap
    const overlap = combinedRadius - distance;

    // POSITION CORRECTION: Move particles apart so they don't overlap
    if (overlap > 0) {
      // Calculate how much to move each particle (split the correction)
      const correctionDistance = overlap * 0.5; // Each particle moves half the overlap

      // Move particle1 away from particle2
      particle1.position.add(
        collisionVector.clone().multiply(correctionDistance)
      );

      // Move particle2 away from particle1
      particle2.position.subtract(
        collisionVector.clone().multiply(correctionDistance)
      );
    }

    // Calculate collision force based on overlap
    let forceMagnitude = overlap * 2000; // Strong base force proportional to overlap

    // Apply min/max force limits
    forceMagnitude = Math.max(
      this.minForce,
      Math.min(this.maxForce, forceMagnitude)
    );

    // Apply damping
    forceMagnitude *= this.damping;

    // Return force vector
    return collisionVector.multiply(forceMagnitude);
  }
}

export function createCollisionsForce(
  options: CollisionsOptions = {}
): Collisions {
  return new Collisions(options);
}

export const defaultCollisions = createCollisionsForce();
