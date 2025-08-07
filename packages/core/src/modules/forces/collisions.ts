import { Particle } from "../particle";
import { Force } from "../system";
import { Vector2D } from "../vector";
import { SpatialGrid } from "../spatial-grid";
import mitt, { Emitter } from "mitt";
import { Joints, Joint } from "./joints";
import { Physics } from "./physics";
import {
  getClosestPointOnLineSegment,
  checkLineSegmentIntersection
} from "../geometry";
import { RigidBody } from "../rigid-body";

// Default constants for Collisions
export const DEFAULT_COLLISIONS_ENABLED = true;
export const DEFAULT_COLLISIONS_EAT = false;
export const DEFAULT_COLLISIONS_RESTITUTION = 0.95;
export const DEFAULT_MOMENTUM_PRESERVATION = 0.7;

export type CollisionsEvents = {
  collision: { particle1: Particle; particle2: Particle; enabled: boolean };
};

export interface CollisionsOptions {
  enabled?: boolean;
  eat?: boolean;
  restitution?: number;
  joints?: Joints;
  momentum?: number;
  physics?: Physics;
}

export class Collisions implements Force, RigidBody {
  public enabled: boolean;
  public eat: boolean;
  public restitution: number;
  public momentum: number; // Momentum preservation for joint particles
  public events: Emitter<CollisionsEvents>; // For emitting collision events
  private joints?: Joints; // Optional joints module for joint-particle collisions
  private positions: Map<number, Vector2D> = new Map();
  private physics?: Physics; // Reference to physics module for friction

  constructor(options: CollisionsOptions = {}) {
    this.enabled = options.enabled ?? DEFAULT_COLLISIONS_ENABLED;
    this.eat = options.eat ?? DEFAULT_COLLISIONS_EAT;
    this.restitution = options.restitution ?? DEFAULT_COLLISIONS_RESTITUTION;
    this.momentum = options.momentum ?? DEFAULT_MOMENTUM_PRESERVATION;
    this.joints = options.joints;
    this.physics = options.physics;
    this.events = mitt<CollisionsEvents>();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setEat(eat: boolean): void {
    this.eat = eat;
  }

  setRestitution(restitution: number): void {
    this.restitution = restitution;
  }

  setMomentum(momentum: number): void {
    this.momentum = Math.max(0, Math.min(1, momentum)); // Clamp between 0 and 1
  }

  setPhysics(physics: Physics): void {
    this.physics = physics;
  }

  before(particles: Particle[], deltaTime: number): void {
    if (!this.joints || deltaTime <= 0) return;
    // Store positions before physics integration for velocity correction
    for (const particle of particles) {
      this.positions.set(particle.id, particle.position.clone());
    }
  }

  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    // Check particle-particle collisions (only if particle collisions are enabled)
    if (this.enabled) {
      const neighbors = spatialGrid.getParticles(
        particle.position,
        particle.size * 2
      );

      for (const other of neighbors) {
        if (other === particle) continue;
        this.checkCollision(particle, other);
      }
    }

    // Check particle-joint collisions if joints module is available (independent of particle collisions)
    if (this.joints && this.joints.enabled && this.joints.enableCollisions) {
      this.checkParticleJointCollisions(particle, spatialGrid);
    }
  }

  after(
    particles: Particle[],
    deltaTime: number,
    _spatialGrid: SpatialGrid
  ): void {
    if (!this.joints || deltaTime <= 0) return;
    this.applyMomentumPreservation(particles, deltaTime, this.positions);
  }

  /**
   * Apply momentum preservation to joint particles
   * Called by System after physics integration with prePhysicsPositions
   */
  applyMomentumPreservation(
    particles: Particle[],
    deltaTime: number,
    prePhysicsPositions: Map<number, Vector2D>
  ): void {
    if (
      !this.joints ||
      deltaTime <= 0 ||
      this.joints.getGlobalStiffness() === 0
    )
      return;

    // Track which particles have already been processed as part of rigid body groups

    // Update velocities for constrained particles to match actual movement
    for (const particle of particles) {
      if (!particle.pinned && this.joints?.hasJoint(particle.id)) {
        const prePhysicsPosition = prePhysicsPositions.get(particle.id);
        if (prePhysicsPosition) {
          const totalMovement = particle.position
            .clone()
            .subtract(prePhysicsPosition);
          const actualVelocity = totalMovement.divide(deltaTime);

          particle.velocity = particle.velocity
            .clone()
            .multiply(1 - this.momentum)
            .add(actualVelocity.multiply(this.momentum));
        }
      }
    }
  }

  private checkCollision(particle1: Particle, particle2: Particle): void {
    const distance = particle1.position.distance(particle2.position);
    const combinedRadius = particle1.size + particle2.size; // Sum of both radii (size IS radius)

    // Check if particles are colliding (overlapping)
    if (distance >= combinedRadius) {
      return;
    }

    // Skip collision if particles are part of the same rigid body group
    if (this.joints?.areInSameRigidBody(particle1, particle2)) {
      return;
    }

    this.events.emit("collision", {
      particle1,
      particle2,
      enabled: this.enabled,
    });

    if (!this.enabled) {
      return;
    }

    // Handle grabbed particles specially - they push others out of the way
    if (particle1.grabbed && !particle2.grabbed) {
      this.handleGrabbedParticleCollision(
        particle1,
        particle2,
        distance,
        combinedRadius
      );
      return;
    } else if (particle2.grabbed && !particle1.grabbed) {
      this.handleGrabbedParticleCollision(
        particle2,
        particle1,
        distance,
        combinedRadius
      );
      return;
    } else if (particle1.grabbed && particle2.grabbed) {
      // Both grabbed - no collision response needed
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
      if (particle1.pinned && particle2.pinned) {
        // Both particles are pinned - don't move either of them
        // Skip separation to prevent erratic movement
        return; // No force needed and no position correction
      } else if (particle1.pinned) {
        const separationDistance = combinedRadius * 1.01; // Slightly more than touching
        particle2.position.set(
          particle2.position.x + collisionVector.x * separationDistance,
          particle2.position.y + collisionVector.y * separationDistance
        );
      } else if (particle2.pinned) {
        const separationDistance = combinedRadius * 1.01; // Slightly more than touching
        particle1.position.set(
          particle1.position.x + collisionVector.x * separationDistance,
          particle1.position.y + collisionVector.y * separationDistance
        );
      } else {
        const separationDistance = combinedRadius * 0.51; // Slightly more than touching
        particle1.position.set(
          particle1.position.x + collisionVector.x * separationDistance,
          particle1.position.y + collisionVector.y * separationDistance
        );
        particle2.position.set(
          particle2.position.x - collisionVector.x * separationDistance,
          particle2.position.y - collisionVector.y * separationDistance
        );
      }
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

      if (particle1.pinned && particle2.pinned) {
        // Both particles are pinned - don't perturb either position
        // Skip perturbation to prevent erratic movement
      } else if (particle1.pinned) {
        particle2.position.add(new Vector2D(perturbX, perturbY));
      } else if (particle2.pinned) {
        particle1.position.add(new Vector2D(-perturbX, -perturbY));
      } else {
        particle1.position.add(new Vector2D(perturbX, perturbY));
        particle2.position.add(new Vector2D(-perturbX, -perturbY));
      }
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

      if (particle1.pinned && particle2.pinned) {
        // Both particles are pinned - don't move either of them
        // Skip position correction to prevent erratic movement
      } else if (particle1.pinned) {
        const correction = collisionVector.clone().multiply(overlap); // Use actual overlap distance, not particle size
        particle2.position.add(correction);
      } else if (particle2.pinned) {
        const correction = collisionVector.clone().multiply(overlap); // Use actual overlap distance, not particle size
        particle1.position.add(correction);
      } else {
        const correction1 = collisionVector
          .clone()
          .multiply(separationPerMass * particle2.mass); // particle1 moves opposite of particle2 mass
        const correction2 = collisionVector
          .clone()
          .multiply(separationPerMass * particle1.mass); // particle2 moves opposite of particle1 mass

        particle1.position.add(correction1);
        particle2.position.subtract(correction2);
      }

      // ---- Eating logic ----
      if (this.eat && !particle1.pinned && !particle2.pinned) {
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
      if (particle1.pinned) {
        const newDirection = particle1.position
          .clone()
          .subtract(particle2.position)
          .normalize();
        const speed = particle2.velocity.magnitude();
        const newVelocity = newDirection.multiply(speed * -1);
        particle2.velocity.set(newVelocity.x, newVelocity.y);
      } else if (particle2.pinned) {
        const newDirection = particle2.position
          .clone()
          .subtract(particle1.position)
          .normalize();
        const speed = particle1.velocity.magnitude();
        const newVelocity = newDirection.multiply(speed * -1);
        particle1.velocity.set(newVelocity.x, newVelocity.y);
      } else {
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
        const e = this.restitution; // coefficient of restitution (damping)

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
    }

    // Forces are applied directly to particle velocities above
    return;
  }

  /**
   * Handle collision where grabbed particle pushes regular particle away
   */
  private handleGrabbedParticleCollision(
    grabbedParticle: Particle,
    regularParticle: Particle,
    distance: number,
    combinedRadius: number
  ): void {
    // Calculate collision vector (from grabbed particle to regular particle)
    const collisionVector = regularParticle.position
      .clone()
      .subtract(grabbedParticle.position);

    // Prevent division by zero
    if (distance === 0) {
      // Particles are at exact same position - separate them with random direction
      const angle = Math.random() * Math.PI * 2;
      collisionVector.set(Math.cos(angle), Math.sin(angle));
    } else {
      collisionVector.normalize();
    }

    // Calculate overlap
    const overlap = combinedRadius - distance;

    if (overlap > 0) {
      // Push the regular particle out of the way
      const pushDistance = overlap + 1; // Small buffer to prevent re-collision
      const pushForce = collisionVector.clone().multiply(pushDistance);
      regularParticle.position.add(pushForce);

      // Apply velocity to the pushed particle to make it feel natural
      const pushVelocity = collisionVector.clone().multiply(pushDistance * 5);
      regularParticle.velocity.add(pushVelocity);
    }
  }

  /**
   * Check collisions between a particle and all nearby joints
   */
  private checkParticleJointCollisions(
    particle: Particle,
    _spatialGrid: SpatialGrid
  ): void {
    if (!this.joints) return;

    for (const joint of this.joints.getAllJoints()) {
      // Skip particles that are part of this joint
      if (this.isParticleInvolvedInJoint(particle, joint)) continue;

      // Check collision with joint
      if (this.checkParticleJointCollision(particle, joint)) {
        // Get the closest point on the joint line segment to the particle
        const closestPoint = getClosestPointOnLineSegment(
          particle.position,
          joint.particleA.position,
          joint.particleB.position
        );

        if (particle.grabbed) {
          // Grabbed particles push joints out of the way
          this.handleGrabbedParticleJointCollision(
            particle,
            closestPoint,
            joint
          );
        } else if (particle.pinned) {
          // Static particles block joints - joint particles bounce off
          this.handleStaticParticleJointCollision(
            particle,
            closestPoint,
            joint
          );
        } else {
          // Regular particles bounce off joints
          this.handleParticleJointCollision(particle, closestPoint, joint);
        }
      }
    }
  }

  /**
   * Check if a particle is involved in a joint or part of the same rigid body group
   * (particles from the same rigid body group shouldn't collide with each other's joints)
   */
  private isParticleInvolvedInJoint(particle: Particle, joint: Joint): boolean {
    // Direct involvement check
    if (
      joint.particleA.id === particle.id ||
      joint.particleB.id === particle.id
    ) {
      return true;
    }

    // Check if particle is part of the same rigid body group as either joint particle
    const isInSameGroupAsA = this.joints?.areInSameRigidBody(
      particle,
      joint.particleA
    ) ?? false;
    const isInSameGroupAsB = this.joints?.areInSameRigidBody(
      particle,
      joint.particleB
    ) ?? false;

    return isInSameGroupAsA || isInSameGroupAsB;
  }


  /**
   * Collision detection for particle-joint interaction with continuous collision detection
   */
  private checkParticleJointCollision(
    particle: Particle,
    joint: Joint
  ): boolean {
    const radius = particle.size;

    // Check current position
    const currentClosestPoint = getClosestPointOnLineSegment(
      particle.position,
      joint.particleA.position,
      joint.particleB.position
    );
    const currentDistance = particle.position.distance(currentClosestPoint);

    // Basic collision check
    if (currentDistance < radius && currentDistance > 0.001) {
      return true;
    }

    // Continuous collision detection for fast-moving particles
    if (particle.velocity.magnitude() > radius) {
      // Calculate where the particle was in the previous frame
      const previousPosition = particle.position
        .clone()
        .subtract(particle.velocity.clone().multiply(1 / 60)); // Assuming 60fps

      const previousClosestPoint = getClosestPointOnLineSegment(
        previousPosition,
        joint.particleA.position,
        joint.particleB.position
      );
      const previousDistance = previousPosition.distance(previousClosestPoint);

      // Check if particle crossed through the joint (was outside, now inside or vice versa)
      if (
        (previousDistance > radius && currentDistance < radius) ||
        (previousDistance < radius && currentDistance > radius)
      ) {
        return true;
      }

      // Check if particle path intersects with joint segment
      if (checkLineSegmentIntersection(
        previousPosition,
        particle.position,
        joint.particleA.position,
        joint.particleB.position,
        radius
      )) {
        return true;
      }
    }

    return false;
  }



  /**
   * Handle collision where grabbed particle pushes joint particles away
   */
  private handleGrabbedParticleJointCollision(
    grabbedParticle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Calculate how much the grabbed particle overlaps with the joint
    const overlap =
      grabbedParticle.size - grabbedParticle.position.distance(closestPoint);
    if (overlap <= 0) return;

    // Calculate collision normal (from joint line to grabbed particle center)
    const collisionNormal = grabbedParticle.position
      .clone()
      .subtract(closestPoint);
    if (collisionNormal.magnitude() === 0) {
      // Particle is exactly on the line - use perpendicular to line as normal
      const lineVector = joint.particleB.position
        .clone()
        .subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    collisionNormal.normalize();

    // Calculate impact weights based on where along the joint the collision occurred
    const weights = this.calculateImpactWeights(closestPoint, joint);

    // Push joint particles away from the grabbed particle
    const pushStrength = overlap * 0.5; // How much to push each joint particle

    if (
      !joint.particleA.pinned &&
      !joint.particleA.grabbed &&
      weights.weightA > 0
    ) {
      // Push particle A away
      const pushForce = collisionNormal
        .clone()
        .multiply(-pushStrength * weights.weightA);
      joint.particleA.position.add(pushForce);

      // Also apply velocity to make the push feel natural
      const pushVelocity = collisionNormal
        .clone()
        .multiply(-pushStrength * weights.weightA * 10);
      joint.particleA.velocity.add(pushVelocity);
    }

    if (
      !joint.particleB.pinned &&
      !joint.particleB.grabbed &&
      weights.weightB > 0
    ) {
      // Push particle B away
      const pushForce = collisionNormal
        .clone()
        .multiply(-pushStrength * weights.weightB);
      joint.particleB.position.add(pushForce);

      // Also apply velocity to make the push feel natural
      const pushVelocity = collisionNormal
        .clone()
        .multiply(-pushStrength * weights.weightB * 10);
      joint.particleB.velocity.add(pushVelocity);
    }
  }

  /**
   * Handle collision where joint hits a static particle - joint particles bounce off
   */
  private handleStaticParticleJointCollision(
    staticParticle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Calculate how much the joint overlaps with the static particle
    const overlap =
      staticParticle.size - staticParticle.position.distance(closestPoint);
    if (overlap <= 0) return;

    // Calculate collision normal (from static particle center to joint line)
    const collisionNormal = closestPoint
      .clone()
      .subtract(staticParticle.position);
    if (collisionNormal.magnitude() === 0) {
      // Joint line passes through particle center - use perpendicular to line as normal
      const lineVector = joint.particleB.position
        .clone()
        .subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }
    collisionNormal.normalize();

    // Calculate impact weights based on where along the joint the collision occurred
    const weights = this.calculateImpactWeights(closestPoint, joint);

    // Apply repulsive forces to joint particles (they bounce off the static particle)
    const repulsionStrength = overlap * 2; // How strongly to push joint particles away

    if (
      !joint.particleA.pinned &&
      !joint.particleA.grabbed &&
      weights.weightA > 0
    ) {
      // Push particle A away from static particle
      const repulsionForce = collisionNormal
        .clone()
        .multiply(repulsionStrength * weights.weightA);
      joint.particleA.position.add(repulsionForce);

      // Apply collision velocity response
      const velocityChange = collisionNormal
        .clone()
        .multiply(repulsionStrength * weights.weightA * this.restitution);
      joint.particleA.velocity.add(velocityChange);
    }

    if (
      !joint.particleB.pinned &&
      !joint.particleB.grabbed &&
      weights.weightB > 0
    ) {
      // Push particle B away from static particle
      const repulsionForce = collisionNormal
        .clone()
        .multiply(repulsionStrength * weights.weightB);
      joint.particleB.position.add(repulsionForce);

      // Apply collision velocity response
      const velocityChange = collisionNormal
        .clone()
        .multiply(repulsionStrength * weights.weightB * this.restitution);
      joint.particleB.velocity.add(velocityChange);
    }
  }

  /**
   * Handle collision between particle and joint line segment with force transfer
   */
  private handleParticleJointCollision(
    particle: Particle,
    closestPoint: Vector2D,
    joint: Joint
  ): void {
    // Skip collision if both joint particles are static or grabbed (immovable joints shouldn't transfer force)
    if (
      (joint.particleA.pinned || joint.particleA.grabbed) &&
      (joint.particleB.pinned || joint.particleB.grabbed)
    ) {
      // Handle collision with static joint (only bounce the hitting particle)
      this.handleStaticJointCollision(particle, closestPoint, joint);
      return;
    }

    // STEP 1: Calculate collision normal and ensure it points away from joint
    let collisionNormal = particle.position.clone().subtract(closestPoint);

    if (collisionNormal.magnitude() === 0) {
      // Particle is exactly on the line - use perpendicular to line as normal
      const lineVector = joint.particleB.position
        .clone()
        .subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
      
      // Make sure normal points in a consistent direction
      if (collisionNormal.magnitude() === 0) {
        collisionNormal.set(1, 0); // Default direction if line has zero length
      }
    }

    collisionNormal.normalize();

    // STEP 2: POSITION CORRECTION FIRST - Ensure complete separation before velocity response
    const currentDistance = particle.position.distance(closestPoint);
    const overlap = particle.size - currentDistance;
    
    if (overlap > 0) {
      // Calculate impact weights for position correction
      const weights = this.calculateImpactWeights(closestPoint, joint);
      
      // Apply aggressive position correction to guarantee separation
      this.applyEmergencyJointSeparation(
        particle,
        joint,
        weights,
        collisionNormal,
        overlap
      );
      
      // Recalculate closest point and collision normal after position correction
      const newClosestPoint = getClosestPointOnLineSegment(
        particle.position,
        joint.particleA.position,
        joint.particleB.position
      );
      
      collisionNormal = particle.position.clone().subtract(newClosestPoint);
      if (collisionNormal.magnitude() > 0) {
        collisionNormal.normalize();
      }
    }

    // STEP 3: Calculate impact point weights based on distance along joint
    const weights = this.calculateImpactWeights(closestPoint, joint);

    // Calculate effective mass of joint system at impact point
    const effectiveJointMass = this.calculateEffectiveJointMass(joint, weights);

    // STEP 4: Apply velocity response only after position is corrected
    
    // Calculate relative velocity in collision normal direction
    const relativeVelocity = particle.velocity.dot(collisionNormal);

    // Don't resolve if velocities are separating (particle moving away from joint)
    if (relativeVelocity > 0) return;

    // Calculate collision impulse considering both particle and joint masses
    const totalMass = particle.mass + effectiveJointMass;
    const impulse =
      (-(1 + this.restitution) *
        relativeVelocity *
        particle.mass *
        effectiveJointMass) /
      totalMass;

    // Apply impulse to hitting particle (reduced by mass ratio)
    const particleImpulse = collisionNormal
      .clone()
      .multiply(impulse / particle.mass);
    particle.velocity.add(particleImpulse);

    // Apply friction to tangential velocity component
    if (this.physics && this.physics.friction > 0) {
      this.applyJointFriction(particle, collisionNormal, this.physics.friction);
    }

    // Transfer force to joint particles based on impact location and masses
    this.transferForceToJoint(joint, weights, collisionNormal, impulse);

    // STEP 5: Final velocity validation - ensure particle is not moving toward joint
    this.validatePostCollisionVelocity(particle, collisionNormal);
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
      const lineVector = joint.particleB.position
        .clone()
        .subtract(joint.particleA.position);
      collisionNormal.x = -lineVector.y;
      collisionNormal.y = lineVector.x;
    }

    collisionNormal.normalize();

    // Apply collision response with restitution (same as particle-particle collisions)

    // Calculate relative velocity in collision normal direction
    const relativeVelocity = particle.velocity.dot(collisionNormal);

    // Don't resolve if velocities are separating
    if (relativeVelocity > 0) return;

    // Calculate collision impulse
    const impulse = -(1 + this.restitution) * relativeVelocity;

    // Apply impulse to particle velocity
    const impulseVector = collisionNormal.clone().multiply(impulse);
    particle.velocity.add(impulseVector);

    // Apply friction to tangential velocity component
    if (this.physics && this.physics.friction > 0) {
      this.applyJointFriction(particle, collisionNormal, this.physics.friction);
    }

    // Position correction to prevent particle from staying inside the joint (static joint version)
    const overlap = particle.size - particle.position.distance(closestPoint);
    if (overlap > 0) {
      // For static joints, only move the particle (with extra padding to ensure separation)
      const correction = collisionNormal.clone().multiply(overlap * 1.1); // 10% padding
      particle.position.add(correction);
    }
  }

  /**
   * Calculate impact weights based on where along the joint the collision occurred
   */
  private calculateImpactWeights(
    impactPoint: Vector2D,
    joint: Joint
  ): { weightA: number; weightB: number } {
    const jointVector = joint.particleB.position
      .clone()
      .subtract(joint.particleA.position);
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
    if (!joint.particleA.pinned && !joint.particleA.grabbed) {
      effectiveMass += joint.particleA.mass * weights.weightA;
    }

    if (!joint.particleB.pinned && !joint.particleB.grabbed) {
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
    if (
      !joint.particleA.pinned &&
      !joint.particleA.grabbed &&
      weights.weightA > 0
    ) {
      const forceA = collisionNormal
        .clone()
        .multiply((-totalImpulse * weights.weightA) / joint.particleA.mass);
      joint.particleA.velocity.add(forceA);
    }

    // Transfer force to particleB (force opposite to collision normal)
    if (
      !joint.particleB.pinned &&
      !joint.particleB.grabbed &&
      weights.weightB > 0
    ) {
      const forceB = collisionNormal
        .clone()
        .multiply((-totalImpulse * weights.weightB) / joint.particleB.mass);
      joint.particleB.velocity.add(forceB);
    }
  }

  /**
   * Apply aggressive emergency separation to guarantee no overlap (used before velocity response)
   */
  private applyEmergencyJointSeparation(
    particle: Particle,
    joint: Joint,
    weights: { weightA: number; weightB: number },
    collisionNormal: Vector2D,
    overlap: number
  ): void {
    // Calculate effective mass of the joint system at impact point
    const effectiveJointMass = this.calculateEffectiveJointMass(joint, weights);
    const totalMass = particle.mass + effectiveJointMass;

    // Use aggressive separation - minimum separation is 2x particle radius
    const minimumSeparation = Math.max(overlap * 2.0, particle.size * 0.1);

    if (totalMass === 0 || effectiveJointMass === 0) {
      // Edge case - push particle out with aggressive separation
      const correction = collisionNormal.clone().multiply(minimumSeparation);
      particle.position.add(correction);
      return;
    }

    // Calculate separation ratio based on masses (lighter objects move more)
    const particleSeparationRatio = effectiveJointMass / totalMass;
    const jointSeparationRatio = particle.mass / totalMass;

    // Move particle away from joint (aggressive separation)
    const particleCorrection = collisionNormal
      .clone()
      .multiply(minimumSeparation * particleSeparationRatio);
    particle.position.add(particleCorrection);

    // Move joint particles away from collision point (distributed by weights and mobility)
    const jointCorrection = minimumSeparation * jointSeparationRatio;

    if (
      !joint.particleA.pinned &&
      !joint.particleA.grabbed &&
      weights.weightA > 0
    ) {
      const correctionA = collisionNormal
        .clone()
        .multiply(-jointCorrection * weights.weightA);
      joint.particleA.position.add(correctionA);
    }

    if (
      !joint.particleB.pinned &&
      !joint.particleB.grabbed &&
      weights.weightB > 0
    ) {
      const correctionB = collisionNormal
        .clone()
        .multiply(-jointCorrection * weights.weightB);
      joint.particleB.position.add(correctionB);
    }
  }

  /**
   * Validate and correct particle velocity after collision to ensure it's moving away from joint
   */
  private validatePostCollisionVelocity(
    particle: Particle,
    collisionNormal: Vector2D
  ): void {
    const velocityTowardJoint = -particle.velocity.dot(collisionNormal);
    
    // If particle is still moving toward joint, force it to move away
    if (velocityTowardJoint > 0) {
      // Remove the component of velocity toward the joint
      const velocityTowardJointVector = collisionNormal
        .clone()
        .multiply(-velocityTowardJoint);
      particle.velocity.add(velocityTowardJointVector);
      
      // Add minimum bounce velocity away from joint
      const minBounceVelocity = collisionNormal
        .clone()
        .multiply(particle.size * 2); // Minimum velocity away from joint
      particle.velocity.add(minBounceVelocity);
    }
  }


  /**
   * Apply friction to the tangential velocity component of a particle in joint collision
   */
  private applyJointFriction(
    particle: Particle,
    collisionNormal: Vector2D,
    friction: number
  ): void {
    // Get the tangential component of velocity (perpendicular to collision normal)
    const normalVelocityMagnitude = particle.velocity.dot(collisionNormal);
    const normalVelocity = collisionNormal
      .clone()
      .multiply(normalVelocityMagnitude);
    const tangentialVelocity = particle.velocity
      .clone()
      .subtract(normalVelocity);

    // Apply friction to reduce tangential velocity
    const frictionForce = tangentialVelocity.clone().multiply(-friction);
    particle.velocity.add(frictionForce);
  }

  /**
   * RigidBody interface implementation
   * Check if two particles belong to the same rigid body group
   */
  areInSameRigidBody(particle1: Particle, particle2: Particle): boolean {
    return this.joints?.areInSameRigidBody(particle1, particle2) ?? false;
  }

  /**
   * RigidBody interface implementation
   * Check if a particle has any rigid body connections
   */
  hasRigidBodyConnections(particleId: number): boolean {
    return this.joints?.hasJoint(particleId) ?? false;
  }
}

export function createCollisionsForce(
  options: CollisionsOptions = {}
): Collisions {
  return new Collisions(options);
}

export const defaultCollisions = createCollisionsForce();
