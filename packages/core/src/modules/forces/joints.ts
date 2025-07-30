import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Joints
export const DEFAULT_JOINTS_ENABLED = true;
export const DEFAULT_JOINT_COLLISIONS_ENABLED = true;
export const DEFAULT_JOINT_STIFFNESS = 1.0;
export const DEFAULT_JOINT_TOLERANCE = 1.0;

export interface JointOptions {
  particleA: Particle;
  particleB: Particle;
  /** Optional custom rest length. If not provided, uses current distance between particles */
  restLength?: number;
  /** Joint stiffness (0.0 = elastic, 1.0 = rigid). Defaults to DEFAULT_JOINT_STIFFNESS */
  stiffness?: number;
  /** Joint tolerance (0.0 = break easily, 1.0 = never break). Defaults to DEFAULT_JOINT_TOLERANCE */
  tolerance?: number;
  /** Optional custom joint ID. If not provided, generates unique ID */
  id?: string;
}

export interface JointsOptions {
  enabled?: boolean;
  enableCollisions?: boolean;
}

/**
 * Represents a constraint between two particles.
 * Supports both rigid and elastic joints based on stiffness parameter.
 * Joints can break under stress based on tolerance parameter.
 */
export class Joint {
  public id: string;
  public particleA: Particle;
  public particleB: Particle;
  public restLength: number;
  public stiffness: number;
  public tolerance: number;
  public isValid: boolean = true;
  private isBroken: boolean = false;

  constructor(options: JointOptions) {
    this.id =
      options.id ||
      `joint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.particleA = options.particleA;
    this.particleB = options.particleB;
    this.stiffness = options.stiffness ?? DEFAULT_JOINT_STIFFNESS;
    this.tolerance = options.tolerance ?? DEFAULT_JOINT_TOLERANCE;

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
   * Once broken due to stress, joints remain permanently broken
   */
  validate(): boolean {
    // If joint was broken due to stress, it stays broken permanently
    if (this.isBroken) {
      this.isValid = false;
      return false;
    }
    
    // Otherwise, validate based on particle existence
    this.isValid = this.particleA.mass > 0 && this.particleB.mass > 0;
    return this.isValid;
  }

  /**
   * Apply joint constraint forces to the connected particles.
   * Uses stiffness parameter to control elasticity (1.0 = rigid, 0.0 = no constraint).
   * Joints break when stress exceeds tolerance (1.0 = never break, 0.0 = break easily).
   */
  applyConstraint(): void {
    if (!this.validate()) return;

    if (this.stiffness === 0) return;

    // Check stress-based breaking before applying constraint
    if (this.tolerance < 1.0) {
      const stress = Math.abs(this.getStressRatio());
      if (stress > this.tolerance) {
        this.isBroken = true;
        this.isValid = false;
        return;
      }
    }

    // Skip if both particles are pinned (but allow pinned-dynamic pairs)
    if (this.particleA.pinned && this.particleB.pinned) return;

    // Skip if both particles are grabbed (but allow grabbed-dynamic pairs)
    if (this.particleA.grabbed && this.particleB.grabbed) return;

    // Calculate current distance and direction
    const dx = this.particleB.position.x - this.particleA.position.x;
    const dy = this.particleB.position.y - this.particleA.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Avoid division by zero
    if (distance < 0.001) return;

    const directionX = dx / distance;
    const directionY = dy / distance;

    // Apply joint constraint
    this.applyJointConstraint(distance, directionX, directionY);
  }

  /**
   * Apply joint constraint by adjusting particle positions based on stiffness
   */
  private applyJointConstraint(
    currentDistance: number,
    directionX: number,
    directionY: number
  ): void {
    const displacement = currentDistance - this.restLength;

    // If already at correct distance, do nothing
    if (Math.abs(displacement) < 0.001) return;

    // Calculate correction needed based on stiffness
    const correction = displacement * this.stiffness * 0.5; // Split correction between both particles

    // Calculate position adjustments
    const correctionX = correction * directionX;
    const correctionY = correction * directionY;

    // Apply position corrections
    if (
      !this.particleA.pinned &&
      !this.particleA.grabbed &&
      !this.particleB.pinned &&
      !this.particleB.grabbed
    ) {
      // Both particles can move - split the correction
      this.particleA.position.x += correctionX;
      this.particleA.position.y += correctionY;
      this.particleB.position.x -= correctionX;
      this.particleB.position.y -= correctionY;
    } else if (
      (this.particleA.pinned || this.particleA.grabbed) &&
      !this.particleB.pinned &&
      !this.particleB.grabbed
    ) {
      // Only particle B can move (A is pinned or grabbed)
      this.particleB.position.x =
        this.particleA.position.x + this.restLength * directionX;
      this.particleB.position.y =
        this.particleA.position.y + this.restLength * directionY;
    } else if (
      !this.particleA.pinned &&
      !this.particleA.grabbed &&
      (this.particleB.pinned || this.particleB.grabbed)
    ) {
      // Only particle A can move (B is pinned or grabbed)
      this.particleA.position.x =
        this.particleB.position.x - this.restLength * directionX;
      this.particleA.position.y =
        this.particleB.position.y - this.restLength * directionY;
    }

    // Joints maintain distance constraint based on stiffness (1.0 = rigid, 0.0 = no constraint)
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
   * Check if the joint has been permanently broken due to stress
   */
  isBrokenByStress(): boolean {
    return this.isBroken;
  }

  /**
   * Create a copy of this joint
   */
  clone(): Joint {
    const clonedJoint = new Joint({
      particleA: this.particleA,
      particleB: this.particleB,
      restLength: this.restLength,
      stiffness: this.stiffness,
      tolerance: this.tolerance,
      id: this.id,
    });
    
    // Preserve broken state using private access
    (clonedJoint as any).isBroken = this.isBroken;
    clonedJoint.isValid = this.isValid;
    
    return clonedJoint;
  }
}

/**
 * Manages a collection of joints and applies their constraints.
 * Supports both rigid and elastic joints with configurable stiffness.
 * Joints can break under stress based on configurable tolerance.
 */
export class Joints implements Force {
  public enabled: boolean;
  public joints: Map<string, Joint> = new Map();
  public enableCollisions: boolean;
  private globalStiffness: number = DEFAULT_JOINT_STIFFNESS;
  private globalTolerance: number = DEFAULT_JOINT_TOLERANCE;

  // Track grabbed particles and their previous positions for velocity calculation
  private grabbedParticlePositions: Map<number, Vector2D> = new Map();

  constructor(options: JointsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_JOINTS_ENABLED;
    this.enableCollisions =
      options.enableCollisions ?? DEFAULT_JOINT_COLLISIONS_ENABLED;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setEnableCollisions(enableCollisions: boolean): void {
    this.enableCollisions = enableCollisions;
  }

  /**
   * Set global stiffness for all existing joints
   */
  setGlobalStiffness(stiffness: number): void {
    this.globalStiffness = Math.max(0, Math.min(1, stiffness)); // Clamp between 0 and 1
    // Apply to all existing joints
    for (const joint of this.joints.values()) {
      joint.stiffness = this.globalStiffness;
    }
  }

  /**
   * Get current global stiffness setting
   */
  getGlobalStiffness(): number {
    return this.globalStiffness;
  }

  /**
   * Set global tolerance for all existing joints (0.0 = break easily, 1.0 = never break)
   */
  setGlobalTolerance(tolerance: number): void {
    this.globalTolerance = Math.max(0, Math.min(1, tolerance)); // Clamp between 0 and 1
    // Apply to all existing joints
    for (const joint of this.joints.values()) {
      joint.tolerance = this.globalTolerance;
    }
  }

  /**
   * Get current global tolerance setting
   */
  getGlobalTolerance(): number {
    return this.globalTolerance;
  }

  /**
   * Create a new joint between two particles
   */
  createJoint(options: JointOptions): Joint {
    // Use global stiffness and tolerance if not specified in options
    const jointOptions = {
      ...options,
      stiffness: options.stiffness ?? this.globalStiffness,
      tolerance: options.tolerance ?? this.globalTolerance,
    };
    const joint = new Joint(jointOptions);
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
   * Check if a particle has any joints connected to it
   */
  hasJoint(particleId: number): boolean {
    for (const joint of this.joints.values()) {
      if (
        joint.particleA.id === particleId ||
        joint.particleB.id === particleId
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Force interface: apply method (joint constraints are handled in after() method)
   */
  apply(_particle: Particle, _spatialGrid: SpatialGrid): void {
    // Joint constraints are applied in after() method after physics integration
    // This method is kept for interface compatibility but does nothing
  }

  /**
   * Force interface: prepare joints before physics integration
   */
  before(particles: Particle[], _deltaTime: number): void {
    if (!this.enabled) return;

    // Remove invalid joints (particles that have been deleted)
    const invalidJoints: string[] = [];
    for (const [id, joint] of this.joints) {
      if (!joint.validate()) {
        invalidJoints.push(id);
      }
    }

    invalidJoints.forEach((id) => this.joints.delete(id));

    // Clean up grabbed particle positions for particles that no longer exist or are no longer grabbed
    for (const [particleId] of this.grabbedParticlePositions) {
      const particle = particles.find((p) => p.id === particleId);
      if (!particle || !particle.grabbed) {
        this.grabbedParticlePositions.delete(particleId);
      }
    }
  }

  /**
   * Force interface: apply joint constraints after physics integration
   */
  constraints(_particles: Particle[], _spatialGrid: SpatialGrid): void {
    if (!this.enabled) return;

    // Apply all joint constraints
    for (const joint of this.joints.values()) {
      joint.applyConstraint();
    }
  }
}
