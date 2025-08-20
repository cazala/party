import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";
import { Joints } from "./joints";

// Gravity direction enum
export type GravityDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "in"
  | "out"
  | "custom";

// Default constants for Environment
export const DEFAULT_GRAVITY_STRENGTH = 0;
export const DEFAULT_GRAVITY_DIRECTION: GravityDirection = "down";
export const DEFAULT_GRAVITY_ANGLE = Math.PI / 2; // radians (90 degrees, downward)
export const DEFAULT_FRICTION = 0;
export const DEFAULT_DAMPING = 1;
export const DEFAULT_MOMENTUM_PRESERVATION = 0.7;

export interface EnvironmentOptions {
  gravity?: {
    strength?: number;
    direction?: GravityDirection;
    angle?: number; // Only used when direction is 'custom'
  };
  friction?: number;
  worldWidth?: number; // For 'in'/'out' gravity calculations
  worldHeight?: number; // For 'in'/'out' gravity calculations
  damping?: number;
  momentum?: number; // Momentum preservation for joint particles
  joints?: any; // Reference to joints module
}

export class Environment implements Force {
  public gravity: {
    strength: number;
    direction: GravityDirection;
    angle?: number; // Only for custom direction
  };
  public friction: number;
  public damping: number;
  public momentum: number;
  public worldWidth: number;
  public worldHeight: number;

  // Camera properties for calculating visible world center
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;

  // Store positions before physics integration for inertia and momentum preservation
  private previousPositions: Map<number, Vector2D> = new Map();
  // Reference to joints module for momentum preservation
  private joints?: Joints;

  constructor(options: EnvironmentOptions = {}) {
    this.gravity = {
      strength: options.gravity?.strength ?? DEFAULT_GRAVITY_STRENGTH,
      direction: options.gravity?.direction ?? DEFAULT_GRAVITY_DIRECTION,
      angle: options.gravity?.angle ?? DEFAULT_GRAVITY_ANGLE,
    };
    this.friction = options.friction ?? DEFAULT_FRICTION;
    this.damping = options.damping ?? DEFAULT_DAMPING;
    this.momentum = options.momentum ?? DEFAULT_MOMENTUM_PRESERVATION;
    this.worldWidth = options.worldWidth ?? 1200;
    this.worldHeight = options.worldHeight ?? 800;
    this.joints = options.joints;
  }

  // Getters for backward compatibility
  get strength(): number {
    return this.gravity.strength;
  }

  get direction(): Vector2D {
    return this.calculateGravityDirection(new Vector2D(0, 0)); // Default particle position for compatibility
  }

  setStrength(strength: number): void {
    this.gravity.strength = strength;
  }

  setDirection(direction: GravityDirection): void {
    this.gravity.direction = direction;
  }

  setGravityAngle(angle: number): void {
    this.gravity.angle = angle;
  }

  setDamping(damping: number): void {
    this.damping = Math.max(0, Math.min(1, damping)); // Clamp between 0 and 1
  }

  setMomentum(momentum: number): void {
    this.momentum = Math.max(0, Math.min(1, momentum)); // Clamp between 0 and 1
  }

  setJoints(joints: any): void {
    this.joints = joints;
  }

  setWorldSize(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  setCamera(cameraX: number, cameraY: number, zoom: number): void {
    this.cameraX = cameraX;
    this.cameraY = cameraY;
    this.zoom = zoom;
  }

  setFriction(friction: number): void {
    this.friction = Math.max(0, Math.min(1, friction)); // Clamp between 0 and 1
  }

  /**
   * Calculate gravity direction vector based on direction type and particle position
   */
  private calculateGravityDirection(particlePosition: Vector2D): Vector2D {
    switch (this.gravity.direction) {
      case "up":
        return new Vector2D(0, -1);
      case "down":
        return new Vector2D(0, 1);
      case "left":
        return new Vector2D(-1, 0);
      case "right":
        return new Vector2D(1, 0);
      case "in": {
        // Gravity toward visible world center (accounting for camera position and zoom)
        const visibleCenterX =
          (-this.cameraX + this.worldWidth / 2) / this.zoom;
        const visibleCenterY =
          (-this.cameraY + this.worldHeight / 2) / this.zoom;
        const direction = new Vector2D(
          visibleCenterX - particlePosition.x,
          visibleCenterY - particlePosition.y
        );
        const length = Math.sqrt(
          direction.x * direction.x + direction.y * direction.y
        );
        if (length > 0) {
          return new Vector2D(direction.x / length, direction.y / length);
        }
        return new Vector2D(0, 0);
      }
      case "out": {
        // Gravity away from visible world center (accounting for camera position and zoom)
        const visibleCenterX =
          (-this.cameraX + this.worldWidth / 2) / this.zoom;
        const visibleCenterY =
          (-this.cameraY + this.worldHeight / 2) / this.zoom;
        const direction = new Vector2D(
          particlePosition.x - visibleCenterX,
          particlePosition.y - visibleCenterY
        );
        const length = Math.sqrt(
          direction.x * direction.x + direction.y * direction.y
        );
        if (length > 0) {
          return new Vector2D(direction.x / length, direction.y / length);
        }
        return new Vector2D(0, 0);
      }
      case "custom":
        return Vector2D.fromAngle(this.gravity.angle ?? DEFAULT_GRAVITY_ANGLE);
      default:
        return new Vector2D(0, 1); // Default to down
    }
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    if (particle.pinned || particle.grabbed) {
      return;
    }

    // Apply gravity force
    if (this.gravity.strength !== 0) {
      const gravityDirection = this.calculateGravityDirection(
        particle.position
      );
      const gravityForce = gravityDirection
        .clone()
        .multiply(this.gravity.strength * particle.mass);
      particle.applyForce(gravityForce);
    }

    // Apply friction (dampen current velocity)
    if (this.friction > 0) {
      const frictionForce = particle.velocity
        .clone()
        .multiply(-this.friction * particle.mass);
      particle.applyForce(frictionForce);
    }

    if (this.damping !== 1) {
      particle.velocity.multiply(this.damping);
    }
  }

  /**
   * Clean up stored positions for removed particles
   */
  cleanupRemovedParticles(activeParticleIds: Set<number>): void {
    for (const particleId of this.previousPositions.keys()) {
      if (!activeParticleIds.has(particleId)) {
        this.previousPositions.delete(particleId);
      }
    }
  }

  /**
   * Clear all stored positions (useful for resets)
   */
  before(particles: Particle[], deltaTime: number): void {
    if (deltaTime <= 0) return;
    // Store positions before physics integration for both inertia and momentum preservation
    for (const particle of particles) {
      this.previousPositions.set(particle.id, particle.position.clone());
    }
  }

  after(particles: Particle[], deltaTime: number, _spatialGrid: any): void {
    if (!this.joints || deltaTime <= 0) return;
    this.applyMomentumPreservation(particles, deltaTime);
  }

  /**
   * Apply momentum preservation to joint particles
   * Called after physics integration with prePhysicsPositions
   */
  applyMomentumPreservation(particles: Particle[], deltaTime: number): void {
    if (!this.joints || deltaTime <= 0) return;

    // Update velocities for constrained particles to match actual movement
    for (const particle of particles) {
      if (!particle.pinned && this.joints?.hasJoint?.(particle.id)) {
        const previousPosition = this.previousPositions.get(particle.id);
        if (previousPosition) {
          const totalMovement = particle.position
            .clone()
            .subtract(previousPosition);
          const actualVelocity = totalMovement.divide(deltaTime);

          particle.velocity = particle.velocity
            .clone()
            .multiply(1 - this.momentum)
            .add(actualVelocity.multiply(this.momentum));
        }
      }
    }
  }

  clear(): void {
    this.previousPositions.clear();
  }

  /**
   * Update world size for 'in' and 'out' gravity calculations
   * This should be called when the system size changes
   */
  updateWorldSize(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }
}

export function createEnvironmentForce(
  gravity: {
    strength?: number;
    direction?: GravityDirection;
    angle?: number;
  } = {},
  friction: number = DEFAULT_FRICTION,
  damping: number = DEFAULT_DAMPING
): Environment {
  return new Environment({
    gravity: {
      strength: gravity.strength ?? DEFAULT_GRAVITY_STRENGTH,
      direction: gravity.direction ?? DEFAULT_GRAVITY_DIRECTION,
      angle: gravity.angle ?? DEFAULT_GRAVITY_ANGLE,
    },
    friction,
    damping,
  });
}

export const defaultEnvironment = createEnvironmentForce();
