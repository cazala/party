import { Vector } from "./vector";

/**
 * Configuration options for creating a particle.
 * All properties are optional and will use default values if not provided.
 *
 * @interface ParticleOptions
 */
export interface ParticleOptions {
  /** Initial position of the particle (default: origin) */
  position?: Vector;
  /** Initial velocity of the particle (default: zero) */
  velocity?: Vector;
  /** Initial acceleration of the particle (default: zero) */
  acceleration?: Vector;
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
  /** Rendering depth for layer ordering (default: 0, higher values render on top) */
  zIndex?: number;

  // Lifetime properties
  /** Lifetime in milliseconds (undefined = infinite) */
  duration?: number;
  /** Final size multiplier (default: 1, no change) */
  endSizeMultiplier?: number;
  /** Final alpha value (0-1, default: 1, no change) */
  endAlpha?: number;
  /** Array of possible end colors (empty = no color change) */
  endColor?: string[];
  /** Final speed multiplier (default: 1, no change) */
  endSpeedMultiplier?: number;
}

/** Global counter for generating unique particle IDs */
let idCounter = 0;

/**
 * Color interpolation cache to reduce string allocation overhead
 */
class ColorCache {
  private static cache = new Map<string, string>();
  private static maxCacheSize = 1000;

  /**
   * Get a cached color interpolation result or compute and cache it
   */
  static getCachedLerpColor(
    startColor: string,
    endColor: string,
    t: number
  ): string {
    // Create cache key with rounded t to reduce cache fragmentation
    const roundedT = Math.round(t * 100) / 100; // Round to 2 decimal places
    const key = `${startColor}-${endColor}-${roundedT}`;

    let cachedColor = this.cache.get(key);
    if (cachedColor) {
      return cachedColor;
    }

    // Compute the interpolated color
    cachedColor = this.computeLerpColor(startColor, endColor, t);

    // Add to cache if there's room
    if (this.cache.size < this.maxCacheSize) {
      this.cache.set(key, cachedColor);
    } else {
      // Clear oldest entries when cache is full
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.cache.set(key, cachedColor);
      }
    }

    return cachedColor;
  }

  /**
   * Compute color interpolation without caching
   */
  private static computeLerpColor(
    startColor: string,
    endColor: string,
    t: number
  ): string {
    // Parse hex colors
    const parseHex = (hex: string) => {
      const clean = hex.replace("#", "");
      return {
        r: parseInt(clean.substr(0, 2), 16),
        g: parseInt(clean.substr(2, 2), 16),
        b: parseInt(clean.substr(4, 2), 16),
      };
    };

    const start = parseHex(startColor);
    const end = parseHex(endColor);

    // Interpolate each channel
    const lerp = (start: number, end: number, t: number) =>
      start + (end - start) * t;
    const r = Math.round(lerp(start.r, end.r, t));
    const g = Math.round(lerp(start.g, end.g, t));
    const b = Math.round(lerp(start.b, end.b, t));

    // Convert back to hex
    const toHex = (n: number) => {
      const hex = Math.max(0, Math.min(255, n)).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Clear the color cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}

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
  public position: Vector;
  /** Current velocity vector */
  public velocity: Vector;
  /** Current acceleration vector (reset each frame) */
  public acceleration: Vector;
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
  /** Rendering depth for layer ordering (default: 0, higher values render on top) */
  public zIndex: number;

  // Lifetime properties
  /** When this particle was created (timestamp in milliseconds) */
  public creationTime: number;
  /** Lifetime in milliseconds (null = infinite) */
  public duration: number | null;
  /** Initial size for interpolation calculations */
  public initialSize: number;
  /** Initial alpha value (always starts at 1) */
  public initialAlpha: number;
  /** Initial color for interpolation calculations */
  public initialColor: string;
  /** Initial speed magnitude for interpolation calculations */
  public initialSpeed: number;
  /** Final size multiplier */
  public endSizeMultiplier: number;
  /** Final alpha value */
  public endAlpha: number;
  /** Target end color (randomly chosen from array, if provided) */
  public endColor?: string;
  /** Final speed multiplier */
  public endSpeedMultiplier: number;
  /** Current alpha value (used for rendering) */
  public alpha: number;

  /**
   * Creates a new particle with the specified options.
   *
   * @param options - Configuration options for the particle
   */
  constructor(options: ParticleOptions = {}) {
    this.id = options.id !== undefined ? options.id : idCounter++;
    this.position = options.position || new Vector();
    this.velocity = options.velocity || new Vector();
    this.acceleration = options.acceleration || new Vector();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.pinned = options.pinned || false;
    this.grabbed = options.grabbed || false;
    this.zIndex = options.zIndex ?? 0;

    // Initialize lifetime properties
    this.creationTime = Date.now();
    this.duration = options.duration || null;
    this.initialSize = this.size;
    this.initialAlpha = 1;
    this.initialColor = this.color;
    this.initialSpeed = this.velocity.magnitude();
    this.endSizeMultiplier = options.endSizeMultiplier ?? 1;
    this.endAlpha = options.endAlpha ?? 1;
    this.endSpeedMultiplier = options.endSpeedMultiplier ?? 1;
    this.alpha = 1;

    // Choose random end color from array if provided
    if (options.endColor && options.endColor.length > 0) {
      const randomIndex = Math.floor(Math.random() * options.endColor.length);
      this.endColor = options.endColor[randomIndex];
    }
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
    // Use pooled vectors for temporary calculations to reduce GC pressure
    const accelDelta = Vector.getPooled(
      this.acceleration.x * deltaTime,
      this.acceleration.y * deltaTime
    );
    this.velocity.add(accelDelta);
    accelDelta.returnToPool();

    const velocityDelta = Vector.getPooled(
      this.velocity.x * deltaTime,
      this.velocity.y * deltaTime
    );
    this.position.add(velocityDelta);
    velocityDelta.returnToPool();

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
  applyForce(force: Vector): void {
    if (this.mass <= 0) {
      return; // Skip force application for zero or negative mass particles
    }

    // Use pooled vector for force calculation to reduce GC pressure
    const f = Vector.getPooled(force.x / this.mass, force.y / this.mass);
    this.acceleration.add(f);
    f.returnToPool();
  }

  /**
   * Resets the particle's properties to new values or defaults.
   *
   * @param options - New properties for the particle (optional)
   */
  reset(options: ParticleOptions = {}): void {
    this.position = options.position || new Vector();
    this.velocity = options.velocity || new Vector();
    this.acceleration = options.acceleration || new Vector();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.pinned = options.pinned || false;
  }

  // === Lifecycle Management Methods ===

  /**
   * Gets the age of this particle in milliseconds.
   *
   * @returns Time since creation in milliseconds
   */
  getAge(): number {
    return Date.now() - this.creationTime;
  }

  /**
   * Gets the lifetime progress of this particle as a value from 0 to 1.
   *
   * @returns Progress from 0 (just created) to 1 (end of lifetime). Returns 0 for infinite particles.
   */
  getLifetimeProgress(): number {
    if (this.duration === null) return 0; // Infinite particles don't progress
    const age = this.getAge();
    return Math.min(age / this.duration, 1);
  }

  /**
   * Checks if this particle should be destroyed (has exceeded its lifetime).
   *
   * @returns True if the particle has exceeded its duration
   */
  isDead(): boolean {
    if (this.duration === null) return false; // Infinite particles never die
    return this.getAge() >= this.duration;
  }

  /**
   * Interpolates particle properties over its lifetime.
   * This method should be called each frame to update animated properties.
   *
   * @param deltaTime - Time elapsed since last update in milliseconds (unused but kept for consistency)
   */
  interpolateProperties(_deltaTime: number): void {
    if (this.duration === null) return; // No interpolation for infinite particles

    // Quick check: if no interpolatable properties are set, skip all work
    if (
      this.endSizeMultiplier === 1 &&
      this.endAlpha === 1 &&
      this.endSpeedMultiplier === 1 &&
      (!this.endColor || this.endColor === this.initialColor)
    ) {
      return; // No properties to interpolate
    }

    const progress = this.getLifetimeProgress();

    // Interpolate size
    if (this.endSizeMultiplier !== 1) {
      this.size =
        this.initialSize * this.lerp(1, this.endSizeMultiplier, progress);
    }

    // Interpolate alpha
    if (this.endAlpha !== 1) {
      this.alpha = this.lerp(this.initialAlpha, this.endAlpha, progress);
    }

    // Interpolate color
    if (this.endColor && this.endColor !== this.initialColor) {
      this.color = this.lerpColor(this.initialColor, this.endColor, progress);
    }

    // Interpolate speed
    if (this.endSpeedMultiplier !== 1) {
      const currentSpeed = this.velocity.magnitude();
      if (currentSpeed > 0) {
        const targetSpeed =
          this.initialSpeed * this.lerp(1, this.endSpeedMultiplier, progress);
        const speedRatio = targetSpeed / currentSpeed;
        this.velocity.multiply(speedRatio);
      }
    }
  }

  /**
   * Linear interpolation between two values.
   *
   * @param start - Starting value
   * @param end - Ending value
   * @param t - Interpolation factor (0-1)
   * @returns Interpolated value
   */
  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Linear interpolation between two colors in hex format.
   * Uses ColorCache to reduce string allocation overhead.
   *
   * @param startColor - Starting color in hex format (#rrggbb)
   * @param endColor - Ending color in hex format (#rrggbb)
   * @param t - Interpolation factor (0-1)
   * @returns Interpolated color in hex format
   */
  private lerpColor(startColor: string, endColor: string, t: number): string {
    return ColorCache.getCachedLerpColor(startColor, endColor, t);
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
    const cloned = new Particle({
      id: this.id, // Preserve the original ID
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      acceleration: this.acceleration.clone(),
      mass: this.mass,
      size: this.size,
      color: this.color,
      pinned: this.pinned,
      grabbed: this.grabbed,
      zIndex: this.zIndex,
      // Include lifetime properties
      duration: this.duration ?? undefined,
      endSizeMultiplier: this.endSizeMultiplier,
      endAlpha: this.endAlpha,
      endColor: this.endColor ? [this.endColor] : undefined,
      endSpeedMultiplier: this.endSpeedMultiplier,
    });

    // Copy over computed lifetime state
    cloned.creationTime = this.creationTime;
    cloned.initialSize = this.initialSize;
    cloned.initialAlpha = this.initialAlpha;
    cloned.initialColor = this.initialColor;
    cloned.initialSpeed = this.initialSpeed;
    cloned.alpha = this.alpha;
    cloned.endColor = this.endColor;

    return cloned;
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
