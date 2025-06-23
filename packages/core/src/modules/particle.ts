import { Vector2D } from "./vector.js";

export interface ParticleOptions {
  position?: Vector2D;
  velocity?: Vector2D;
  acceleration?: Vector2D;
  mass?: number;
  size?: number;
  color?: string;
}

export class Particle {
  public position: Vector2D;
  public velocity: Vector2D;
  public acceleration: Vector2D;
  public mass: number;
  public size: number;
  public color: string;

  constructor(options: ParticleOptions = {}) {
    this.position = options.position || new Vector2D();
    this.velocity = options.velocity || new Vector2D();
    this.acceleration = options.acceleration || new Vector2D();
    this.mass = options.mass || 1;
    this.size = options.size || 5;
    this.color = options.color || "#ffffff";
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
  }

  clone(): Particle {
    return new Particle({
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      acceleration: this.acceleration.clone(),
      mass: this.mass,
      size: this.size,
      color: this.color,
    });
  }
}
