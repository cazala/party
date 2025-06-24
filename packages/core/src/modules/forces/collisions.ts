import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";
import { SpatialGrid } from "../spatial-grid.js";

// Default constants for Collisions
export const DEFAULT_COLLISIONS_ENABLED = false;
export const DEFAULT_COLLISIONS_AIR_DAMPING = 0.8; // Less damping for realistic air collisions
export const DEFAULT_COLLISIONS_FLOOR_DAMPING = 0.4; // High damping for floor settling
export const DEFAULT_COLLISIONS_MIN_FORCE = 50;
export const DEFAULT_COLLISIONS_MAX_FORCE = 2000;
export const DEFAULT_COLLISIONS_FLOOR_CONTACT_THRESHOLD = 3; // Distance from floor to use floor damping

export interface CollisionsOptions {
  enabled?: boolean;
  airDamping?: number;
  floorDamping?: number;
  minForce?: number;
  maxForce?: number;
  floorContactThreshold?: number;
}

export class Collisions implements Force {
  public enabled: boolean;
  public airDamping: number;
  public floorDamping: number;
  public minForce: number;
  public maxForce: number;
  public floorContactThreshold: number;

  constructor(options: CollisionsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_COLLISIONS_ENABLED;
    this.airDamping = options.airDamping ?? DEFAULT_COLLISIONS_AIR_DAMPING;
    this.floorDamping = options.floorDamping ?? DEFAULT_COLLISIONS_FLOOR_DAMPING;
    this.minForce = options.minForce ?? DEFAULT_COLLISIONS_MIN_FORCE;
    this.maxForce = options.maxForce ?? DEFAULT_COLLISIONS_MAX_FORCE;
    this.floorContactThreshold = options.floorContactThreshold ?? DEFAULT_COLLISIONS_FLOOR_CONTACT_THRESHOLD;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setAirDamping(damping: number): void {
    this.airDamping = damping;
  }

  setFloorDamping(damping: number): void {
    this.floorDamping = damping;
  }

  setMinForce(minForce: number): void {
    this.minForce = minForce;
  }

  setMaxForce(maxForce: number): void {
    this.maxForce = maxForce;
  }

  setFloorContactThreshold(threshold: number): void {
    this.floorContactThreshold = threshold;
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

      const collisionForce = this.checkCollision(particle, other, spatialGrid);
      if (collisionForce) {
        force.add(collisionForce);
      }
    }

    return force;
  }

  private checkCollision(
    particle1: Particle,
    particle2: Particle,
    spatialGrid: SpatialGrid
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

    // WALL CLIMBING PREVENTION: Directionally reduce forces near walls
    const { width, height } = spatialGrid.getSize();
    const wallMargin = particle1.size * 3; // Area near walls where we adjust forces
    
    const nearLeftWall = particle1.position.x < wallMargin;
    const nearRightWall = particle1.position.x > width - wallMargin;
    const nearTopWall = particle1.position.y < wallMargin;
    const nearBottomWall = particle1.position.y > height - wallMargin;
    
    // Directional force adjustment to prevent wall accumulation
    if (nearLeftWall && collisionVector.x < 0) {
      // Near left wall and collision force points left (toward wall) - reduce it
      collisionVector.x *= 0.2;
    } else if (nearRightWall && collisionVector.x > 0) {
      // Near right wall and collision force points right (toward wall) - reduce it  
      collisionVector.x *= 0.2;
    }
    
    // For vertical walls, add stronger outward bias to prevent accumulation
    if (nearLeftWall) {
      collisionVector.x += 0.3; // Stronger rightward bias to push away from left wall
    } else if (nearRightWall) {
      collisionVector.x -= 0.3; // Stronger leftward bias to push away from right wall
    }
    
    // Additional anti-accumulation: if very close to wall, add extra outward force
    const veryCloseMargin = particle1.size * 1.5;
    if (particle1.position.x < veryCloseMargin) {
      collisionVector.x += 0.5; // Strong rightward force when very close to left wall
    } else if (particle1.position.x > width - veryCloseMargin) {
      collisionVector.x -= 0.5; // Strong leftward force when very close to right wall
    }
    
    // If near horizontal walls, reduce vertical collision forces (but less so for floor)
    if (nearTopWall && collisionVector.y < 0) {
      collisionVector.y *= 0.3;
    } else if (nearBottomWall && collisionVector.y > 0) {
      collisionVector.y *= 0.7; // Allow some upward force but reduce it
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

    // Reduce collision forces for slow-moving particles to help system reach equilibrium
    const relativeVelocity = particle1.velocity.clone().subtract(particle2.velocity);
    const relativeSpeed = relativeVelocity.magnitude();
    const speedThreshold = 100; // Particles moving slower than this get reduced collision forces
    
    if (relativeSpeed < speedThreshold) {
      const speedReduction = Math.max(0.3, relativeSpeed / speedThreshold); // Minimum 30% force
      forceMagnitude *= speedReduction;
    }

    // Apply min/max force limits
    forceMagnitude = Math.max(
      this.minForce,
      Math.min(this.maxForce, forceMagnitude)
    );

    // Apply appropriate damping based on floor contact
    const { height: canvasHeight } = spatialGrid.getSize();
    const distanceFromFloor1 = canvasHeight - particle1.position.y - particle1.size;
    const distanceFromFloor2 = canvasHeight - particle2.position.y - particle2.size;
    
    // Check if either particle is near the floor
    const particle1OnFloor = distanceFromFloor1 <= this.floorContactThreshold;
    const particle2OnFloor = distanceFromFloor2 <= this.floorContactThreshold;
    const anyParticleOnFloor = particle1OnFloor || particle2OnFloor;
    
    // ROLLING SYMMETRY BREAKING: Detect and prevent ball bearing acceleration
    // (reusing relativeVelocity and relativeSpeed from above)
    
    // Detect "rolling over aligned particles" scenario
    const distance2D = Math.sqrt((particle1.position.x - particle2.position.x) ** 2 + 
                                (particle1.position.y - particle2.position.y) ** 2);
    const contactDistance = particle1.size + particle2.size;
    const isInContact = distance2D <= contactDistance * 1.1; // Slightly overlapping
    
    // Check if collision is mostly perpendicular to relative motion (rolling signature)
    const velocityDirection = relativeVelocity.clone().normalize();
    const collisionDirection = collisionVector.clone().normalize();
    const dotProduct = Math.abs(velocityDirection.x * collisionDirection.x + velocityDirection.y * collisionDirection.y);
    const isPerpendicularCollision = dotProduct < 0.3; // Nearly perpendicular
    
    // Detect high-speed rolling (ball bearing effect)
    const isHighSpeedRolling = relativeSpeed > 30 && isInContact && isPerpendicularCollision;
    
    // SYMMETRY BREAKING for rolling scenarios
    if (isHighSpeedRolling) {
      // Method 1: Add random perturbation to break symmetry
      const perturbationStrength = 0.3;
      const randomX = (Math.random() - 0.5) * perturbationStrength;
      const randomY = (Math.random() - 0.5) * perturbationStrength;
      
      collisionVector.x += randomX;
      collisionVector.y += randomY;
      
      // Method 2: Dramatically reduce forces in direction of motion
      const motionDirection = particle1.velocity.clone().normalize();
      const forceInMotionDirection = collisionVector.x * motionDirection.x + collisionVector.y * motionDirection.y;
      
      if (forceInMotionDirection > 0) { // Force is accelerating the motion
        collisionVector.x -= motionDirection.x * forceInMotionDirection * 0.9; // Remove 90% of accelerating force
        collisionVector.y -= motionDirection.y * forceInMotionDirection * 0.9;
      }
      
      // Method 3: Apply strong velocity damping in motion direction
      const dampingFactor = 0.7;
      particle1.velocity.x *= dampingFactor;
      particle1.velocity.y *= dampingFactor;
      particle2.velocity.x *= dampingFactor;
      particle2.velocity.y *= dampingFactor;
      
      // Method 4: Reduce overall force magnitude
      forceMagnitude *= 0.2;
    }
    
    // Additional safety: Cap velocity in any direction if it gets too high
    const maxVelocity = 200;
    const particle1Speed = particle1.velocity.magnitude();
    const particle2Speed = particle2.velocity.magnitude();
    
    if (particle1Speed > maxVelocity) {
      particle1.velocity.normalize().multiply(maxVelocity);
    }
    if (particle2Speed > maxVelocity) {
      particle2.velocity.normalize().multiply(maxVelocity);
    }
    
    // Use floor damping if any particle is on floor, otherwise use air damping
    const damping = anyParticleOnFloor ? this.floorDamping : this.airDamping;
    forceMagnitude *= damping;

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
