import { Particle } from "../particle";
import { SpatialGrid } from "../spatial-grid";
import { Force } from "../system";
import { Vector2D } from "../vector";

// Default parameters for fluid simulation
export const DEFAULT_INFLUENCE_RADIUS = 100;
export const DEFAULT_TARGET_DENSITY = 0.5;
export const DEFAULT_PRESSURE_MULTIPLIER = 2.5;

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
    density += influence * 1000;
  }
  return density;
}

/**
 * Fluid force implementation using Smoothed Particle Hydrodynamics (SPH).
 * Creates pressure-based forces that simulate fluid behavior by maintaining
 * target density and applying pressure forces to particles.
 */
export class Fluid implements Force {
  /** The radius within which particles influence each other */
  public influenceRadius: number;
  /** The desired density for the fluid */
  public targetDensity: number;
  /** Multiplier for pressure force strength */
  public pressureMultiplier: number;
  /** Cache for calculated densities to avoid redundant computation */
  public densities: Map<number, number> = new Map();

  /**
   * Creates a new Fluid force instance.
   * @param options - Configuration options for the fluid simulation
   */
  constructor(
    options: {
      influenceRadius?: number;
      targetDensity?: number;
      pressureMultiplier?: number;
    } = {}
  ) {
    this.influenceRadius = options.influenceRadius ?? DEFAULT_INFLUENCE_RADIUS;
    this.targetDensity = options.targetDensity ?? DEFAULT_TARGET_DENSITY;
    this.pressureMultiplier =
      options.pressureMultiplier ?? DEFAULT_PRESSURE_MULTIPLIER;
  }

  warmup(particles: Particle[], deltaTime: number) {
    for (const particle of particles) {
      // const predictedPosition = particle.position
      // .clone()
      // .add(particle.velocity.clone().multiply(deltaTime));
      this.densities.set(
        particle.id,
        calculateDensity(particle.position, this.influenceRadius, particles)
      );
    }
  }

  /**
   * Applies the fluid force to a particle by calculating pressure forces
   * based on local density differences from the target density.
   * @param particle - The particle to apply force to
   * @param spatialGrid - Spatial grid for efficient neighbor finding
   * @returns The calculated pressure force vector
   */
  apply(particle: Particle, spatialGrid: SpatialGrid) {
    const particles = spatialGrid.getParticles(
      particle.position,
      this.influenceRadius
    );
    const pressureForce = this.calculatePressureForce(
      particle.position,
      particles
    );

    // do A = F/d instead of F/m because this is a fluid
    const density = this.densities.get(particle.id);
    if (density) {
      // const pressure = this.convertDensityToPressure(density);
      // const force = pressureForce.divide(pressure);
      // particle.acceleration.add(force);
      // particle.velocity.add(new Vector2D(0, 500).divide(120));
      particle.velocity.add(pressureForce.multiply(10000));
    }

    return Vector2D.zero();
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
      const pressure = this.convertDensityToPressure(density);
      const gradient =
        density > 0
          ? direction.multiply(pressure * slope).divide(density)
          : Vector2D.zero();
      pressureForce.add(gradient);
    }

    return pressureForce.multiply(-1);
  }

  /**
   * Converts fluid density to pressure using a linear relationship.
   * Higher density creates positive pressure (repulsion), lower density
   * creates negative pressure (attraction).
   * @param density - The current density value
   * @returns The corresponding pressure value
   */
  convertDensityToPressure(density: number) {
    const densityDifference = density - this.targetDensity;
    const pressure = densityDifference * this.pressureMultiplier;
    return pressure;
  }

  calculateSharedPressure(densityA: number, densityB: number) {
    const pressureA = this.convertDensityToPressure(densityA);
    const pressureB = this.convertDensityToPressure(densityB);
    return (pressureA + pressureB) / 2;
  }
}
