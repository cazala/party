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
  
  // Track grabbed particles and their previous positions for velocity calculation
  private grabbedParticlePositions: Map<number, Vector2D> = new Map();

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
   * Force interface: apply joint collisions using spatial grid
   */
  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    // Joint collisions are now handled globally in checkAllJointCollisions() for better performance
    // This method is kept for interface compatibility but does nothing
  }

  /**
   * Force interface: apply constraints to all joints (called once per frame)
   */
  warmup(particles: Particle[], _deltaTime: number): void {
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
      const particle = particles.find(p => p.id === particleId);
      if (!particle || !particle.grabbed) {
        this.grabbedParticlePositions.delete(particleId);
      }
    }

    // Joint constraints are applied AFTER physics integration
    // to avoid interfering with natural motion from forces like gravity
  }

  /**
   * Apply all joint constraints - should be called AFTER physics integration
   */
  applyConstraints(spatialGrid?: SpatialGrid): void {
    if (!this.enabled) return;

    // Apply all joint constraints
    for (const joint of this.joints.values()) {
      joint.applyConstraint();
    }

    // After applying constraints, check if any particles have been moved into collision with joints
    // and apply corrective forces if needed
    if (spatialGrid) {
      this.resolveConstraintCollisionConflicts(spatialGrid);
    }
  }

  /**
   * Check if joint constraints have moved particles into collision with other joints
   * and apply corrective measures
   */
  private resolveConstraintCollisionConflicts(_spatialGrid: SpatialGrid): void {

    // Check each joint-connected particle for collisions with other joints
    for (const joint of this.joints.values()) {
      [joint.particleA, joint.particleB].forEach(particle => {
        if (particle.static) return;
        
        // Check this particle against all other joints
        for (const otherJoint of this.joints.values()) {
          if (otherJoint.id === joint.id) continue;
          if (this.isParticleInvolvedInJoint(particle, otherJoint)) continue;
          
          // Check if particle is now colliding with this other joint
          if (this.checkCollision(particle, otherJoint)) {
            const closestPoint = this.getClosestPointOnLineSegment(
              particle.position,
              otherJoint.particleA.position,
              otherJoint.particleB.position
            );
            
            // Apply position correction only (no velocity change since constraint system handles that)
            const collisionNormal = particle.position.clone().subtract(closestPoint);
            if (collisionNormal.magnitude() === 0) {
              const lineVector = otherJoint.particleB.position.clone().subtract(otherJoint.particleA.position);
              collisionNormal.x = -lineVector.y;
              collisionNormal.y = lineVector.x;
            }
            collisionNormal.normalize();
            
            const overlap = particle.size - particle.position.distance(closestPoint);
            if (overlap > 0) {
              const correction = collisionNormal.clone().multiply(overlap + 0.1); // Small buffer
              particle.position.add(correction);
            }
          }
        }
      });
    }
  }

  /**
   * Check joint collisions using spatial grid optimization
   * This method should be called during the force application phase
   */
  checkAllJointCollisions(spatialGrid: SpatialGrid): void {
    if (!this.enabled) return;

    // For each joint, find nearby particles and check collisions
    for (const joint of this.joints.values()) {
      this.checkJointCollisions(joint, spatialGrid);
    }
  }


  /**
   * Collision detection for a single joint using spatial grid
   */
  private checkJointCollisions(joint: Joint, spatialGrid: SpatialGrid): void {
    // Calculate joint bounding circle for spatial grid lookup
    const boundingCircle = this.getJointBoundingCircle(joint);
    
    // Get nearby particles using spatial grid
    const nearbyParticles = spatialGrid.getParticles(
      boundingCircle.center,
      boundingCircle.radius
    );

    // Check collision with each nearby particle
    for (const particle of nearbyParticles) {
      // Skip particles that are part of this joint
      if (this.isParticleInvolvedInJoint(particle, joint)) continue;

      // Check collision
      if (this.checkCollision(particle, joint)) {
        // Get the closest point on the joint line segment to the particle
        const closestPoint = this.getClosestPointOnLineSegment(
          particle.position,
          joint.particleA.position,
          joint.particleB.position
        );
        
        if (particle.grabbed) {
          // Grabbed particles push joints out of the way
          this.handleGrabbedParticleCollision(particle, closestPoint, joint);
        } else if (particle.static) {
          // Static particles block joints - joint particles bounce off
          this.handleStaticParticleCollision(particle, closestPoint, joint);
        } else {
          // Regular particles bounce off joints
          this.handleJointCollision(particle, closestPoint, joint);
        }
      }
    }
  }

  /**
   * Find the closest point on a line segment to a given point
   */
  private getClosestPointOnLineSegment(
    point: Vector2D,
    lineStart: Vector2D,
    lineEnd: Vector2D
  ): Vector2D {
    // Vector from line start to line end
    const lineVector = lineEnd.clone().subtract(lineStart);
    
    // Vector from line start to point
    const pointVector = point.clone().subtract(lineStart);
    
    // Project point onto line (parameterized as t)
    const lineLength = lineVector.magnitude();
    
    if (lineLength === 0) {
      // Line has zero length, return the start point
      return lineStart.clone();
    }
    
    const t = pointVector.dot(lineVector) / (lineLength * lineLength);
    
    // Clamp t to [0, 1] to stay within line segment bounds
    const clampedT = Math.max(0, Math.min(1, t));
    
    // Calculate the closest point
    return lineStart.clone().add(lineVector.multiply(clampedT));
  }

  /**
   * Handle collision where grabbed particle pushes joint particles away
   */
  private handleGrabbedParticleCollision(
    grabbedParticle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Calculate how much the grabbed particle overlaps with the joint
    const overlap = grabbedParticle.size - grabbedParticle.position.distance(closestPoint);
    if (overlap <= 0) return;

    // Calculate collision normal (from joint line to grabbed particle center)
    const collisionNormal = grabbedParticle.position.clone().subtract(closestPoint);
    if (collisionNormal.magnitude() === 0) {
      // Particle is exactly on the line - use perpendicular to line as normal
      const lineVector = joint.particleB.position.clone().subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    collisionNormal.normalize();

    // Calculate impact weights based on where along the joint the collision occurred
    const weights = this.calculateImpactWeights(closestPoint, joint);
    
    // Push joint particles away from the grabbed particle
    const pushStrength = overlap * 0.5; // How much to push each joint particle
    
    if (!joint.particleA.static && weights.weightA > 0) {
      // Push particle A away
      const pushForce = collisionNormal.clone().multiply(-pushStrength * weights.weightA);
      joint.particleA.position.add(pushForce);
      
      // Also apply velocity to make the push feel natural
      const pushVelocity = collisionNormal.clone().multiply(-pushStrength * weights.weightA * 10);
      joint.particleA.velocity.add(pushVelocity);
    }
    
    if (!joint.particleB.static && weights.weightB > 0) {
      // Push particle B away
      const pushForce = collisionNormal.clone().multiply(-pushStrength * weights.weightB);
      joint.particleB.position.add(pushForce);
      
      // Also apply velocity to make the push feel natural
      const pushVelocity = collisionNormal.clone().multiply(-pushStrength * weights.weightB * 10);
      joint.particleB.velocity.add(pushVelocity);
    }
  }

  /**
   * Handle collision where joint hits a static particle - joint particles bounce off
   */
  private handleStaticParticleCollision(
    staticParticle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Calculate how much the joint overlaps with the static particle
    const overlap = staticParticle.size - staticParticle.position.distance(closestPoint);
    if (overlap <= 0) return;

    // Calculate collision normal (from static particle center to joint line)
    const collisionNormal = closestPoint.clone().subtract(staticParticle.position);
    if (collisionNormal.magnitude() === 0) {
      // Joint line passes through particle center - use perpendicular to line as normal
      const lineVector = joint.particleB.position.clone().subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    collisionNormal.normalize();

    // Calculate impact weights based on where along the joint the collision occurred
    const weights = this.calculateImpactWeights(closestPoint, joint);
    
    // Apply repulsive forces to joint particles (they bounce off the static particle)
    const restitution = 0.95; // Same as other collisions
    const repulsionStrength = overlap * 2; // How strongly to push joint particles away
    
    if (!joint.particleA.static && weights.weightA > 0) {
      // Push particle A away from static particle
      const repulsionForce = collisionNormal.clone().multiply(repulsionStrength * weights.weightA);
      joint.particleA.position.add(repulsionForce);
      
      // Apply collision velocity response
      const velocityChange = collisionNormal.clone().multiply(repulsionStrength * weights.weightA * restitution);
      joint.particleA.velocity.add(velocityChange);
    }
    
    if (!joint.particleB.static && weights.weightB > 0) {
      // Push particle B away from static particle
      const repulsionForce = collisionNormal.clone().multiply(repulsionStrength * weights.weightB);
      joint.particleB.position.add(repulsionForce);
      
      // Apply collision velocity response
      const velocityChange = collisionNormal.clone().multiply(repulsionStrength * weights.weightB * restitution);
      joint.particleB.velocity.add(velocityChange);
    }
  }

  /**
   * Handle collision between particle and joint line segment with force transfer
   */
  private handleJointCollision(
    particle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Skip collision if any joint particle is static (immovable joints shouldn't transfer force)
    if (joint.particleA.static && joint.particleB.static) {
      // Handle collision with static joint (only bounce the hitting particle)
      this.handleStaticJointCollision(particle, closestPoint, joint);
      return;
    }

    // Calculate collision normal (from joint line to particle center)
    const collisionNormal = particle.position.clone().subtract(closestPoint);
    
    if (collisionNormal.magnitude() === 0) {
      // Particle is exactly on the line - use perpendicular to line as normal
      const lineVector = joint.particleB.position.clone().subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    
    collisionNormal.normalize();

    // Calculate impact point weights based on distance along joint
    const weights = this.calculateImpactWeights(closestPoint, joint);
    
    // Calculate effective mass of joint system at impact point
    const effectiveJointMass = this.calculateEffectiveJointMass(joint, weights);
    
    // Apply collision response with restitution and mass transfer
    const restitution = 0.95;
    
    // Calculate relative velocity in collision normal direction
    const relativeVelocity = particle.velocity.dot(collisionNormal);
    
    // Don't resolve if velocities are separating
    if (relativeVelocity > 0) return;
    
    // Calculate collision impulse considering both particle and joint masses
    const totalMass = particle.mass + effectiveJointMass;
    const impulse = -(1 + restitution) * relativeVelocity * particle.mass * effectiveJointMass / totalMass;
    
    // Apply impulse to hitting particle (reduced by mass ratio)
    const particleImpulse = collisionNormal.clone().multiply(impulse / particle.mass);
    particle.velocity.add(particleImpulse);
    
    // Transfer force to joint particles based on impact location and masses
    this.transferForceToJoint(joint, weights, collisionNormal, impulse);

    // Position correction to prevent particle from staying inside the joint
    const overlap = particle.size - particle.position.distance(closestPoint);
    if (overlap > 0) {
      const correction = collisionNormal.clone().multiply(overlap);
      particle.position.add(correction);
    }
  }

  /**
   * Handle collision with static joint (original behavior)
   */
  private handleStaticJointCollision(
    particle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Calculate collision normal (from joint line to particle center)
    const collisionNormal = particle.position.clone().subtract(closestPoint);
    
    if (collisionNormal.magnitude() === 0) {
      // Particle is exactly on the line - use perpendicular to line as normal
      const lineVector = joint.particleB.position.clone().subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    
    collisionNormal.normalize();

    // Apply collision response with restitution (same as particle-particle collisions)
    const restitution = 0.95;
    
    // Calculate relative velocity in collision normal direction
    const relativeVelocity = particle.velocity.dot(collisionNormal);
    
    // Don't resolve if velocities are separating
    if (relativeVelocity > 0) return;
    
    // Calculate collision impulse
    const impulse = -(1 + restitution) * relativeVelocity;
    
    // Apply impulse to particle velocity
    const impulseVector = collisionNormal.clone().multiply(impulse);
    particle.velocity.add(impulseVector);

    // Position correction to prevent particle from staying inside the joint
    const overlap = particle.size - particle.position.distance(closestPoint);
    if (overlap > 0) {
      const correction = collisionNormal.clone().multiply(overlap);
      particle.position.add(correction);
    }
  }

  /**
   * Calculate bounding circle for a joint (center + radius for spatial grid lookup)
   */
  private getJointBoundingCircle(joint: Joint): { center: Vector2D; radius: number } {
    // Joint center is midpoint between the two particles
    const center = new Vector2D(
      (joint.particleA.position.x + joint.particleB.position.x) / 2,
      (joint.particleA.position.y + joint.particleB.position.y) / 2
    );

    // Joint radius is half the joint length plus maximum possible particle size
    const jointLength = joint.particleA.position.distance(joint.particleB.position);
    const maxParticleSize = Math.max(joint.particleA.size, joint.particleB.size);
    
    // Add some padding for particle sizes that might collide with the joint
    // Use a reasonable estimate for maximum particle size (can be made configurable)
    const estimatedMaxParticleSize = maxParticleSize * 2; // Conservative estimate
    const radius = jointLength / 2 + estimatedMaxParticleSize;

    return { center, radius };
  }

  /**
   * Check if a particle is involved in a joint (can't collide with your own joints)
   */
  private isParticleInvolvedInJoint(particle: Particle, joint: Joint): boolean {
    return joint.particleA.id === particle.id || joint.particleB.id === particle.id;
  }


  /**
   * Get effective velocity for a grabbed particle by calculating its movement
   */
  private getEffectiveVelocity(particle: Particle): Vector2D {
    const previousPos = this.grabbedParticlePositions.get(particle.id);
    
    if (!previousPos) {
      // First time seeing this particle, store its position and return zero velocity
      this.grabbedParticlePositions.set(particle.id, particle.position.clone());
      return new Vector2D(0, 0);
    }
    
    // Calculate velocity based on position change
    const deltaTime = 1/60; // Assume 60 FPS
    const movement = particle.position.clone().subtract(previousPos);
    const effectiveVelocity = movement.divide(deltaTime);
    
    // Update stored position for next frame
    this.grabbedParticlePositions.set(particle.id, particle.position.clone());
    
    return effectiveVelocity;
  }


  /**
   * Calculate impact weights based on where along the joint the collision occurred
   */
  private calculateImpactWeights(
    impactPoint: Vector2D,
    joint: Joint
  ): { weightA: number; weightB: number } {
    const jointVector = joint.particleB.position.clone().subtract(joint.particleA.position);
    const impactVector = impactPoint.clone().subtract(joint.particleA.position);
    
    const jointLength = jointVector.magnitude();
    
    if (jointLength === 0) {
      // Zero-length joint, split force equally
      return { weightA: 0.5, weightB: 0.5 };
    }
    
    // Project impact point onto joint line to get position parameter t [0,1]
    const t = impactVector.dot(jointVector) / (jointLength * jointLength);
    const clampedT = Math.max(0, Math.min(1, t));
    
    // Weight inversely proportional to distance from joint particles
    // Impact closer to particleA gives more force to particleA
    const weightB = clampedT;
    const weightA = 1 - clampedT;
    
    return { weightA, weightB };
  }

  /**
   * Calculate effective mass of joint system at impact point
   */
  private calculateEffectiveJointMass(
    joint: Joint,
    weights: { weightA: number; weightB: number }
  ): number {
    let effectiveMass = 0;
    
    // Add mass contribution from each joint particle based on impact weights
    if (!joint.particleA.static) {
      effectiveMass += joint.particleA.mass * weights.weightA;
    }
    
    if (!joint.particleB.static) {
      effectiveMass += joint.particleB.mass * weights.weightB;
    }
    
    return effectiveMass;
  }

  /**
   * Transfer force to joint particles based on impact location and masses
   */
  private transferForceToJoint(
    joint: Joint,
    weights: { weightA: number; weightB: number },
    collisionNormal: Vector2D,
    totalImpulse: number
  ): void {
    // Transfer force to particleA (force opposite to collision normal)
    if (!joint.particleA.static && weights.weightA > 0) {
      const forceA = collisionNormal.clone().multiply(-totalImpulse * weights.weightA / joint.particleA.mass);
      joint.particleA.velocity.add(forceA);
    }
    
    // Transfer force to particleB (force opposite to collision normal)
    if (!joint.particleB.static && weights.weightB > 0) {
      const forceB = collisionNormal.clone().multiply(-totalImpulse * weights.weightB / joint.particleB.mass);
      joint.particleB.velocity.add(forceB);
    }
  }

  /**
   * Collision detection that checks both current position and trajectory
   * This prevents most tunneling without complex geometric calculations
   */
  private checkCollision(particle: Particle, joint: Joint): boolean {
    const radius = particle.size;
    
    // Check 1: Current position (original method)
    const currentClosestPoint = this.getClosestPointOnLineSegment(
      particle.position,
      joint.particleA.position,
      joint.particleB.position
    );
    const currentDistance = particle.position.distance(currentClosestPoint);
    
    if (currentDistance < radius && currentDistance > 0.001) {
      return true;
    }
    
    // Check 2: Relative motion check - consider both particle and joint movement
    const deltaTime = 1/60; // Assume 60 FPS for trajectory prediction
    
    // Get effective velocity (calculate movement for grabbed particles)
    const effectiveParticleVelocity = particle.grabbed 
      ? this.getEffectiveVelocity(particle)
      : particle.velocity;
    
    // Calculate relative velocities
    const particleSpeed = effectiveParticleVelocity.magnitude();
    const jointASpeed = joint.particleA.velocity.magnitude();
    const jointBSpeed = joint.particleB.velocity.magnitude();
    const maxJointSpeed = Math.max(jointASpeed, jointBSpeed);
    const relativeSpeed = particleSpeed + maxJointSpeed;
    
    // Check trajectory if there's any relative motion
    if (relativeSpeed > 0.1) { // Lower threshold to catch slow relative motion
      const steps = Math.min(5, Math.max(2, Math.ceil(relativeSpeed / radius)));
      
      for (let i = 1; i <= steps; i++) {
        const t = (i / steps) * deltaTime;
        
        // Future particle position
        const futureParticlePos = particle.position.clone().add(
          effectiveParticleVelocity.clone().multiply(t)
        );
        
        // Future joint positions
        const futureJointAPos = joint.particleA.position.clone().add(
          joint.particleA.velocity.clone().multiply(t)
        );
        const futureJointBPos = joint.particleB.position.clone().add(
          joint.particleB.velocity.clone().multiply(t)
        );
        
        const checkClosestPoint = this.getClosestPointOnLineSegment(
          futureParticlePos,
          futureJointAPos,
          futureJointBPos
        );
        const checkDistance = futureParticlePos.distance(checkClosestPoint);
        
        if (checkDistance < radius && checkDistance > 0.001) {
          return true;
        }
      }
    }
    
    return false;
  }

}
