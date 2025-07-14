import { Particle } from "../particle";
import { Force } from "../system";
import { Vector2D } from "../vector";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Collisions
export const DEFAULT_COLLISIONS_ENABLED = true;
export const DEFAULT_COLLISIONS_EAT = false;

export interface CollisionsOptions {
  enabled?: boolean;
  eat?: boolean;
}

export class Collisions implements Force {
  public enabled: boolean;
  public eat: boolean;

  constructor(options: CollisionsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_COLLISIONS_ENABLED;
    this.eat = options.eat ?? DEFAULT_COLLISIONS_EAT;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setEat(eat: boolean): void {
    this.eat = eat;
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.enabled) {
      return;
    }

    // Get nearby particles using spatial grid (check larger radius for collision detection)
    const neighbors = spatialGrid.getParticles(
      particle.position,
      particle.size * 2
    );

    for (const other of neighbors) {
      if (other === particle) continue;

      this.checkCollision(particle, other);
    }
  }

  private checkCollision(particle1: Particle, particle2: Particle): void {
    const distance = particle1.position.distance(particle2.position);
    const combinedRadius = particle1.size + particle2.size; // Sum of both radii (size IS radius)

    // Check if particles are colliding (overlapping)
    if (distance >= combinedRadius) {
      return;
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
      return; // No force needed since we corrected positions
    }

    // SYMMETRY BREAKING: Detect near-perfect vertical or horizontal alignment
    const dx = Math.abs(collisionVector.x);
    const dy = Math.abs(collisionVector.y);
    const alignmentThreshold = 0.05; // Very small horizontal/vertical component indicates alignment

    // Check if particles are nearly perfectly aligned vertically or horizontally
    const isNearlyVertical =
      dx < alignmentThreshold && dy > 1 - alignmentThreshold; // Vertical
    const isNearlyHorizontal =
      dy < alignmentThreshold && dx > 1 - alignmentThreshold; // Horizontal

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
    // Heavy particles should push through light particles, not be stopped by them
    if (overlap > 0) {
      // ---- Position correction (mass-aware) ----
      const totalMass = particle1.mass + particle2.mass;

      // Amount of separation each particle gets is inversely proportional to its mass
      // Smaller (lighter) particles move more than heavier ones
      const separationPerMass = overlap / totalMass;

      const correction1 = collisionVector
        .clone()
        .multiply(separationPerMass * particle2.mass); // particle1 moves opposite of particle2 mass
      const correction2 = collisionVector
        .clone()
        .multiply(separationPerMass * particle1.mass); // particle2 moves opposite of particle1 mass

      particle1.position.add(correction1);
      particle2.position.subtract(correction2);

      // ---- Eating logic ----
      if (this.eat) {
        // Bigger particle eats smaller one
        if (particle1.mass > particle2.mass) {
          particle2.mass = 0; // Mark for removal
          particle2.size = 0;
          return; // No velocity response needed for eaten particle
        } else if (particle2.mass > particle1.mass) {
          particle1.mass = 0; // Mark for removal
          particle1.size = 0;
          return; // No velocity response needed for eaten particle
        }
        // If masses are equal, proceed with normal collision response
      }

      // ---- Velocity response (angle & mass aware) ----
      const n = collisionVector; // already normalized

      const v1 = particle1.velocity.clone();
      const v2 = particle2.velocity.clone();

      const v1n = n.dot(v1); // scalar normal components
      const v2n = n.dot(v2);

      // Tangential components (remain unchanged in perfectly frictionless collision)
      const v1t = v1.clone().subtract(n.clone().multiply(v1n));
      const v2t = v2.clone().subtract(n.clone().multiply(v2n));

      const m1 = particle1.mass;
      const m2 = particle2.mass;
      const e = 0.95; // coefficient of restitution (damping)

      // New normal velocities after 1-D collision equations with restitution
      const v1nAfter = (v1n * (m1 - e * m2) + (1 + e) * m2 * v2n) / (m1 + m2);
      const v2nAfter = (v2n * (m2 - e * m1) + (1 + e) * m1 * v1n) / (m1 + m2);

      const v1nVec = n.clone().multiply(v1nAfter);
      const v2nVec = n.clone().multiply(v2nAfter);

      // Combine tangential and updated normal components
      const newV1 = v1t.add(v1nVec);
      const newV2 = v2t.add(v2nVec);

      particle1.velocity.set(newV1.x, newV1.y);
      particle2.velocity.set(newV2.x, newV2.y);
    }

    // Forces are applied directly to particle velocities above
    return;
  }
}

export function createCollisionsForce(
  options: CollisionsOptions = {}
): Collisions {
  return new Collisions(options);
}

export const defaultCollisions = createCollisionsForce();
