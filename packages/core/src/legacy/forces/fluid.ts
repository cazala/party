import { Particle } from "../particle";
import { SpatialGrid } from "../spatial-grid";
import { Force } from "../system";
import { Vector } from "../vector";

// Default parameters for fluid simulation
export const DEFAULT_FLUID_ENABLED = true;
export const DEFAULT_INFLUENCE_RADIUS = 100;
export const DEFAULT_TARGET_DENSITY = 0.5;
export const DEFAULT_PRESSURE_MULTIPLIER = 2.5;
export const DEFAULT_VISCOSITY = 1;
export const DEFAULT_NEAR_PRESSURE_MULTIPLIER = 10;
export const DEFAULT_NEAR_THRESHOLD = 30;
export const DEFAULT_ENABLE_NEAR_PRESSURE = false;

// Kernel lookup table configuration
const KERNEL_TABLE_SIZE = 1024; // Number of entries in lookup table
const KERNEL_TABLE_MAX_DISTANCE = 200; // Maximum distance to cache (covers most common radii)

// Fast math approximations
const INV_PI = 1 / Math.PI; // Pre-computed 1/π
const PI_OVER_6 = Math.PI / 6; // Pre-computed π/6
const PI_OVER_15 = Math.PI / 15; // Pre-computed π/15
const PI_OVER_4 = Math.PI / 4; // Pre-computed π/4

/**
 * Fast power approximations using bit manipulation and lookup tables
 */
class FastMath {
  private static pow2Table: Float32Array = new Float32Array(256);
  private static pow4Table: Float32Array = new Float32Array(256);
  private static pow6Table: Float32Array = new Float32Array(256);
  private static pow8Table: Float32Array = new Float32Array(256);
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) return;

    // Pre-compute power tables for common operations
    for (let i = 0; i < 256; i++) {
      const x = i / 255; // Normalize to [0, 1]
      this.pow2Table[i] = x * x;
      this.pow4Table[i] = x * x * x * x;
      this.pow6Table[i] = x * x * x * x * x * x;
      this.pow8Table[i] = x * x * x * x * x * x * x * x;
    }

    this.initialized = true;
  }

  /**
   * Fast approximation for small powers using lookup tables
   */
  static fastPow(base: number, exponent: 2 | 4 | 6 | 8): number {
    if (!this.initialized) this.initialize();

    if (base <= 0) return 0;
    if (base >= 1) return Math.pow(base, exponent); // Fallback for values > 1

    const index = Math.floor(base * 255);
    switch (exponent) {
      case 2:
        return this.pow2Table[index];
      case 4:
        return this.pow4Table[index];
      case 6:
        return this.pow6Table[index];
      case 8:
        return this.pow8Table[index];
      default:
        return Math.pow(base, exponent);
    }
  }

  /**
   * Fast square root approximation using bit manipulation
   */
  static fastSqrt(x: number): number {
    if (x < 0.01) return Math.sqrt(x); // Use accurate sqrt for very small values

    // Fast inverse square root approximation (Quake III algorithm)
    const halfX = 0.5 * x;
    const buf = new ArrayBuffer(4);
    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);
    f32[0] = x;
    u32[0] = 0x5f3759df - (u32[0] >> 1);
    let y = f32[0];

    // Newton-Raphson iteration for better accuracy
    y = y * (1.5 - halfX * y * y);

    return x * y; // Convert from inverse sqrt to sqrt
  }
}

/**
 * Pre-computed kernel lookup tables for performance optimization
 */
class KernelLookupTables {
  private densityTable: Float32Array;
  private nearDensityTable: Float32Array;
  private derivativeTable: Float32Array;
  private viscosityTable: Float32Array;
  private viscosityDerivativeTable: Float32Array;
  private stepSize: number;
  private radius: number;

  // Pre-computed radius powers for performance
  private radiusSquared: number;
  private radiusPow4: number;
  private radiusPow6: number;
  private radiusPow8: number;

  constructor(radius: number) {
    // Initialize FastMath if not already done
    FastMath.initialize();

    this.radius = radius;
    this.stepSize = KERNEL_TABLE_MAX_DISTANCE / (KERNEL_TABLE_SIZE - 1);

    // Pre-compute radius powers for kernel calculations
    this.radiusSquared = radius * radius;
    this.radiusPow4 = this.radiusSquared * this.radiusSquared;
    this.radiusPow6 = this.radiusPow4 * this.radiusSquared;
    this.radiusPow8 = this.radiusPow4 * this.radiusPow4;

    // Initialize lookup tables
    this.densityTable = new Float32Array(KERNEL_TABLE_SIZE);
    this.nearDensityTable = new Float32Array(KERNEL_TABLE_SIZE);
    this.derivativeTable = new Float32Array(KERNEL_TABLE_SIZE);
    this.viscosityTable = new Float32Array(KERNEL_TABLE_SIZE);
    this.viscosityDerivativeTable = new Float32Array(KERNEL_TABLE_SIZE);

    this.buildTables();
  }

  private buildTables(): void {
    for (let i = 0; i < KERNEL_TABLE_SIZE; i++) {
      const distance = i * this.stepSize;

      // Pre-compute all kernel values
      this.densityTable[i] = this.calculateDensityKernelRaw(distance);
      this.nearDensityTable[i] = this.calculateNearDensityKernelRaw(distance);
      this.derivativeTable[i] = this.calculateDerivativeKernelRaw(distance);
      this.viscosityTable[i] = this.calculateViscosityKernelRaw(distance);
      this.viscosityDerivativeTable[i] =
        this.calculateViscosityDerivativeKernelRaw(distance);
    }
  }

  private calculateDensityKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;

    // Use pre-computed radius powers and constants
    const volume = PI_OVER_6 * this.radiusPow4;
    const factor = this.radius - distance;

    return (factor * factor) / volume;
  }

  private calculateNearDensityKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;

    // Use pre-computed radius powers and constants
    const volume = PI_OVER_15 * this.radiusPow6;
    const factor = this.radius - distance;
    const factorSquared = factor * factor;

    return (factorSquared * factorSquared) / volume;
  }

  private calculateDerivativeKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;

    // Use pre-computed radius powers and constants
    const scale = (-12 * INV_PI) / this.radiusPow4;

    return (distance - this.radius) * scale;
  }

  private calculateViscosityKernelRaw(distance: number): number {
    // Use pre-computed radius powers and constants
    const volume = PI_OVER_4 * this.radiusPow8;
    const distanceSquared = distance * distance;
    const value = Math.max(0, this.radiusSquared - distanceSquared);

    return (value * value * value) / volume;
  }

  private calculateViscosityDerivativeKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;

    // Use pre-computed radius powers and constants
    const scale = (-24 * INV_PI) / this.radiusPow8;
    const distanceSquared = distance * distance;
    const factor = this.radiusSquared - distanceSquared;

    return scale * distance * factor * factor;
  }

  /**
   * Fast kernel lookup using linear interpolation
   */
  getDensityKernel(distance: number): number {
    if (distance >= this.radius || distance >= KERNEL_TABLE_MAX_DISTANCE)
      return 0;

    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;

    // Linear interpolation
    return this.densityTable[i0] * (1 - t) + this.densityTable[i1] * t;
  }

  getNearDensityKernel(distance: number): number {
    if (distance >= this.radius || distance >= KERNEL_TABLE_MAX_DISTANCE)
      return 0;

    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;

    return this.nearDensityTable[i0] * (1 - t) + this.nearDensityTable[i1] * t;
  }

  getDerivativeKernel(distance: number): number {
    if (distance >= this.radius || distance >= KERNEL_TABLE_MAX_DISTANCE)
      return 0;

    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;

    return this.derivativeTable[i0] * (1 - t) + this.derivativeTable[i1] * t;
  }

  getViscosityKernel(distance: number): number {
    if (distance >= KERNEL_TABLE_MAX_DISTANCE) return 0;

    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;

    return this.viscosityTable[i0] * (1 - t) + this.viscosityTable[i1] * t;
  }

  getViscosityDerivativeKernel(distance: number): number {
    if (distance >= this.radius || distance >= KERNEL_TABLE_MAX_DISTANCE)
      return 0;

    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;

    return (
      this.viscosityDerivativeTable[i0] * (1 - t) +
      this.viscosityDerivativeTable[i1] * t
    );
  }

  getRadius(): number {
    return this.radius;
  }
}

// Global cache for kernel lookup tables by radius
const kernelCache = new Map<number, KernelLookupTables>();

/**
 * Get or create kernel lookup tables for a given radius
 */
function getKernelTables(radius: number): KernelLookupTables {
  // Round radius to reduce cache fragmentation
  const roundedRadius = Math.round(radius * 10) / 10; // Round to 1 decimal place

  let tables = kernelCache.get(roundedRadius);
  if (!tables) {
    tables = new KernelLookupTables(roundedRadius);
    kernelCache.set(roundedRadius, tables);

    // Limit cache size to prevent memory bloat
    if (kernelCache.size > 10) {
      const firstKey = kernelCache.keys().next().value;
      if (firstKey !== undefined) {
        kernelCache.delete(firstKey);
      }
    }
  }

  return tables;
}

/**
 * Calculates the smoothing kernel function used for particle interactions.
 * This implements a poly6 kernel which provides smooth falloff with distance.
 * Now uses lookup tables for performance optimization.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The kernel weight value
 */
export function calculateDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getDensityKernel(distance);
}

/**
 * Calculates a spikier smoothing kernel function used for near-field particle interactions.
 * This implements a higher-power kernel which provides sharper, more pronounced peaks
 * and faster falloff compared to the standard poly6 kernel.
 * Now uses lookup tables for performance optimization.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The spiky kernel weight value
 */
export function calculateNearDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getNearDensityKernel(distance);
}

/**
 * Calculates the derivative of the smoothing kernel function.
 * Used for computing pressure gradients in the fluid simulation.
 * Now uses lookup tables for performance optimization.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The kernel derivative value
 */
export function calculateDensitySmoothingKernelDerivative(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getDerivativeKernel(distance);
}

export function calculateViscositySmoothingKernel(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getViscosityKernel(distance);
}

export function calculateViscositySmoothingKernelDerivative(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getViscosityDerivativeKernel(distance);
}

/**
 * Calculates the fluid density at a given point by summing the weighted
 * contributions of all nearby particles using the smoothing kernel.
 * @param point - The position to calculate density at
 * @param radius - The influence radius for density calculation
 * @param particles - Array of nearby particles to consider
 * @returns The calculated density value
 */
export function calculateDensity(
  point: Vector,
  radius: number,
  particles: Particle[]
) {
  let density = 0;
  for (const particle of particles) {
    const distance = point.distance(particle.position);
    const influence = calculateDensitySmoothingKernel(radius, distance);
    density += influence * 1000 * particle.mass;
  }
  return density;
}

/**
 * Calculates the near fluid density at a given point using the spiky kernel.
 * @param point - The position to calculate near density at
 * @param radius - The influence radius for density calculation
 * @param particles - Array of nearby particles to consider
 * @returns The calculated near density value
 */
export function calculateNearDensity(
  point: Vector,
  radius: number,
  particles: Particle[]
) {
  let density = 0;
  for (const particle of particles) {
    const distance = point.distance(particle.position);
    const influence = calculateNearDensitySmoothingKernel(radius, distance);
    density += influence * 1000 * particle.mass;
  }
  return density;
}

/**
 * Fluid force implementation using Smoothed Particle Hydrodynamics (SPH).
 * Creates pressure-based forces that simulate fluid behavior by maintaining
 * target density and applying pressure forces to particles.
 */
export class Fluid implements Force {
  /** Whether the fluid simulation is enabled */
  public enabled: boolean;
  /** The radius within which particles influence each other */
  public influenceRadius: number;
  /** The desired density for the fluid */
  public targetDensity: number;
  /** Multiplier for pressure force strength */
  public pressureMultiplier: number;
  /** Cache for calculated densities to avoid redundant computation */
  public densities: Map<number, number> = new Map();
  /** Cache for calculated near densities */
  public nearDensities: Map<number, number> = new Map();
  /** Viscosity force strength */
  public viscosity: number;
  /** Multiplier for near density pressure calculations */
  public nearPressureMultiplier: number;
  /** Distance threshold for using near pressure instead of regular pressure */
  public nearThreshold: number;
  /** Whether near pressure calculations are enabled */
  public enableNearPressure: boolean;

  // Enhanced density caching
  /** Cache for particle positions used in density calculations */
  private particlePositionCache: Map<number, { x: number; y: number }> =
    new Map();
  /** Threshold for position change to trigger density recalculation */
  private positionChangeThreshold: number = 5.0; // pixels
  /** Frame counter for cache invalidation */
  private frameCount: number = 0;
  /** Cache invalidation frequency (every N frames) */
  private cacheInvalidationFrequency: number = 10;
  /**
   * Creates a new Fluid force instance.
   * @param options - Configuration options for the fluid simulation
   */
  constructor(
    options: {
      enabled?: boolean;
      influenceRadius?: number;
      targetDensity?: number;
      pressureMultiplier?: number;
      viscosity?: number;
      nearPressureMultiplier?: number;
      nearThreshold?: number;
      enableNearPressure?: boolean;
    } = {}
  ) {
    this.enabled = options.enabled ?? DEFAULT_FLUID_ENABLED;
    this.influenceRadius = options.influenceRadius ?? DEFAULT_INFLUENCE_RADIUS;
    this.targetDensity = options.targetDensity ?? DEFAULT_TARGET_DENSITY;
    this.pressureMultiplier =
      options.pressureMultiplier ?? DEFAULT_PRESSURE_MULTIPLIER;
    this.viscosity = options.viscosity ?? DEFAULT_VISCOSITY;
    this.nearPressureMultiplier =
      options.nearPressureMultiplier ?? DEFAULT_NEAR_PRESSURE_MULTIPLIER;
    this.nearThreshold = options.nearThreshold ?? DEFAULT_NEAR_THRESHOLD;
    this.enableNearPressure =
      options.enableNearPressure ?? DEFAULT_ENABLE_NEAR_PRESSURE;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  clearDensities(): void {
    this.densities.clear();
    this.nearDensities.clear();
    this.particlePositionCache.clear();
  }

  /**
   * Implements the Force interface clear method
   */
  clear(): void {
    this.clearDensities();
  }

  /**
   * Check if particle position has changed significantly since last density calculation
   */
  private hasParticleMovedSignificantly(particle: Particle): boolean {
    const cachedPosition = this.particlePositionCache.get(particle.id);
    if (!cachedPosition) return true;

    const deltaX = particle.position.x - cachedPosition.x;
    const deltaY = particle.position.y - cachedPosition.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    return (
      distanceSquared >
      this.positionChangeThreshold * this.positionChangeThreshold
    );
  }

  /**
   * Update cached position for a particle
   */
  private updateParticlePositionCache(particle: Particle): void {
    this.particlePositionCache.set(particle.id, {
      x: particle.position.x,
      y: particle.position.y,
    });
  }

  before(particles: Particle[]) {
    if (!this.enabled) {
      return;
    }

    // Increment frame counter for periodic cache invalidation
    this.frameCount++;
    const forceRecalculation =
      this.frameCount % this.cacheInvalidationFrequency === 0;

    for (const particle of particles) {
      // Check if we need to recalculate density for this particle
      const needsRecalculation =
        forceRecalculation ||
        this.hasParticleMovedSignificantly(particle) ||
        !this.densities.has(particle.id);

      if (needsRecalculation) {
        // Use pooled vector for predicted position calculation
        const velocityDelta = Vector.getPooled(
          particle.velocity.x / 60,
          particle.velocity.y / 60
        );
        const predictedPosition = Vector.getPooled(
          particle.position.x + velocityDelta.x,
          particle.position.y + velocityDelta.y
        );

        this.densities.set(
          particle.id,
          calculateDensity(predictedPosition, this.influenceRadius, particles)
        );

        // Only calculate near density if near pressure is enabled
        if (this.enableNearPressure) {
          this.nearDensities.set(
            particle.id,
            calculateNearDensity(
              predictedPosition,
              this.influenceRadius,
              particles
            )
          );
        }

        // Return pooled vectors
        velocityDelta.returnToPool();
        predictedPosition.returnToPool();

        // Update position cache
        this.updateParticlePositionCache(particle);
      }
    }
  }

  /**
   * Applies the fluid force to a particle by calculating pressure forces
   * based on local density differences from the target density.
   * @param particle - The particle to apply force to
   * @param spatialGrid - Spatial grid for efficient neighbor finding
   */
  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    if (!this.enabled || particle.pinned) {
      return;
    }

    const particles = spatialGrid.getParticles(
      particle.position,
      this.influenceRadius
    );

    if (particles.length === 0) {
      return;
    }

    const pressureForce = this.calculatePressureForce(
      particle.position,
      particles
    );

    // do A = F/d instead of F/m because this is a fluid
    const density = this.densities.get(particle.id);
    if (density) {
      const force = pressureForce.clone().divide(density);
      force.multiply(1000000);

      // Only calculate and add viscosity force if viscosity > 0
      if (this.viscosity > 0) {
        const viscosityForce = this.calculateViscosityForce(
          particle.position,
          particle.velocity,
          particles
        );
        force.add(viscosityForce.clone().multiply(1000).divide(density));
      }

      force.limit(100);

      particle.velocity.add(force);
    }
  }

  /**
   * Calculates the pressure force at a given point by summing pressure
   * gradients from all nearby particles.
   * @param point - The position to calculate pressure force at
   * @param particles - Array of nearby particles contributing to pressure
   * @returns The accumulated pressure force vector
   */
  calculatePressureForce(point: Vector, particles: Particle[]) {
    const pressureForce = Vector.zero();

    for (const particle of particles) {
      const distance = point.distance(particle.position);
      if (distance === 0) {
        continue;
      }

      // Use pooled vector for temporary direction calculation
      const direction = Vector.getPooled(
        particle.position.x - point.x,
        particle.position.y - point.y
      ).divide(distance);

      const slope = calculateDensitySmoothingKernelDerivative(
        this.influenceRadius,
        distance
      );
      const density = this.densities.get(particle.id)!;
      const nearDensity = this.enableNearPressure
        ? this.nearDensities.get(particle.id) || 0
        : 0;
      const pressureResult = this.convertDensityToPressure(
        density,
        nearDensity
      );

      // Use near pressure when particles are too close and near pressure is enabled, otherwise use regular pressure
      const effectivePressure =
        this.enableNearPressure && distance < this.nearThreshold
          ? pressureResult.nearPressure
          : pressureResult.pressure;

      if (density > 0) {
        // Use pooled vector for gradient calculation
        const gradient = Vector.getPooled(
          (direction.x * effectivePressure * slope) / density,
          (direction.y * effectivePressure * slope) / density
        );
        pressureForce.add(gradient);
        gradient.returnToPool();
      }

      direction.returnToPool();
    }

    return pressureForce.multiply(-1);
  }

  calculateViscosityForce(
    point: Vector,
    velocity: Vector,
    particles: Particle[]
  ) {
    // Early exit if viscosity is 0 to avoid unnecessary computations
    if (this.viscosity === 0) {
      return Vector.zero();
    }

    const viscosityForce = Vector.zero();

    for (const particle of particles) {
      const distance = point.distance(particle.position);
      if (distance === 0) {
        continue;
      }

      const influence = calculateViscositySmoothingKernel(
        this.influenceRadius,
        distance
      );

      // Use pooled vector for velocity difference calculation
      const velocityDiff = Vector.getPooled(
        particle.velocity.x - velocity.x,
        particle.velocity.y - velocity.y
      ).multiply(influence);

      viscosityForce.add(velocityDiff);
      velocityDiff.returnToPool();
    }

    return viscosityForce.multiply(this.viscosity);
  }
  /**
   * Converts fluid density to pressure using a linear relationship.
   * Higher density creates positive pressure (repulsion), lower density
   * creates negative pressure (attraction).
   * @param density - The current density value
   * @param nearDensity - The current near density value
   * @returns Object containing both pressure and nearPressure values
   */
  convertDensityToPressure(density: number, nearDensity: number) {
    const densityDifference = density - this.targetDensity;
    const pressure = densityDifference * this.pressureMultiplier;
    const nearPressure = nearDensity * this.nearPressureMultiplier;
    return { pressure, nearPressure };
  }

  calculateSharedPressure(
    densityA: number,
    densityB: number,
    nearDensityA: number,
    nearDensityB: number
  ) {
    const pressureResultA = this.convertDensityToPressure(
      densityA,
      nearDensityA
    );
    const pressureResultB = this.convertDensityToPressure(
      densityB,
      nearDensityB
    );
    return {
      pressure: (pressureResultA.pressure + pressureResultB.pressure) / 2,
      nearPressure:
        (pressureResultA.nearPressure + pressureResultB.nearPressure) / 2,
    };
  }
}
