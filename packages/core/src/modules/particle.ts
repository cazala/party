import { Vector2D } from "./vector";

/**
 * Configuration options for creating a particle.
 * All properties are optional and will use default values if not provided.
 * 
 * @interface ParticleOptions
 */
export interface ParticleOptions {
  /** Initial position of the particle (default: origin) */
  position?: Vector2D;
  /** Initial velocity of the particle (default: zero) */
  velocity?: Vector2D;
  /** Initial acceleration of the particle (default: zero) */
  acceleration?: Vector2D;
  /** Mass of the particle, affects physics interactions (default: 1) */
  mass?: number;
  /** Radius of the particle for rendering and collisions (default: 5) */
  size?: number;
  /** Color of the particle as a CSS color string (default: random) */
  color?: string;
  /** Unique ID for the particle (auto-generated if not provided) */
  id?: number;
  /** Whether the particle is pinned in place and unaffected by forces */
  pinned?: boolean;
  /** Whether the particle is currently being grabbed by user interaction */
  grabbed?: boolean;
}

/** Global counter for generating unique particle IDs */
let idCounter = 0;

/**
 * Represents a single particle in the physics simulation.
 * 
 * Particles have position, velocity, and acceleration vectors that define their motion.
 * They also have physical properties like mass and size that affect interactions with forces.
 * 
 * @class Particle
 * @example
 * ```typescript
 * // Create a particle at position (100, 100) with mass 2 and blue color
 * const particle = new Particle({
 *   position: new Vector2D(100, 100),
 *   mass: 2,
 *   size: 10,
 *   color: '#0066ff'
 * });
 * 
 * // Apply a force to the particle
 * const force = new Vector2D(0, -9.8); // Upward force
 * particle.applyForce(force);
 * 
 * // Update particle physics
 * particle.update(16.67); // 60 FPS timestep
 * ```
 */
export class Particle {
  /** Unique identifier for this particle */
  public id: number;
  /** Current position in 2D space */
  public position: Vector2D;
  /** Current velocity vector */
  public velocity: Vector2D;
  /** Current acceleration vector (reset each frame) */
  public acceleration: Vector2D;
  /** Mass of the particle, affects force interactions */
  public mass: number;
  /** Radius of the particle for rendering and collisions */
  public size: number;
  /** Color of the particle as a CSS color string */
  public color: string;
  /** Fluid density at this particle's location (used by fluid forces) */
  public density?: number;
  /** Whether this particle is pinned in place and unaffected by forces */
  public pinned?: boolean;
  /** Whether this particle is currently being grabbed by user interaction */
  public grabbed?: boolean;

  /**
   * Creates a new particle with the specified options.
   * 
   * @param options - Configuration options for the particle
   */
  constructor(options: ParticleOptions = {}) {
    this.id = options.id !== undefined ? options.id : idCounter++;
    this.position = options.position || new Vector2D();
    this.velocity = options.velocity || new Vector2D();
    this.acceleration = options.acceleration || new Vector2D();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.pinned = options.pinned || false;
    this.grabbed = options.grabbed || false;
  }

  /**
   * Updates the particle's physics for one time step.
   * 
   * This method performs Verlet integration:
   * 1. Applies accumulated acceleration to velocity
   * 2. Applies velocity to position
   * 3. Resets acceleration to zero for the next frame
   * 
   * @param deltaTime - Time elapsed since last update in milliseconds
   */
  update(deltaTime: number): void {
    // Create a temporary copy of acceleration, multiply by deltaTime, then add to velocity
    const accelDelta = this.acceleration.clone().multiply(deltaTime);
    this.velocity.add(accelDelta);

    // Create a temporary copy of velocity, multiply by deltaTime, then add to position
    const velocityDelta = this.velocity.clone().multiply(deltaTime);
    this.position.add(velocityDelta);

    // Reset acceleration to zero
    this.acceleration.zero();
  }

  /**
   * Applies a force to this particle.
   * 
   * The force is divided by the particle's mass (F = ma, so a = F/m)
   * and added to the current acceleration. Forces are accumulated over
   * multiple calls and applied during the next update().
   * 
   * @param force - The force vector to apply
   */
  applyForce(force: Vector2D): void {
    if (this.mass <= 0) {
      return; // Skip force application for zero or negative mass particles
    }
    const f = force.clone().divide(this.mass);
    this.acceleration.add(f);
  }

  /**
   * Resets the particle's properties to new values or defaults.
   * 
   * @param options - New properties for the particle (optional)
   */
  reset(options: ParticleOptions = {}): void {
    this.position = options.position || new Vector2D();
    this.velocity = options.velocity || new Vector2D();
    this.acceleration = options.acceleration || new Vector2D();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.pinned = options.pinned || false;
  }

  /**
   * Creates a deep copy of this particle.
   * 
   * The clone preserves the original particle's ID and all properties,
   * with new Vector2D instances for position, velocity, and acceleration.
   * 
   * @returns A new Particle instance with identical properties
   */
  clone(): Particle {
    return new Particle({
      id: this.id, // Preserve the original ID
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      acceleration: this.acceleration.clone(),
      mass: this.mass,
      size: this.size,
      color: this.color,
      pinned: this.pinned,
    });
  }
}

/**
 * Gets the current value of the global particle ID counter.
 * 
 * This function is used by undo/redo systems to track and restore
 * the particle ID sequence across operations.
 * 
 * @returns The current ID counter value
 */
export function getIdCounter(): number {
  return idCounter;
}

/**
 * Sets the global particle ID counter to a specific value.
 * 
 * This function is used by undo/redo systems to restore
 * the particle ID sequence to a previous state.
 * 
 * @param value - The new ID counter value
 */
export function setIdCounter(value: number): void {
  idCounter = value;
}
