import { Particle } from "./particle";
import { SpatialGrid } from "./spatial-grid";

export interface Force {
  warmup?(particles: Particle[], deltaTime: number): void;
  apply(particle: Particle, spatialGrid: SpatialGrid): void;
}

// Default constants for ParticleSystem
export const DEFAULT_SPATIAL_GRID_CELL_SIZE = 100;

export interface SystemOptions {
  width: number;
  height: number;
  cellSize?: number;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public forces: Force[] = [];
  public spatialGrid: SpatialGrid;
  public width: number;
  public height: number;
  public isPlaying: boolean = false;

  private lastTime: number = 0;
  private animationId: number | null = null;

  private renderCallback?: (system: ParticleSystem) => void;

  constructor(options: SystemOptions) {
    this.width = options.width;
    this.height = options.height;

    this.spatialGrid = new SpatialGrid({
      width: this.width,
      height: this.height,
      cellSize: options.cellSize ?? DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
  }

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
    // Clear and repopulate spatial grid
    this.spatialGrid.clear();

    for (const particle of this.particles) {
      this.spatialGrid.insert(particle);
    }

    for (const force of this.forces) {
      force.warmup?.(this.particles, deltaTime);
    }

    for (const particle of this.particles) {
      for (const force of this.forces) {
        force.apply(particle, this.spatialGrid);
      }
      particle.update(deltaTime);
    }
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
    this.spatialGrid.clear();
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.spatialGrid.setSize(width, height);
  }

  private animate = (): void => {
    if (!this.isPlaying) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);

    this.animationId = requestAnimationFrame(this.animate);

    if (this.renderCallback) {
      this.renderCallback(this);
    }
  };

  setRenderCallback(callback: (system: ParticleSystem) => void): void {
    this.renderCallback = callback;
  }

  clearRenderCallback(): void {
    this.renderCallback = undefined;
  }
}
