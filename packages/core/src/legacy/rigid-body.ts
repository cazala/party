import { Particle } from "./particle";

/**
 * Interface for rigid body queries
 * Allows collision system to check rigid body relationships without tight coupling to joints
 */
export interface RigidBody {
  /**
   * Check if two particles belong to the same rigid body group
   */
  areInSameRigidBody(particle1: Particle, particle2: Particle): boolean;

  /**
   * Check if a particle has any rigid body connections
   */
  hasRigidBodyConnections(particleId: number): boolean;
}

/**
 * Null implementation of RigidBody for cases where no rigid bodies exist
 */
export class NullRigidBody implements RigidBody {
  areInSameRigidBody(): boolean {
    return false;
  }

  hasRigidBodyConnections(): boolean {
    return false;
  }
}

/**
 * Default null service instance
 */
export const defaultRigidBody = new NullRigidBody();