import { Vector2D } from "./vector";
import { Particle } from "./particle";
import { System } from "./system";

/**
 * Serialized representation of an emitter for session saving and undo/redo
 */
export interface SerializedEmitter {
  id: string;
  position: { x: number; y: number };
  rate: number; // particles per second
  direction: number; // angle in radians
  speed: number; // scalar velocity
  amplitude: number; // spread angle in radians
  particleSize: number;
  particleMass: number;
  colors: string[];
  enabled: boolean;
  
  // Lifetime properties
  infinite: boolean; // whether particles live forever
  duration?: number; // particle lifetime in ms
  endSizeMultiplier?: number; // final size multiplier
  endAlpha?: number; // final alpha value
  endColors?: string[]; // array of possible end colors
  endSpeedMultiplier?: number; // final speed multiplier
}

/**
 * Configuration options for creating an emitter
 */
export interface EmitterOptions {
  id?: string;
  position?: Vector2D;
  rate?: number;
  direction?: number;
  speed?: number;
  amplitude?: number;
  particleSize?: number;
  particleMass?: number;
  colors?: string[];
  enabled?: boolean;
  
  // Lifetime properties
  infinite?: boolean; // whether particles live forever
  duration?: number; // particle lifetime in ms
  endSizeMultiplier?: number; // final size multiplier
  endAlpha?: number; // final alpha value
  endColors?: string[]; // array of possible end colors
  endSpeedMultiplier?: number; // final speed multiplier
}

/**
 * Default values for emitter configuration
 */
export const DEFAULT_EMITTER_RATE = 10; // particles per second
export const DEFAULT_EMITTER_DIRECTION = 0; // radians (pointing right)
export const DEFAULT_EMITTER_SPEED = 100; // pixels per second
export const DEFAULT_EMITTER_AMPLITUDE = Math.PI * 2; // 360 degrees in radians
export const DEFAULT_EMITTER_PARTICLE_SIZE = 5;
export const DEFAULT_EMITTER_PARTICLE_MASS = 1;
export const DEFAULT_EMITTER_COLORS: string[] = []; // Empty means use default palette

// Lifetime defaults
export const DEFAULT_EMITTER_INFINITE = true; // particles live forever by default
export const DEFAULT_EMITTER_DURATION = 5000; // 5 seconds when not infinite
export const DEFAULT_EMITTER_END_SIZE_MULTIPLIER = 1; // no size change
export const DEFAULT_EMITTER_END_ALPHA = 1; // no alpha change
export const DEFAULT_EMITTER_END_COLORS: string[] = []; // no end color change
export const DEFAULT_EMITTER_END_SPEED_MULTIPLIER = 1; // no speed change

/**
 * Emitter class that spawns particles continuously at a specified rate
 * 
 * An emitter is an independent entity that creates particles over time with
 * configurable properties like direction, speed, and spread. It's not a force
 * but rather a particle source that integrates with the simulation.
 */
export class Emitter {
  public readonly id: string;
  public position: Vector2D;
  public rate: number;
  public direction: number;
  public speed: number;
  public amplitude: number;
  public particleSize: number;
  public particleMass: number;
  public colors: string[];
  public enabled: boolean;
  
  // Lifetime properties
  public infinite: boolean;
  public duration?: number;
  public endSizeMultiplier: number;
  public endAlpha: number;
  public endColors: string[];
  public endSpeedMultiplier: number;

  private timeSinceLastEmission: number = 0;
  private static nextId: number = 1;

  /**
   * Creates a new emitter instance
   * 
   * @param options Configuration options for the emitter
   */
  constructor(options: EmitterOptions = {}) {
    this.id = options.id || `emitter_${Emitter.nextId++}`;
    this.position = options.position || new Vector2D(0, 0);
    this.rate = options.rate ?? DEFAULT_EMITTER_RATE;
    this.direction = options.direction ?? DEFAULT_EMITTER_DIRECTION;
    this.speed = options.speed ?? DEFAULT_EMITTER_SPEED;
    this.amplitude = options.amplitude ?? DEFAULT_EMITTER_AMPLITUDE;
    this.particleSize = options.particleSize ?? DEFAULT_EMITTER_PARTICLE_SIZE;
    this.particleMass = options.particleMass ?? DEFAULT_EMITTER_PARTICLE_MASS;
    this.colors = options.colors ?? [...DEFAULT_EMITTER_COLORS];
    this.enabled = options.enabled ?? true;
    
    // Initialize lifetime properties
    this.infinite = options.infinite ?? DEFAULT_EMITTER_INFINITE;
    this.duration = options.duration ?? DEFAULT_EMITTER_DURATION;
    this.endSizeMultiplier = options.endSizeMultiplier ?? DEFAULT_EMITTER_END_SIZE_MULTIPLIER;
    this.endAlpha = options.endAlpha ?? DEFAULT_EMITTER_END_ALPHA;
    this.endColors = options.endColors ?? [...DEFAULT_EMITTER_END_COLORS];
    this.endSpeedMultiplier = options.endSpeedMultiplier ?? DEFAULT_EMITTER_END_SPEED_MULTIPLIER;
  }

  /**
   * Updates the emitter, potentially spawning new particles
   * 
   * @param deltaTime Time elapsed since last update in seconds
   * @param system The particle system to spawn particles into
   */
  update(deltaTime: number, system: System): void {
    if (!this.enabled || this.rate <= 0) return;

    this.timeSinceLastEmission += deltaTime;

    // Calculate interval between particle emissions
    const emissionInterval = 1 / this.rate; // seconds per particle

    // Spawn particles if enough time has passed
    while (this.timeSinceLastEmission >= emissionInterval) {
      this.spawnParticle(system);
      this.timeSinceLastEmission -= emissionInterval;
    }
  }

  /**
   * Spawns a single particle from this emitter
   * 
   * @param system The particle system to spawn the particle into
   */
  private spawnParticle(system: System): void {
    // Calculate particle direction based on emitter direction and amplitude
    let particleDirection = this.direction;
    
    if (this.amplitude > 0) {
      // Add random spread within amplitude range
      const randomSpread = (Math.random() - 0.5) * this.amplitude;
      particleDirection = this.direction + randomSpread;
    }

    // Calculate velocity vector
    const velocity = new Vector2D(
      Math.cos(particleDirection) * this.speed,
      Math.sin(particleDirection) * this.speed
    );

    // Select color from palette
    let color: string;
    if (this.colors.length > 0) {
      color = this.colors[Math.floor(Math.random() * this.colors.length)];
    } else {
      // Use default palette
      const defaultPalette = [
        "#F8F8F8", // Bright White
        "#FF3C3C", // Neon Red
        "#00E0FF", // Cyber Cyan
        "#C85CFF", // Electric Purple
        "#AFFF00", // Lime Neon
        "#FF2D95", // Hot Magenta
        "#FF6A00", // Sunset Orange
        "#3B82F6", // Deep Blue Glow
        "#00FFC6", // Turquoise Mint
      ];
      color = defaultPalette[Math.floor(Math.random() * defaultPalette.length)];
    }

    // Create new particle with lifetime properties
    const particle = new Particle({
      position: new Vector2D(this.position.x, this.position.y),
      velocity: velocity,
      acceleration: new Vector2D(0, 0),
      mass: this.particleMass,
      size: this.particleSize,
      color: color,
      // Apply lifetime properties
      duration: this.infinite ? undefined : this.duration,
      endSizeMultiplier: this.endSizeMultiplier,
      endAlpha: this.endAlpha,
      endColor: this.endColors.length > 0 ? [...this.endColors] : undefined,
      endSpeedMultiplier: this.endSpeedMultiplier,
    });

    // Add particle to system
    system.addParticle(particle);
  }

  // Setters for configuration
  setPosition(x: number, y: number): void {
    this.position.set(x, y);
  }

  setRate(rate: number): void {
    this.rate = Math.max(0, rate);
  }

  setDirection(direction: number): void {
    this.direction = direction;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0, speed);
  }

  setAmplitude(amplitude: number): void {
    this.amplitude = Math.max(0, Math.min(Math.PI * 2, amplitude));
  }

  setParticleSize(size: number): void {
    this.particleSize = Math.max(1, size);
  }

  setParticleMass(mass: number): void {
    this.particleMass = Math.max(0.1, mass);
  }

  setColors(colors: string[]): void {
    this.colors = [...colors];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Serializes the emitter for session saving or undo/redo
   * 
   * @returns Serialized emitter data
   */
  serialize(): SerializedEmitter {
    return {
      id: this.id,
      position: { x: this.position.x, y: this.position.y },
      rate: this.rate,
      direction: this.direction,
      speed: this.speed,
      amplitude: this.amplitude,
      particleSize: this.particleSize,
      particleMass: this.particleMass,
      colors: [...this.colors],
      enabled: this.enabled,
      // Include lifetime properties
      infinite: this.infinite,
      duration: this.duration,
      endSizeMultiplier: this.endSizeMultiplier,
      endAlpha: this.endAlpha,
      endColors: [...this.endColors],
      endSpeedMultiplier: this.endSpeedMultiplier,
    };
  }

  /**
   * Creates an emitter from serialized data
   * 
   * @param data Serialized emitter data
   * @returns New emitter instance
   */
  static deserialize(data: SerializedEmitter): Emitter {
    return new Emitter({
      id: data.id,
      position: new Vector2D(data.position.x, data.position.y),
      rate: data.rate,
      direction: data.direction,
      speed: data.speed,
      amplitude: data.amplitude,
      particleSize: data.particleSize,
      particleMass: data.particleMass,
      colors: [...data.colors],
      enabled: data.enabled,
      // Include lifetime properties with fallbacks for backward compatibility
      infinite: data.infinite ?? DEFAULT_EMITTER_INFINITE,
      duration: data.duration ?? DEFAULT_EMITTER_DURATION,
      endSizeMultiplier: data.endSizeMultiplier ?? DEFAULT_EMITTER_END_SIZE_MULTIPLIER,
      endAlpha: data.endAlpha ?? DEFAULT_EMITTER_END_ALPHA,
      endColors: data.endColors ? [...data.endColors] : [...DEFAULT_EMITTER_END_COLORS],
      endSpeedMultiplier: data.endSpeedMultiplier ?? DEFAULT_EMITTER_END_SPEED_MULTIPLIER,
    });
  }

  /**
   * Creates a copy of this emitter
   * 
   * @returns Cloned emitter instance
   */
  clone(): Emitter {
    return Emitter.deserialize(this.serialize());
  }

  /**
   * Resets the static ID counter (for testing purposes)
   */
  static resetIdCounter(): void {
    Emitter.nextId = 1;
  }
}