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
    this.velocity = this.velocity.add(this.acceleration.multiply(deltaTime));
    this.position = this.position.add(this.velocity.multiply(deltaTime));
    this.acceleration = Vector2D.zero();
  }

  applyForce(force: Vector2D): void {
    const f = force.divide(this.mass);
    this.acceleration = this.acceleration.add(f);
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
