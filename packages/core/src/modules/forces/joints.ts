import { Vector2D } from "../vector";
import { Particle } from "../particle";
import { Force } from "../system";
import { SpatialGrid } from "../spatial-grid";
import { lineSegmentsIntersect, calculateCentroid } from "../geometry";

// Mass clamping constants to prevent collision instabilities (same as collisions.ts)
const MIN_COLLISION_MASS = 2;
const MAX_COLLISION_MASS = 5.0;

// Joint-joint collision constants (matching particle-joint approach)
const JOINT_RESTITUTION = 0.1; // Restitution coefficient for joint-joint collisions
const MAX_POSITION_CHANGE_PER_FRAME = 3.0; // Emergency position change limit

/**
 * Clamp mass values for collision calculations to prevent instabilities
 * while preserving original mass for other physics calculations
 */
function clampMassForCollision(mass: number): number {
  return Math.max(MIN_COLLISION_MASS, Math.min(MAX_COLLISION_MASS, mass));
}
import { RigidBody } from "../rigid-body";

/**
 * JOINTS SYSTEM RESPONSIBILITIES:
 *
 * This module handles STRUCTURAL constraints and rigid body mechanics:
 * - Joint constraint solving (maintaining distance constraints)
 * - Rigid body group management and queries
 * - Joint intersection detection and resolution
 * - Exhaustive constraint solving to prevent structural violations
 * - Spatial separation of intersecting rigid bodies
 *
 * NOTE: This module does NOT handle dynamic collision physics.
 * Particle bouncing, momentum transfer, and collision responses are handled by the Collisions module.
 */

// Default constants for Joints
export const DEFAULT_JOINTS_ENABLED = true;
export const DEFAULT_JOINT_COLLISIONS_ENABLED = true;
export const DEFAULT_JOINT_TOLERANCE = 1.0;

export interface JointOptions {
  particleA: Particle;
  particleB: Particle;
  /** Optional custom rest length. If not provided, uses current distance between particles */
  restLength?: number;
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
  public tolerance: number;
  public isValid: boolean = true;
  private isBroken: boolean = false;

  constructor(options: JointOptions) {
    this.id =
      options.id ||
      `joint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.particleA = options.particleA;
    this.particleB = options.particleB;
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
   * Joints break when stress exceeds tolerance (1.0 = never break, 0.0 = break easily).
   */
  applyConstraint(): void {
    if (!this.validate()) return;


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
   * Apply joint constraint by adjusting particle positions
   */
  private applyJointConstraint(
    currentDistance: number,
    directionX: number,
    directionY: number
  ): void {
    const displacement = currentDistance - this.restLength;

    // If already at correct distance, do nothing
    if (Math.abs(displacement) < 0.001) return;

    // Calculate correction needed - fully rigid joints
    const correction = displacement * 0.5; // Split correction between both particles

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

    // Joints maintain rigid distance constraints
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
   * Serialize joint to a plain object for storage
   */
  serialize(): {
    id: string;
    particleAId: number;
    particleBId: number;
    restLength: number;
    tolerance: number;
    isBroken: boolean;
  } {
    return {
      id: this.id,
      particleAId: this.particleA.id,
      particleBId: this.particleB.id,
      restLength: this.restLength,
      tolerance: this.tolerance,
      isBroken: this.isBroken,
    };
  }

  /**
   * Create a joint from serialized data and particle references
   */
  static deserialize(
    data: {
      id: string;
      particleAId: number;
      particleBId: number;
      restLength: number;
      tolerance: number;
      isBroken: boolean;
    },
    particleA: Particle,
    particleB: Particle
  ): Joint {
    const joint = new Joint({
      id: data.id,
      particleA,
      particleB,
      restLength: data.restLength,
      tolerance: data.tolerance,
    });

    // Restore broken state
    (joint as any).isBroken = data.isBroken;
    if (data.isBroken) {
      joint.isValid = false;
    }

    return joint;
  }

  /**
   * Create a copy of this joint
   */
  clone(): Joint {
    const clonedJoint = new Joint({
      particleA: this.particleA,
      particleB: this.particleB,
      restLength: this.restLength,
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
 * Joint constraint system for structural mechanics.
 *
 * Manages distance constraints between particles and maintains structural integrity.
 * Provides rigid body services to other modules while keeping structural
 * constraint solving separate from dynamic collision physics.
 *
 * Supports both rigid and elastic joints with configurable stiffness.
 * Joints can break under stress based on configurable tolerance.
 */
export class Joints implements Force, RigidBody {
  public enabled: boolean;
  public joints: Map<string, Joint> = new Map();
  public enableCollisions: boolean;
  private globalTolerance: number = DEFAULT_JOINT_TOLERANCE;

  // Track grabbed particles and their previous positions for velocity calculation
  private grabbedParticlePositions: Map<number, Vector2D> = new Map();

  // Rigid body group caching for performance optimization
  private rigidBodyGroupCache: Map<number, Set<Particle>> = new Map();
  private cacheValidationTime: number = 0;
  private readonly CACHE_INVALIDATION_INTERVAL = 100; // ms

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
    // Use global tolerance if not specified in options
    const jointOptions = {
      ...options,
      tolerance: options.tolerance ?? this.globalTolerance,
    };
    const joint = new Joint(jointOptions);
    this.joints.set(joint.id, joint);

    // Invalidate cache since joint structure changed
    this.invalidateRigidBodyGroupCache();

    return joint;
  }

  /**
   * Remove a joint by ID
   */
  removeJoint(jointId: string): boolean {
    const removed = this.joints.delete(jointId);
    if (removed) {
      // Invalidate cache since joint structure changed
      this.invalidateRigidBodyGroupCache();
    }
    return removed;
  }

  /**
   * Remove a joint by reference
   */
  removeJointByReference(joint: Joint): boolean {
    const removed = this.joints.delete(joint.id);
    if (removed) {
      // Invalidate cache since joint structure changed
      this.invalidateRigidBodyGroupCache();
    }
    return removed;
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

    if (jointsToRemove.length > 0) {
      // Invalidate cache since joint structure changed
      this.invalidateRigidBodyGroupCache();
    }

    return jointsToRemove.length;
  }

  /**
   * Clear all joints
   */
  clear(): void {
    this.joints.clear();
    // Invalidate cache since all joints are cleared
    this.invalidateRigidBodyGroupCache();
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
   * Clear the rigid body group cache (called when joints are modified)
   */
  private invalidateRigidBodyGroupCache(): void {
    this.rigidBodyGroupCache.clear();
    this.cacheValidationTime = Date.now();
  }

  /**
   * Check if the rigid body group cache needs invalidation
   */
  private shouldInvalidateCache(): boolean {
    return (
      Date.now() - this.cacheValidationTime > this.CACHE_INVALIDATION_INTERVAL
    );
  }

  /**
   * Get all particles that form a rigid body group with the given particle.
   * Uses graph traversal to find all transitively connected particles through rigid joints.
   * Results are cached for performance.
   */
  getRigidBodyGroup(
    particle: Particle
  ): Set<Particle> {
    // Check cache invalidation
    if (this.shouldInvalidateCache()) {
      this.invalidateRigidBodyGroupCache();
    }

    // Check cache first
    const cacheKey = particle.id;
    if (this.rigidBodyGroupCache.has(cacheKey)) {
      return this.rigidBodyGroupCache.get(cacheKey)!;
    }

    // Cache miss - compute rigid body group
    const rigidGroup = new Set<Particle>();
    const visited = new Set<number>();
    const queue: Particle[] = [particle];

    while (queue.length > 0) {
      const currentParticle = queue.shift()!;

      if (visited.has(currentParticle.id)) {
        continue;
      }

      visited.add(currentParticle.id);
      rigidGroup.add(currentParticle);

      // Find all rigid joints connected to this particle
      const connectedJoints = this.getJointsForParticle(currentParticle);

      for (const joint of connectedJoints) {
        // Only consider valid joints for rigid body connections
        if (joint.isValid) {
          const otherParticle =
            joint.particleA.id === currentParticle.id
              ? joint.particleB
              : joint.particleA;

          if (!visited.has(otherParticle.id)) {
            queue.push(otherParticle);
          }
        }
      }
    }

    // Cache the result for all particles in this group
    for (const groupParticle of rigidGroup) {
      this.rigidBodyGroupCache.set(groupParticle.id, rigidGroup);
    }

    return rigidGroup;
  }

  /**
   * Check if two particles belong to the same rigid body group
   */
  areInSameRigidBody(
    particle1: Particle,
    particle2: Particle
  ): boolean {
    // Quick check: if particles are directly connected by a joint
    const directJoints = this.getJointsForParticle(particle1);
    for (const joint of directJoints) {
      if (joint.isValid) {
        const otherParticle =
          joint.particleA.id === particle1.id
            ? joint.particleB
            : joint.particleA;
        if (otherParticle.id === particle2.id) {
          return true;
        }
      }
    }

    // If not directly connected, check if they're in the same rigid body group
    const group1 = this.getRigidBodyGroup(particle1);
    return group1.has(particle2);
  }

  /**
   * Get all rigid body groups in the current joint system
   */
  getAllRigidBodyGroups(): Set<Particle>[] {
    const allGroups: Set<Particle>[] = [];
    const processedParticles = new Set<number>();

    // Get all unique particles from joints
    const allParticles = new Set<Particle>();
    for (const joint of this.joints.values()) {
      if (joint.isValid) {
        allParticles.add(joint.particleA);
        allParticles.add(joint.particleB);
      }
    }

    // Find rigid body groups for each unprocessed particle
    for (const particle of allParticles) {
      if (!processedParticles.has(particle.id)) {
        const group = this.getRigidBodyGroup(particle);

        // Mark all particles in this group as processed
        for (const groupParticle of group) {
          processedParticles.add(groupParticle.id);
        }

        // Only add groups with more than one particle (actual rigid bodies)
        if (group.size > 1) {
          allGroups.push(group);
        }
      }
    }

    return allGroups;
  }

  /**
   * Check if two line segments (joints) intersect
   */
  private doJointsIntersect(joint1: Joint, joint2: Joint): boolean {
    // Don't check intersection if joints share a particle
    if (
      joint1.particleA.id === joint2.particleA.id ||
      joint1.particleA.id === joint2.particleB.id ||
      joint1.particleB.id === joint2.particleA.id ||
      joint1.particleB.id === joint2.particleB.id
    ) {
      return false;
    }

    // Check if the two line segments intersect
    return lineSegmentsIntersect(
      joint1.particleA.position,
      joint1.particleB.position,
      joint2.particleA.position,
      joint2.particleB.position
    );
  }

  /**
   * Find all joint crossings in the system using spatial grid optimization
   */
  private findJointCrossings(
    spatialGrid: SpatialGrid
  ): Array<{ joint1: Joint; joint2: Joint }> {
    const crossings: Array<{ joint1: Joint; joint2: Joint }> = [];
    const validJoints = Array.from(this.joints.values()).filter(
      (j) => j.isValid
    );

    // Clear and populate the spatial grid with joints
    spatialGrid.clearJoints();
    for (const joint of validJoints) {
      spatialGrid.insertJoint(joint);
    }

    // Track processed pairs to avoid duplicates
    const processedPairs = new Set<string>();

    // For each joint, only check against nearby joints from spatial grid
    for (const joint1 of validJoints) {
      const nearbyJoints =
        spatialGrid.getNearbyJointsWithBoundingBoxFilter(joint1);

      for (const joint2 of nearbyJoints) {
        // Create a unique pair identifier to avoid duplicate checks
        const pairId =
          joint1.id < joint2.id
            ? `${joint1.id}-${joint2.id}`
            : `${joint2.id}-${joint1.id}`;
        if (processedPairs.has(pairId)) {
          continue;
        }
        processedPairs.add(pairId);

        // Skip if joints are from the same rigid body group
        if (
          this.areInSameRigidBody(joint1.particleA, joint2.particleA) ||
          this.areInSameRigidBody(joint1.particleA, joint2.particleB) ||
          this.areInSameRigidBody(joint1.particleB, joint2.particleA) ||
          this.areInSameRigidBody(joint1.particleB, joint2.particleB)
        ) {
          continue;
        }

        // Cast back to actual Joint type for intersection test
        const actualJoint1 = joint1 as Joint;
        const actualJoint2 = joint2 as Joint;

        if (this.doJointsIntersect(actualJoint1, actualJoint2)) {
          crossings.push({ joint1: actualJoint1, joint2: actualJoint2 });
        }
      }
    }

    return crossings;
  }

  /**
   * Serialize all joints to a plain object array for storage
   */
  serializeJoints(): Array<{
    id: string;
    particleAId: number;
    particleBId: number;
    restLength: number;
    tolerance: number;
    isBroken: boolean;
  }> {
    return Array.from(this.joints.values()).map((joint) => joint.serialize());
  }

  /**
   * Deserialize joints from stored data and restore them using particle references
   */
  deserializeJoints(
    serializedJoints: Array<{
      id: string;
      particleAId: number;
      particleBId: number;
      restLength: number;
      tolerance: number;
      isBroken: boolean;
    }>,
    particles: Particle[]
  ): void {
    // Clear existing joints
    this.joints.clear();

    // Invalidate cache since joint structure is being rebuilt
    this.invalidateRigidBodyGroupCache();

    // Create a particle lookup map for efficient access
    const particleMap = new Map<number, Particle>();
    for (const particle of particles) {
      particleMap.set(particle.id, particle);
    }

    // Recreate joints from serialized data
    for (const jointData of serializedJoints) {
      const particleA = particleMap.get(jointData.particleAId);
      const particleB = particleMap.get(jointData.particleBId);

      // Only recreate joint if both particles exist
      if (particleA && particleB) {
        const joint = Joint.deserialize(jointData, particleA, particleB);
        this.joints.set(joint.id, joint);
      }
    }
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

    // Invalidate cache if any joints were removed
    if (invalidJoints.length > 0) {
      this.invalidateRigidBodyGroupCache();
    }

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
   * Uses exhaustive iterative solving to prevent joint crossings
   */
  constraints(_particles: Particle[], spatialGrid: SpatialGrid): void {
    if (!this.enabled) return;

    // Exhaustive constraint solving with joint crossing resolution
    this.solveConstraintsExhaustively(spatialGrid);
  }

  /**
   * Exhaustively solve all constraints until no violations remain
   * This prevents rigid body penetration by detecting and resolving joint crossings
   */
  private solveConstraintsExhaustively(spatialGrid: SpatialGrid): void {
    const maxIterations = 10; // Maximum iterations to prevent infinite loops
    const maxCrossingResolutionAttempts = 5; // Max attempts to resolve each crossing

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Step 1: Apply standard joint constraints
      let hasConstraintViolations = false;
      for (const joint of this.joints.values()) {
        if (joint.isValid) {
          joint.applyConstraint();
          const finalDistance = joint.getCurrentLength();

          // Check if constraint is still violated
          const displacement = Math.abs(finalDistance - joint.restLength);
          if (displacement > 0.001) {
            hasConstraintViolations = true;
          }
        }
      }

      // Step 2: Check for joint crossings (particles inside other rigid bodies)
      const crossings = this.findJointCrossings(spatialGrid);

      if (crossings.length === 0 && !hasConstraintViolations) {
        // All constraints satisfied and no crossings - we're done!
        break;
      }

      // Step 3: Resolve joint crossings
      if (crossings.length > 0) {
        this.resolveJointCrossings(crossings, maxCrossingResolutionAttempts);
      }

      // If this is the last iteration and we still have violations,
      // apply emergency separation
      if (iteration === maxIterations - 1 && crossings.length > 0) {
        this.applyEmergencySeparation(crossings);
      }
    }
  }

  /**
   * Resolve joint crossings by repositioning rigid body groups
   */
  private resolveJointCrossings(
    crossings: Array<{ joint1: Joint; joint2: Joint }>,
    maxAttempts: number
  ): void {
    for (const crossing of crossings) {
      this.resolveSingleJointCrossing(
        crossing.joint1,
        crossing.joint2,
        maxAttempts
      );
    }
  }

  /**
   * Resolve a single joint crossing using impulse-based collision response (like particle-joint)
   */
  private resolveSingleJointCrossing(
    joint1: Joint,
    joint2: Joint,
    maxAttempts: number
  ): void {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!this.doJointsIntersect(joint1, joint2)) {
        // Crossing resolved
        break;
      }

      // Apply impulse-based collision response between the two joints
      this.resolveJointJointCollision(joint1, joint2);
    }
  }

  /**
   * Resolve joint-joint collision using impulse-based response (modeled after particle-joint)
   */
  private resolveJointJointCollision(joint1: Joint, joint2: Joint): void {
    // Calculate midpoints of both joints
    const midpoint1 = new Vector2D(
      (joint1.particleA.position.x + joint1.particleB.position.x) / 2,
      (joint1.particleA.position.y + joint1.particleB.position.y) / 2
    );
    const midpoint2 = new Vector2D(
      (joint2.particleA.position.x + joint2.particleB.position.x) / 2,
      (joint2.particleA.position.y + joint2.particleB.position.y) / 2
    );

    // Calculate collision normal (from joint2 to joint1)
    let collisionNormal = midpoint1.clone().subtract(midpoint2);

    if (collisionNormal.magnitude() < 0.001) {
      // If midpoints are too close, use random separation direction
      const angle = Math.random() * Math.PI * 2;
      collisionNormal = new Vector2D(Math.cos(angle), Math.sin(angle));
    } else {
      collisionNormal.normalize();
    }

    // Get rigid body groups
    const group1 = this.getRigidBodyGroup(joint1.particleA);
    const group2 = this.getRigidBodyGroup(joint2.particleA);

    // Calculate group masses and velocities
    const mass1 = this.calculateGroupMass(group1);
    const mass2 = this.calculateGroupMass(group2);
    const totalMass = Math.max(mass1 + mass2, MIN_COLLISION_MASS * 2);

    // Calculate average velocities of both groups
    const velocity1 = this.calculateGroupVelocity(group1);
    const velocity2 = this.calculateGroupVelocity(group2);

    // Calculate relative velocity in collision normal direction
    const relativeVelocity = velocity1
      .clone()
      .subtract(velocity2)
      .dot(collisionNormal);

    // Don't resolve if groups are separating
    if (relativeVelocity > 0) return;

    // Calculate collision impulse (same formula as particle-joint)
    const impulse =
      (-(1 + JOINT_RESTITUTION) * relativeVelocity * mass1 * mass2) / totalMass;

    // Apply impulse to both groups through velocity changes
    const impulse1 = collisionNormal.clone().multiply(impulse / mass1);
    const impulse2 = collisionNormal.clone().multiply(-impulse / mass2);

    // Apply velocity changes to all particles in both groups
    this.applyVelocityToGroup(group1, impulse1);
    this.applyVelocityToGroup(group2, impulse2);

    // Emergency position separation if still intersecting
    if (this.doJointsIntersect(joint1, joint2)) {
      const minSeparation = (joint1.restLength + joint2.restLength) * 0.1;
      const separation1 = collisionNormal
        .clone()
        .multiply(minSeparation * (mass2 / totalMass));
      const separation2 = collisionNormal
        .clone()
        .multiply(-minSeparation * (mass1 / totalMass));

      this.moveRigidBodyGroup(group1, separation1);
      this.moveRigidBodyGroup(group2, separation2);
    }
  }

  /**
   * Calculate total mass of a rigid body group using clamped masses for stability
   */
  private calculateGroupMass(group: Set<Particle>): number {
    let totalMass = 0;
    for (const particle of group) {
      totalMass += clampMassForCollision(particle.mass);
    }
    return totalMass > 0 ? totalMass : MIN_COLLISION_MASS; // Ensure minimum mass
  }

  /**
   * Calculate average velocity of a rigid body group
   */
  private calculateGroupVelocity(group: Set<Particle>): Vector2D {
    if (group.size === 0) return new Vector2D(0, 0);

    let totalVelocity = new Vector2D(0, 0);
    let totalMass = 0;

    for (const particle of group) {
      const mass = clampMassForCollision(particle.mass);
      totalVelocity.add(particle.velocity.clone().multiply(mass));
      totalMass += mass;
    }

    return totalMass > 0 ? totalVelocity.divide(totalMass) : new Vector2D(0, 0);
  }

  /**
   * Apply velocity change to all particles in a rigid body group
   */
  private applyVelocityToGroup(
    group: Set<Particle>,
    velocityChange: Vector2D
  ): void {
    for (const particle of group) {
      if (!particle.pinned && !particle.grabbed) {
        particle.velocity.add(velocityChange);
      }
    }
  }

  /**
   * Move an entire rigid body group by a displacement vector with clamped maximum change
   */
  private moveRigidBodyGroup(
    group: Set<Particle>,
    displacement: Vector2D
  ): void {
    // Clamp displacement magnitude to prevent violent movements (emergency only)
    const displacementMagnitude = displacement.magnitude();
    if (displacementMagnitude > MAX_POSITION_CHANGE_PER_FRAME) {
      displacement.normalize().multiply(MAX_POSITION_CHANGE_PER_FRAME);
    }

    for (const particle of group) {
      if (!particle.pinned && !particle.grabbed) {
        particle.position.add(displacement);
      }
    }
  }

  /**
   * Apply emergency separation when normal resolution fails
   */
  private applyEmergencySeparation(
    crossings: Array<{ joint1: Joint; joint2: Joint }>
  ): void {
    // Identify all rigid body groups involved in crossings
    const involvedGroups = new Set<Set<Particle>>();

    for (const crossing of crossings) {
      involvedGroups.add(this.getRigidBodyGroup(crossing.joint1.particleA));
      involvedGroups.add(this.getRigidBodyGroup(crossing.joint2.particleA));
    }

    // Apply strong separation forces between all involved groups
    const groupArray = Array.from(involvedGroups);
    for (let i = 0; i < groupArray.length; i++) {
      for (let j = i + 1; j < groupArray.length; j++) {
        this.separateRigidBodyGroups(groupArray[i], groupArray[j], 2.0); // Strong separation
      }
    }
  }

  /**
   * Separate two rigid body groups by a specified strength
   */
  private separateRigidBodyGroups(
    group1: Set<Particle>,
    group2: Set<Particle>,
    strength: number
  ): void {
    // Calculate centroids of both groups
    const centroid1 = this.calculateGroupCentroid(group1);
    const centroid2 = this.calculateGroupCentroid(group2);

    let separationVector = centroid1.clone().subtract(centroid2);

    if (separationVector.magnitude() < 0.001) {
      // If centroids are too close, use random direction
      const angle = Math.random() * Math.PI * 2;
      separationVector = new Vector2D(Math.cos(angle), Math.sin(angle));
    } else {
      separationVector.normalize();
    }

    // Calculate masses with minimum total mass to prevent extreme ratios
    const mass1 = this.calculateGroupMass(group1);
    const mass2 = this.calculateGroupMass(group2);
    const totalMass = Math.max(mass1 + mass2, MIN_COLLISION_MASS * 2);

    // Apply separation
    const separation1 = separationVector
      .clone()
      .multiply(strength * (mass2 / totalMass));
    const separation2 = separationVector
      .clone()
      .multiply(-strength * (mass1 / totalMass));

    this.moveRigidBodyGroup(group1, separation1);
    this.moveRigidBodyGroup(group2, separation2);
  }

  /**
   * Calculate the centroid (center of mass) of a rigid body group
   */
  private calculateGroupCentroid(group: Set<Particle>): Vector2D {
    return calculateCentroid(group);
  }

  /**
   * RigidBody interface implementation
   * Check if a particle has any rigid body connections
   */
  hasRigidBodyConnections(particleId: number): boolean {
    return this.hasJoint(particleId);
  }
}
