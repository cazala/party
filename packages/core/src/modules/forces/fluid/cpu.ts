import { Particle } from "../../particle";
import { SpatialGrid } from "../../spatial-grid";
import { Force } from "../../system";
import { Vector2D } from "../../vector";

// Default parameters for fluid simulation
export const DEFAULT_FLUID_ENABLED = true;
export const DEFAULT_INFLUENCE_RADIUS = 100;
export const DEFAULT_TARGET_DENSITY = 0.5;
export const DEFAULT_PRESSURE_MULTIPLIER = 2.5;
export const DEFAULT_VISCOSITY = 1;
export const DEFAULT_NEAR_PRESSURE_MULTIPLIER = 10;
export const DEFAULT_NEAR_THRESHOLD = 30;

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
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      this.pow2Table[i] = x * x;
      this.pow4Table[i] = x * x * x * x;
      this.pow6Table[i] = this.pow4Table[i] * this.pow2Table[i];
      this.pow8Table[i] = this.pow4Table[i] * this.pow4Table[i];
    }
    this.initialized = true;
  }

  static fastPow(base: number, exponent: 2 | 4 | 6 | 8): number {
    if (!this.initialized) this.initialize();
    if (base <= 0) return 0;
    if (base >= 1) return Math.pow(base, exponent);
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

  static fastSqrt(x: number): number {
    if (x < 0.01) return Math.sqrt(x);
    const halfX = 0.5 * x;
    const buf = new ArrayBuffer(4);
    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);
    f32[0] = x;
    u32[0] = 0x5f3759df - (u32[0] >> 1);
    let y = f32[0];
    y = y * (1.5 - halfX * y * y);
    return x * y;
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

  private radiusSquared: number;
  private radiusPow4: number;
  private radiusPow6: number;
  private radiusPow8: number;

  constructor(radius: number) {
    FastMath.initialize();
    this.radius = radius;
    this.stepSize = KERNEL_TABLE_MAX_DISTANCE / (KERNEL_TABLE_SIZE - 1);
    this.radiusSquared = radius * radius;
    this.radiusPow4 = this.radiusSquared * this.radiusSquared;
    this.radiusPow6 = this.radiusPow4 * this.radiusSquared;
    this.radiusPow8 = this.radiusPow4 * this.radiusPow4;

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
    const volume = PI_OVER_6 * this.radiusPow4;
    const factor = this.radius - distance;
    return (factor * factor) / volume;
  }

  private calculateNearDensityKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;
    const volume = PI_OVER_15 * this.radiusPow6;
    const factor = this.radius - distance;
    const factorSquared = factor * factor;
    return (factorSquared * factorSquared) / volume;
  }

  private calculateDerivativeKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;
    const scale = (-12 * INV_PI) / this.radiusPow4;
    return (distance - this.radius) * scale;
  }

  private calculateViscosityKernelRaw(distance: number): number {
    const volume = PI_OVER_4 * this.radiusPow8;
    const distanceSquared = distance * distance;
    const value = Math.max(0, this.radiusSquared - distanceSquared);
    return (value * value * value) / volume;
  }

  private calculateViscosityDerivativeKernelRaw(distance: number): number {
    if (distance >= this.radius) return 0;
    const scale = (-24 * INV_PI) / this.radiusPow8;
    const distanceSquared = distance * distance;
    const factor = this.radiusSquared - distanceSquared;
    return scale * distance * factor * factor;
  }

  getDensityKernel(distance: number): number {
    if (distance >= this.radius || distance >= KERNEL_TABLE_MAX_DISTANCE)
      return 0;
    const index = distance / this.stepSize;
    const i0 = Math.floor(index);
    const i1 = Math.min(i0 + 1, KERNEL_TABLE_SIZE - 1);
    const t = index - i0;
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

function getKernelTables(radius: number): KernelLookupTables {
  const roundedRadius = Math.round(radius * 10) / 10;
  let tables = kernelCache.get(roundedRadius);
  if (!tables) {
    tables = new KernelLookupTables(roundedRadius);
    kernelCache.set(roundedRadius, tables);
    if (kernelCache.size > 10) {
      const firstKey = kernelCache.keys().next().value;
      if (firstKey !== undefined) {
        kernelCache.delete(firstKey);
      }
    }
  }
  return tables;
}

export function calculateDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getDensityKernel(distance);
}

export function calculateNearDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  const tables = getKernelTables(radius);
  return tables.getNearDensityKernel(distance);
}

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

export class FluidCPU implements Force {
  public enabled: boolean;
  public influenceRadius: number;
  public targetDensity: number;
  public pressureMultiplier: number;
  public densities: Map<number, number> = new Map();
  public nearDensities: Map<number, number> = new Map();
  public viscosity: number;
  public nearPressureMultiplier: number;
  public nearThreshold: number;

  private particlePositionCache: Map<number, { x: number; y: number }> =
    new Map();
  private positionChangeThreshold: number = 5.0;
  private frameCount: number = 0;
  private cacheInvalidationFrequency: number = 10;

  constructor(
    options: {
      enabled?: boolean;
      influenceRadius?: number;
      targetDensity?: number;
      pressureMultiplier?: number;
      viscosity?: number;
      nearPressureMultiplier?: number;
      nearThreshold?: number;
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
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  clearDensities(): void {
    this.densities.clear();
    this.nearDensities.clear();
    this.particlePositionCache.clear();
  }

  clear(): void {
    this.clearDensities();
  }

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

  private updateParticlePositionCache(particle: Particle): void {
    this.particlePositionCache.set(particle.id, {
      x: particle.position.x,
      y: particle.position.y,
    });
  }

  before(particles: Particle[]) {
    if (!this.enabled) return;
    this.frameCount++;
    const forceRecalc = this.frameCount % this.cacheInvalidationFrequency === 0;
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const needsRecalc =
        forceRecalc ||
        this.hasParticleMovedSignificantly(particle) ||
        !this.densities.has(particle.id);
      if (needsRecalc) {
        const velocityDelta = Vector2D.getPooled(
          particle.velocity.x / 60,
          particle.velocity.y / 60
        );
        const predictedPosition = Vector2D.getPooled(
          particle.position.x + velocityDelta.x,
          particle.position.y + velocityDelta.y
        );
        this.densities.set(
          particle.id,
          calculateDensity(predictedPosition, this.influenceRadius, particles)
        );
        this.nearDensities.set(
          particle.id,
          calculateNearDensity(
            predictedPosition,
            this.influenceRadius,
            particles
          )
        );
        velocityDelta.returnToPool();
        predictedPosition.returnToPool();
        this.updateParticlePositionCache(particle);
      }
    }
  }

  apply(particles: Particle[], spatialGrid: SpatialGrid): void {
    for (const particle of particles) {
      if (!this.enabled || particle.pinned) continue;
      const neighbors = spatialGrid.getParticles(
        particle.position,
        this.influenceRadius
      );
      if (neighbors.length === 0) continue;
      const pressureForce = this.calculatePressureForce(
        particle.position,
        neighbors
      );
      const viscosityForce = this.calculateViscosityForce(
        particle.position,
        particle.velocity,
        neighbors
      );
      const density = this.densities.get(particle.id);
      if (density) {
        const force = pressureForce.clone().divide(density);
        force
          .multiply(1000000)
          .add(viscosityForce.clone().multiply(1000).divide(density));
        force.limit(100);
        particle.velocity.add(force);
      }
    }
  }

  calculatePressureForce(point: Vector2D, particles: Particle[]) {
    const pressureForce = Vector2D.zero();
    for (const particle of particles) {
      const distance = point.distance(particle.position);
      if (distance === 0) continue;
      const direction = Vector2D.getPooled(
        particle.position.x - point.x,
        particle.position.y - point.y
      ).divide(distance);
      const slope = calculateDensitySmoothingKernelDerivative(
        this.influenceRadius,
        distance
      );
      const density = this.densities.get(particle.id)!;
      const pressureResult = this.convertDensityToPressure(
        density,
        this.nearDensities.get(particle.id)!
      );
      const effectivePressure =
        distance < this.nearThreshold
          ? pressureResult.nearPressure
          : pressureResult.pressure;
      if (density > 0) {
        const gradient = Vector2D.getPooled(
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
    point: Vector2D,
    velocity: Vector2D,
    particles: Particle[]
  ) {
    const viscosityForce = Vector2D.zero();
    for (const particle of particles) {
      const distance = point.distance(particle.position);
      if (distance === 0) continue;
      const influence = calculateViscositySmoothingKernel(
        this.influenceRadius,
        distance
      );
      const velocityDiff = Vector2D.getPooled(
        particle.velocity.x - velocity.x,
        particle.velocity.y - velocity.y
      ).multiply(influence);
      viscosityForce.add(velocityDiff);
      velocityDiff.returnToPool();
    }
    return viscosityForce.multiply(this.viscosity);
  }

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

// Convenience helpers kept for backward compatibility
export function calculateDensity(
  point: Vector2D,
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

export function calculateNearDensity(
  point: Vector2D,
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
