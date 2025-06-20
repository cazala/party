import { Particle } from "./particle.js";
import { Vector2D } from "./vector.js";

export interface Force {
  apply(
    particle: Particle,
    deltaTime: number,
    index: number,
    particles: Particle[]
  ): Vector2D;
}

export interface SystemOptions {}

export class ParticleSystem {
  public particles: Particle[] = [];
  public forces: Force[] = [];
  public isPlaying: boolean = false;

  private lastTime: number = 0;
  private animationId: number | null = null;

  constructor() {}

  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  addParticles(particles: Particle[]): void {
    for (const particle of particles) {
      this.addParticle(particle);
    }
  }

  removeParticle(index: number): void {
    if (index >= 0 && index < this.particles.length) {
      this.particles.splice(index, 1);
    }
  }

  addForce(force: Force): void {
    this.forces.push(force);
  }

  removeForce(force: Force): void {
    const index = this.forces.indexOf(force);
    if (index > -1) {
      this.forces.splice(index, 1);
    }
  }

  clearForces(): void {
    this.forces = [];
  }

  update(deltaTime: number): void {
    this.particles.forEach((particle, i) => {
      this.forces.forEach((force) => {
        const forceVector = force.apply(particle, deltaTime, i, this.particles);
        particle.applyForce(forceVector);
      });

      particle.update(deltaTime);
    });
  }

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastTime = performance.now();
    this.animate();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  reset(): void {
    this.pause();
    this.particles = [];
    this.lastTime = 0;
  }

  clear(): void {
    this.particles = [];
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  private animate = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);

    this.animationId = requestAnimationFrame(this.animate);
  };
}
