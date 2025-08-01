import { Particle } from "../particle";
import { SpatialGrid } from "../spatial-grid";
import { Force } from "../system";
import { Vector2D } from "../vector";

// Default parameters for fluid simulation
export const DEFAULT_FLUID_ENABLED = true;
export const DEFAULT_INFLUENCE_RADIUS = 100;
export const DEFAULT_TARGET_DENSITY = 0.5;
export const DEFAULT_PRESSURE_MULTIPLIER = 2.5;
export const DEFAULT_VISCOSITY = 1;
export const DEFAULT_NEAR_PRESSURE_MULTIPLIER = 10;
export const DEFAULT_NEAR_THRESHOLD = 30;

/**
 * Calculates the smoothing kernel function used for particle interactions.
 * This implements a poly6 kernel which provides smooth falloff with distance.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The kernel weight value
 */
export function calculateDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  if (distance >= radius) {
    return 0;
  }
  const volume = (Math.PI * Math.pow(radius, 4)) / 6;
  return ((radius - distance) * (radius - distance)) / volume;
}

/**
 * Calculates a spikier smoothing kernel function used for near-field particle interactions.
 * This implements a higher-power kernel which provides sharper, more pronounced peaks
 * and faster falloff compared to the standard poly6 kernel.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The spiky kernel weight value
 */
export function calculateNearDensitySmoothingKernel(
  radius: number,
  distance: number
) {
  if (distance >= radius) {
    return 0;
  }
  const volume = (Math.PI * Math.pow(radius, 6)) / 15;
  const factor = radius - distance;
  return (factor * factor * factor * factor) / volume;
}

/**
 * Calculates the derivative of the smoothing kernel function.
 * Used for computing pressure gradients in the fluid simulation.
 * @param radius - The influence radius of the kernel
 * @param distance - The distance between particles
 * @returns The kernel derivative value
 */
export function calculateDensitySmoothingKernelDerivative(
  radius: number,
  distance: number
) {
  if (distance >= radius) return 0;
  const scale = -12 / (Math.PI * Math.pow(radius, 4));
  return (distance - radius) * scale;
}

export function calculateViscositySmoothingKernel(
  radius: number,
  distance: number
) {
  const volume = (Math.PI * Math.pow(radius, 8)) / 4;
  const value = Math.max(0, radius * radius - distance * distance);
  return (value * value * value) / volume;
}

export function calculateViscositySmoothingKernelDerivative(
  radius: number,
  distance: number
) {
  if (distance >= radius) return 0;
  const factor = radius * radius - distance * distance;
  const scale = -24 / (Math.PI * Math.pow(radius, 8));
  return scale * distance * factor * factor;
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

/**
 * Calculates the near fluid density at a given point using the spiky kernel.
 * @param point - The position to calculate near density at
 * @param radius - The influence radius for density calculation
 * @param particles - Array of nearby particles to consider
 * @returns The calculated near density value
 */
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
  }

  /**
   * Implements the Force interface clear method
   */
  clear(): void {
    this.clearDensities();
  }

  before(particles: Particle[]) {
    if (!this.enabled) {
      return;
    }

    for (const particle of particles) {
      const predictedPosition = particle.position
        .clone()
        .add(particle.velocity.clone().multiply(1 / 60));
      this.densities.set(
        particle.id,
        calculateDensity(predictedPosition, this.influenceRadius, particles)
      );
      this.nearDensities.set(
        particle.id,
        calculateNearDensity(predictedPosition, this.influenceRadius, particles)
      );
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

    const viscosityForce = this.calculateViscosityForce(
      particle.position,
      particle.velocity,
      particles
    );

    // do A = F/d instead of F/m because this is a fluid
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

  /**
   * Calculates the pressure force at a given point by summing pressure
   * gradients from all nearby particles.
   * @param point - The position to calculate pressure force at
   * @param particles - Array of nearby particles contributing to pressure
   * @returns The accumulated pressure force vector
   */
  calculatePressureForce(point: Vector2D, particles: Particle[]) {
    const pressureForce = Vector2D.zero();
    for (const particle of particles) {
      const distance = point.distance(particle.position);
      if (distance === 0) {
        continue;
      }
      const direction = particle.position
        .clone()
        .subtract(point)
        .divide(distance);
      const slope = calculateDensitySmoothingKernelDerivative(
        this.influenceRadius,
        distance
      );
      const density = this.densities.get(particle.id)!;
      // const sharedPressure = this.calculateSharedPressure(
      //   density,
      //   this.densities.get(particle.id)!
      // );
      const pressureResult = this.convertDensityToPressure(
        density,
        this.nearDensities.get(particle.id)!
      );

      // Use near pressure when particles are too close, otherwise use regular pressure
      const effectivePressure =
        distance < this.nearThreshold
          ? pressureResult.nearPressure
          : pressureResult.pressure;

      const gradient =
        density > 0
          ? direction.multiply(effectivePressure * slope).divide(density)
          : Vector2D.zero();
      pressureForce.add(gradient);
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
      if (distance === 0) {
        continue;
      }

      const influence = calculateViscositySmoothingKernel(
        this.influenceRadius,
        distance
      );
      viscosityForce.add(
        particle.velocity.clone().subtract(velocity).multiply(influence)
      );
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
