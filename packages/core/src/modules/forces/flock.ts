import { Particle } from "../particle.js";
import { Force } from "../system.js";
import { Vector2D } from "../vector.js";

export class Flock implements Force {
  maxSpeed: number;

  constructor(options: { maxSpeed?: number } = {}) {
    this.maxSpeed = options.maxSpeed ?? 12;
  }

  separate(particle: Particle, neighbors: Particle[], range: number): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        const d = particle.position.distance(neighbor.position);
        if (d < range) {
          const diff = particle.position.clone().subtract(neighbor.position);
          diff.normalize();
          if (d > 0) {
            diff.divide(d);
            sum.add(diff);
          }
        }
      }
      sum.divide(neighbors.length);
      sum.normalize();
      sum.multiply(this.maxSpeed);
      sum.subtract(particle.velocity);
      sum.limit(this.maxSpeed);
    }

    return sum;
  }

  align(particle: Particle, neighbors: Particle[]): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.velocity);
      }
      sum.divide(neighbors.length);
      sum.normalize();
      sum.multiply(this.maxSpeed);

      sum.subtract(particle.velocity).limit(this.maxSpeed);
    }

    return sum;
  }

  cohesion(particle: Particle, neighbors: Particle[]): Vector2D {
    const sum = new Vector2D(0, 0);

    if (neighbors.length) {
      for (const neighbor of neighbors) {
        sum.add(neighbor.position);
      }
      sum.divide(neighbors.length);
      return this.seek(particle, sum);
    }

    return sum;
  }

  seek(particle: Particle, target: Vector2D): Vector2D {
    const seek = target.clone().subtract(particle.position);
    seek.normalize();
    seek.multiply(this.maxSpeed);
    seek.subtract(particle.velocity).limit(this.maxSpeed);

    return seek;
  }

  apply(
    particle: Particle,
    _deltaTime: number,
    _index: number,
    particles: Particle[]
  ) {
    const neighbors = particles
      .filter((p) => p !== particle)
      .filter((p) => particle.position.distance(p.position) < 100);

    const separate = this.separate(particle, neighbors, 30);
    const align = this.align(particle, neighbors);
    const cohesion = this.cohesion(particle, neighbors);

    cohesion.multiply(0.01);
    separate.multiply(0.02);
    align.multiply(0.01);

    particle.applyForce(separate);
    particle.applyForce(align);
    particle.applyForce(cohesion);

    return Vector2D.zero();
  }
}
