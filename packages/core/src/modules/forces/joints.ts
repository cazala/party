import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Joints
export const DEFAULT_JOINTS_ENABLED = true;
export const DEFAULT_JOINT_STIFFNESS = 0.5;
export const DEFAULT_JOINT_DAMPING = 0.1;
export const DEFAULT_JOINT_MAX_FORCE = 1000;
export const DEFAULT_JOINT_TYPE: JointType = "pin";

export type JointType = "spring" | "pin";

export interface JointOptions {
  particleA: Particle;
  particleB: Particle;
  type?: JointType;
  restLength?: number;
  stiffness?: number;
  damping?: number;
  maxForce?: number;
  id?: string;
}

export interface JointsOptions {
  enabled?: boolean;
  defaultStiffness?: number;
  defaultDamping?: number;
  defaultMaxForce?: number;
  defaultType?: JointType;
}

/**
 * Represents a constraint between two particles
 */
export class Joint {
  public id: string;
  public particleA: Particle;
  public particleB: Particle;
  public type: JointType;
  public restLength: number;
  public stiffness: number;
  public damping: number;
  public maxForce: number;
  public isValid: boolean = true;

  constructor(options: JointOptions) {
    this.id =
      options.id ||
      `joint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.particleA = options.particleA;
    this.particleB = options.particleB;
    this.type = options.type || "pin";
    this.stiffness = options.stiffness || DEFAULT_JOINT_STIFFNESS;
    this.damping = options.damping || DEFAULT_JOINT_DAMPING;
    this.maxForce = options.maxForce || DEFAULT_JOINT_MAX_FORCE;

    // Calculate rest length as current distance if not provided
    if (options.restLength !== undefined) {
      this.restLength = options.restLength;
    } else {
      const dx = this.particleB.position.x - this.particleA.position.x;
      const dy = this.particleB.position.y - this.particleA.position.y;
      this.restLength = Math.sqrt(dx * dx + dy * dy);
    }
  }

  /**
   * Check if the joint is still valid (both particles exist and have positive mass)
   */
  validate(): boolean {
    this.isValid = this.particleA.mass > 0 && this.particleB.mass > 0;
    return this.isValid;
  }

  /**
   * Apply joint constraint forces to the connected particles
   */
  applyConstraint(): void {
    if (!this.validate()) return;

    // Skip if either particle is static (but allow static-dynamic pairs)
    if (this.particleA.static && this.particleB.static) return;

    // Calculate current distance and direction
    const dx = this.particleB.position.x - this.particleA.position.x;
    const dy = this.particleB.position.y - this.particleA.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Avoid division by zero
    if (distance < 0.001) return;

    const directionX = dx / distance;
    const directionY = dy / distance;

    // Pin joints use position constraints, not forces
    if (this.type === "pin") {
      this.applyPinConstraint(distance, directionX, directionY);
      return;
    }

    // Calculate displacement from rest length
    const displacement = distance - this.restLength;

    // Calculate relative velocity for damping
    const relativeVelX = this.particleB.velocity.x - this.particleA.velocity.x;
    const relativeVelY = this.particleB.velocity.y - this.particleA.velocity.y;
    const relativeVelAlongDirection =
      relativeVelX * directionX + relativeVelY * directionY;

    // Calculate spring force magnitude
    let forceMagnitude = 0;

    switch (this.type) {
      case "spring":
        // Spring joint: apply force proportional to displacement (both compression and extension)
        forceMagnitude =
          -this.stiffness * displacement -
          this.damping * relativeVelAlongDirection;
        break;
    }

    // Limit maximum force
    forceMagnitude = Math.max(
      -this.maxForce,
      Math.min(this.maxForce, forceMagnitude)
    );

    // Calculate force vector
    const forceX = forceMagnitude * directionX;
    const forceY = forceMagnitude * directionY;
    const force = new Vector2D(forceX, forceY);

    // Apply forces to particles (equal and opposite)
    if (!this.particleA.static) {
      this.particleA.applyForce(force.clone().multiply(-1));
    }
    if (!this.particleB.static) {
      this.particleB.applyForce(force);
    }
  }

  /**
   * Apply pin constraint by directly adjusting particle positions
   */
  private applyPinConstraint(
    currentDistance: number,
    directionX: number,
    directionY: number
  ): void {
    const displacement = currentDistance - this.restLength;

    // If already at correct distance, do nothing
    if (Math.abs(displacement) < 0.001) return;

    // Calculate correction needed
    const correction = displacement * 0.5; // Split correction between both particles

    // Calculate position adjustments
    const correctionX = correction * directionX;
    const correctionY = correction * directionY;

    // Apply position corrections
    if (!this.particleA.static && !this.particleB.static) {
      // Both particles can move - split the correction
      this.particleA.position.x += correctionX;
      this.particleA.position.y += correctionY;
      this.particleB.position.x -= correctionX;
      this.particleB.position.y -= correctionY;
    } else if (this.particleA.static && !this.particleB.static) {
      // Only particle B can move
      this.particleB.position.x =
        this.particleA.position.x + this.restLength * directionX;
      this.particleB.position.y =
        this.particleA.position.y + this.restLength * directionY;
    } else if (!this.particleA.static && this.particleB.static) {
      // Only particle A can move
      this.particleA.position.x =
        this.particleB.position.x - this.restLength * directionX;
      this.particleA.position.y =
        this.particleB.position.y - this.restLength * directionY;
    }

    // Apply velocity damping for pin joints to reduce oscillation
    if (this.damping > 0) {
      const dampingFactor = 1.0 - this.damping;

      if (!this.particleA.static) {
        this.particleA.velocity.x *= dampingFactor;
        this.particleA.velocity.y *= dampingFactor;
      }
      if (!this.particleB.static) {
        this.particleB.velocity.x *= dampingFactor;
        this.particleB.velocity.y *= dampingFactor;
      }
    }
  }

  /**
   * Get the current length of the joint
   */
  getCurrentLength(): number {
    const dx = this.particleB.position.x - this.particleA.position.x;
    const dy = this.particleB.position.y - this.particleA.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get the current tension/compression ratio (-1 = max compression, 0 = rest, 1 = max extension)
   */
  getStressRatio(): number {
    const currentLength = this.getCurrentLength();
    const displacement = currentLength - this.restLength;

    if (displacement === 0) return 0;

    // Normalize displacement to a reasonable range for visualization
    const maxExpectedDisplacement = this.restLength * 0.5; // 50% of rest length
    return Math.max(-1, Math.min(1, displacement / maxExpectedDisplacement));
  }

  /**
   * Create a copy of this joint
   */
  clone(): Joint {
    return new Joint({
      particleA: this.particleA,
      particleB: this.particleB,
      type: this.type,
      restLength: this.restLength,
      stiffness: this.stiffness,
      damping: this.damping,
      maxForce: this.maxForce,
      id: this.id,
    });
  }
}

/**
 * Manages a collection of joints and applies their constraints
 */
export class Joints implements Force {
  public enabled: boolean;
  public joints: Map<string, Joint> = new Map();
  public defaultStiffness: number;
  public defaultDamping: number;
  public defaultMaxForce: number;
  public defaultType: JointType;

  constructor(options: JointsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_JOINTS_ENABLED;
    this.defaultStiffness = options.defaultStiffness ?? DEFAULT_JOINT_STIFFNESS;
    this.defaultDamping = options.defaultDamping ?? DEFAULT_JOINT_DAMPING;
    this.defaultMaxForce = options.defaultMaxForce ?? DEFAULT_JOINT_MAX_FORCE;
    this.defaultType = options.defaultType ?? DEFAULT_JOINT_TYPE;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setDefaultStiffness(stiffness: number): void {
    this.defaultStiffness = stiffness;
  }

  setDefaultDamping(damping: number): void {
    this.defaultDamping = damping;
  }

  setDefaultMaxForce(maxForce: number): void {
    this.defaultMaxForce = maxForce;
  }

  setDefaultType(type: JointType): void {
    this.defaultType = type;
  }

  /**
   * Create a new joint between two particles
   */
  createJoint(
    options: Omit<
      JointOptions,
      "stiffness" | "damping" | "maxForce" | "type"
    > & {
      stiffness?: number;
      damping?: number;
      maxForce?: number;
      type?: JointType;
    }
  ): Joint {
    const joint = new Joint({
      ...options,
      type: options.type ?? this.defaultType,
      stiffness: options.stiffness ?? this.defaultStiffness,
      damping: options.damping ?? this.defaultDamping,
      maxForce: options.maxForce ?? this.defaultMaxForce,
    });

    this.joints.set(joint.id, joint);
    return joint;
  }

  /**
   * Remove a joint by ID
   */
  removeJoint(jointId: string): boolean {
    return this.joints.delete(jointId);
  }

  /**
   * Remove a joint by reference
   */
  removeJointByReference(joint: Joint): boolean {
    return this.joints.delete(joint.id);
  }

  /**
   * Get a joint by ID
   */
  getJoint(jointId: string): Joint | undefined {
    return this.joints.get(jointId);
  }

  /**
   * Get all joints as an array
   */
  getAllJoints(): Joint[] {
    return Array.from(this.joints.values());
  }

  /**
   * Get joints connected to a specific particle
   */
  getJointsForParticle(particle: Particle): Joint[] {
    return this.getAllJoints().filter(
      (joint) =>
        joint.particleA.id === particle.id || joint.particleB.id === particle.id
    );
  }

  /**
   * Remove all joints connected to a specific particle
   */
  removeJointsForParticle(particle: Particle): number {
    const jointsToRemove = this.getJointsForParticle(particle);
    jointsToRemove.forEach((joint) => this.joints.delete(joint.id));
    return jointsToRemove.length;
  }

  /**
   * Clear all joints
   */
  clear(): void {
    this.joints.clear();
  }

  /**
   * Get the total number of joints
   */
  getJointCount(): number {
    return this.joints.size;
  }

  /**
   * Check if a particle has any pin joints connected to it
   */
  hasJoint(particleId: number): boolean {
    for (const joint of this.joints.values()) {
      if (
        joint.type === "pin" &&
        (joint.particleA.id === particleId || joint.particleB.id === particleId)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Force interface: apply all joint constraints
   */
  apply(_particle: Particle, _spatialGrid: SpatialGrid): void {
    // Joints are applied globally, not per particle
    // This method is called for each particle, but we only process once
  }

  /**
   * Force interface: apply constraints to all joints (called once per frame)
   */
  warmup(_particles: Particle[], _deltaTime: number): void {
    if (!this.enabled) return;

    // Remove invalid joints (particles that have been deleted)
    const invalidJoints: string[] = [];
    for (const [id, joint] of this.joints) {
      if (!joint.validate()) {
        invalidJoints.push(id);
      }
    }

    invalidJoints.forEach((id) => this.joints.delete(id));

    // Apply all joint constraints
    for (const joint of this.joints.values()) {
      joint.applyConstraint();
    }
  }
}
