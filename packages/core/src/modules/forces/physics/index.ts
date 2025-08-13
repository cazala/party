/**
 * Physics Force - Unified Interface
 *
 * Exports the same interface as the original physics.ts to avoid breaking changes.
 * Automatically chooses between CPU and WebGPU implementations based on backend availability.
 */

import { Vector2D } from "../../vector";
import { Particle } from "../../particle";
import { Force, SpatialGrid, System } from "../../system";

// Import both implementations
import {
  PhysicsCPU,
  PhysicsOptions,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
} from "./cpu";
import { PhysicsWebGPU } from "./webgpu";

// Re-export types and constants for backward compatibility
export type { PhysicsOptions };
export {
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
};

/**
 * Unified Physics force that automatically chooses between CPU and WebGPU implementations
 */
export class Physics implements Force {
  private implementation: PhysicsCPU | PhysicsWebGPU;

  constructor(options: PhysicsOptions = {}) {
    // Start with CPU implementation
    this.implementation = new PhysicsCPU(options);
  }

  // Forward all physics methods to the current implementation
  get gravity() {
    return this.implementation.gravity;
  }

  get inertia() {
    return this.implementation.inertia;
  }

  set inertia(value: number) {
    this.implementation.inertia = value;
  }

  get friction() {
    return this.implementation.friction;
  }

  set friction(value: number) {
    this.implementation.friction = value;
  }

  // Backward compatibility getters/setters
  get strength(): number {
    return this.implementation.strength;
  }

  set strength(value: number) {
    this.implementation.strength = value;
  }

  get direction(): Vector2D {
    return this.implementation.direction;
  }

  set direction(value: Vector2D) {
    this.implementation.direction = value;
  }

  setStrength(strength: number): void {
    this.implementation.setStrength(strength);
  }

  setDirection(direction: Vector2D): void {
    this.implementation.setDirection(direction);
  }

  setDirectionFromAngle(angle: number): void {
    this.implementation.setDirectionFromAngle(angle);
  }

  setInertia(inertia: number): void {
    this.implementation.setInertia(inertia);
  }

  setFriction(friction: number): void {
    this.implementation.setFriction(friction);
  }

  apply(particles: Particle[], spatialGrid: SpatialGrid): void | Promise<void> {
    if ((this.implementation as any).apply) {
      return (this.implementation as any).apply(particles, spatialGrid);
    }
    // Fallback: map to per-particle applyOne if present
    if ((this.implementation as any).applyOne) {
      for (const p of particles)
        (this.implementation as any).applyOne(p, spatialGrid);
    }
  }

  after?(
    particles: Particle[],
    deltaTime: number,
    spatialGrid: SpatialGrid
  ): void {
    if (this.implementation.after) {
      this.implementation.after(particles, deltaTime, spatialGrid);
    }
  }

  cleanupRemovedParticles(activeParticleIds: Set<number>): void {
    this.implementation.cleanupRemovedParticles(activeParticleIds);
  }

  clearPositionHistory(): void {
    this.implementation.clearPositionHistory();
  }

  clear?(): void {
    if (this.implementation.clear) {
      this.implementation.clear();
    }
  }

  /**
   * Explicitly set backend implementation.
   * @returns true if switched or already on desired backend, false if requested backend unavailable
   */
  setBackend(backend: "cpu" | "webgpu"): boolean {
    const wantsWebGPU = backend === "webgpu";
    const isWebGPU = this.implementation instanceof PhysicsWebGPU;
    if (wantsWebGPU === isWebGPU) return true;

    // Gather current options to preserve behavior across switch
    const currentOptions: PhysicsOptions = {
      gravity: {
        strength: this.implementation.gravity.strength,
        direction: this.implementation.gravity.direction.clone(),
      },
      inertia: this.implementation.inertia,
      friction: this.implementation.friction,
    };

    if (wantsWebGPU) {
      const canUseWebGPU =
        typeof navigator !== "undefined" && !!(navigator as any).gpu;
      if (!canUseWebGPU) return false;
      this.implementation = new PhysicsWebGPU(currentOptions);
      return true;
    }

    // Switch to CPU
    this.implementation = new PhysicsCPU(currentOptions);
    return true;
  }

  /** Get current backend */
  getBackend(): "cpu" | "webgpu" {
    return this.implementation instanceof PhysicsWebGPU ? "webgpu" : "cpu";
  }

  /**
   * Set the compute backend and switch implementation if needed (auto-select)
   */
  init?(_system: System): void {
    // Pick implementation once at init time based on WebGPU availability
    const canUseWebGPU =
      typeof navigator !== "undefined" && !!(navigator as any).gpu;
    if (canUseWebGPU && !(this.implementation instanceof PhysicsWebGPU)) {
      const currentOptions: PhysicsOptions = {
        gravity: {
          strength: this.implementation.gravity.strength,
          direction: this.implementation.gravity.direction.clone(),
        },
        inertia: this.implementation.inertia,
        friction: this.implementation.friction,
      };
      // WebGPU implementation is currently a stub that mirrors CPU behavior
      this.implementation = new PhysicsWebGPU(currentOptions);
    }
  }

  /**
   * Get current compute backend
   */
  // No backend exposure; implementation is selected in init()
}

export function createPhysicsForce(
  gravity: { strength?: number; direction?: Vector2D } = {},
  inertia: number = DEFAULT_INERTIA,
  friction: number = DEFAULT_FRICTION
): Physics {
  return new Physics({
    gravity,
    inertia,
    friction,
  });
}

export const defaultPhysics = createPhysicsForce();

// Legacy exports for backward compatibility
export type Gravity = Physics;
export const Gravity = Physics;
export const createGravityForce = createPhysicsForce;
export const defaultGravity = defaultPhysics;
