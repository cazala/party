import { Vector2D } from "./vector";

export interface ParticleOptions {
  position?: Vector2D;
  velocity?: Vector2D;
  acceleration?: Vector2D;
  mass?: number;
  size?: number;
  color?: string;
  id?: number; // Optional ID for restoring particles
  static?: boolean; // If true, particle is not affected by forces but still affects others
  grabbed?: boolean; // If true, particle is being grabbed by user
}

let idCounter = 0;

export class Particle {
  public id: number;
  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;
  public mass: number;
  public size: number;
  public color: string;
  public density?: number;
  public static?: boolean;
  public grabbed?: boolean;

  constructor(options: ParticleOptions = {}) {
    this.id = options.id !== undefined ? options.id : idCounter++;
    this.position = options.position || new Vector2D();
    this.velocity = options.velocity || new Vector2D();
    this.acceleration = options.acceleration || new Vector2D();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.static = options.static || false;
    this.grabbed = options.grabbed || false;
  }

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

  applyForce(force: Vector2D): void {
    if (this.mass <= 0) {
      return; // Skip force application for zero or negative mass particles
    }
    const f = force.clone().divide(this.mass);
    this.acceleration.add(f);
  }

  reset(options: ParticleOptions = {}): void {
    this.position = options.position || new Vector2D();
    this.velocity = options.velocity || new Vector2D();
    this.acceleration = options.acceleration || new Vector2D();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
    this.static = options.static || false;
  }

  clone(): Particle {
    return new Particle({
      id: this.id, // Preserve the original ID
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      acceleration: this.acceleration.clone(),
      mass: this.mass,
      size: this.size,
      color: this.color,
      static: this.static,
    });
  }
}

// ID counter management for undo/redo functionality
export function getIdCounter(): number {
  return idCounter;
}

export function setIdCounter(value: number): void {
  idCounter = value;
}
