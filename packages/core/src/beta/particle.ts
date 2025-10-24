import { IParticle } from "./interfaces";
import { Vector } from "./vector";

let idCounter = 0;

export class Particle implements IParticle {
  public id: number;
  public position: Vector;
  public velocity: Vector;
  public acceleration: Vector;
  public size: number;
  public mass: number;
  public color: { r: number; g: number; b: number; a: number };

  constructor(options: IParticle) {
    this.id = idCounter++;
    this.position = new Vector(options.position.x, options.position.y);
    this.velocity = new Vector(options.velocity.x, options.velocity.y);
    this.acceleration = new Vector(0, 0);
    this.size = options.size;
    this.mass = options.mass;
    this.color = options.color;
  }

  toJSON(): IParticle {
    return {
      position: this.position.toJSON(),
      velocity: this.velocity.toJSON(),
      size: this.size,
      mass: this.mass,
      color: this.color,
    };
  }
}
