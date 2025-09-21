import { IEngine, IParticle } from "../../interfaces";
import { Module, ModuleRole } from "../../module";
import { SpatialGrid } from "./spatial-grid";
import { View } from "../../view";
import { Particle } from "../../particle";
import { Vector } from "../../vector";
import { DEFAULTS } from "../../config";

export class CPUEngine implements IEngine {
  private particles: Particle[] = [];
  private modules: Module[] = [];
  private canvas: HTMLCanvasElement;
  private spatialGrid: SpatialGrid;
  private view: View;
  private isPlaying: boolean = false;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private fpsEstimate: number = 60;
  private fpsSmoothing: number = 0.15;

  constructor(options: { canvas: HTMLCanvasElement; modules: Module[] }) {
    this.canvas = options.canvas;
    this.modules = options.modules;
    this.view = new View(this.canvas.width, this.canvas.height);
    this.spatialGrid = new SpatialGrid({
      width: this.canvas.width,
      height: this.canvas.height,
      cellSize: 100,
    });
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  private removeDeadParticles(): void {
    // Check if any particles need removal first
    let foundDeadParticle = false;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.mass <= 0) {
        foundDeadParticle = true;
        break;
      }
    }

    if (!foundDeadParticle) return;

    // Use in-place filtering to avoid creating new arrays
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.particles.length; readIndex++) {
      const particle = this.particles[readIndex];
      if (particle.mass > 0) {
        if (writeIndex !== readIndex) {
          this.particles[writeIndex] = particle;
        }
        writeIndex++;
      }
    }

    // Truncate array to new length
    this.particles.length = writeIndex;
  }

  /**
   * Starts the simulation animation loop.
   * If already playing, this method does nothing.
   */
  public play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  /**
   * Pauses the simulation animation loop.
   * The simulation state is preserved and can be resumed with play().
   */
  public pause(): void {
    this.isPlaying = false;
  }

  /**
   * Toggles the simulation between playing and paused states.
   */
  public toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Resets the simulation to its initial state.
   *
   * This method:
   * - Pauses the simulation
   * - Clears all particles
   * - Resets timing and FPS data
   * - Clears force-specific caches
   */
  public reset(): void {
    this.pause();
    // Ensure animation frame is properly cancelled
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.particles = [];
    this.lastTime = 0;
    // Clear FPS tracking data
    this.fpsEstimate = 60;
  }

  clear(): void {
    this.particles = [];
    this.spatialGrid.clear();
    this.fpsEstimate = 60;
  }

  getCount(): number {
    return this.particles.length;
  }

  getFPS(): number {
    return this.fpsEstimate;
  }

  getSize(): { width: number; height: number } {
    return this.view.getSize();
  }

  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.spatialGrid.setSize(width, height);
  }

  setCamera(x: number, y: number): void {
    this.view.setCamera(x, y);
  }

  getCamera(): { x: number; y: number } {
    return this.view.getCamera();
  }

  setZoom(zoom: number): void {
    this.view.setZoom(zoom);
  }

  getZoom(): number {
    return this.view.getZoom();
  }

  setParticles(particle: IParticle[]): void {
    this.particles = particle.map((p) => new Particle(p));
  }

  addParticle(particle: IParticle): void {
    this.particles.push(new Particle(particle));
  }

  getParticles(): IParticle[] {
    return this.particles.map((p) => p.toJSON());
  }

  getParticle(index: number): IParticle {
    return this.particles[index];
  }

  destroy(): void {
    this.pause();
    this.particles = [];
    this.spatialGrid.clear();
  }

  private animate = (): void => {
    const time = performance.now();
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Update FPS calculation
    if (dt > 0) {
      const instantFps = 1 / dt;
      this.fpsEstimate =
        this.fpsEstimate * (1 - this.fpsSmoothing) +
        instantFps * this.fpsSmoothing;
    }

    if (this.isPlaying) {
      this.update(dt);
    }

    this.render();

    this.animationId = requestAnimationFrame(this.animate);
  };

  private getNeighbors(position: { x: number; y: number }, radius: number) {
    return this.spatialGrid.getParticles(
      new Vector(position.x, position.y),
      radius
    );
  }

  private update(dt: number): void {
    // Global state for modules that need it
    const globalState: Record<number, Record<string, number>> = {};

    // First pass: state computation for all modules
    for (const module of this.modules) {
      try {
        const force = module.cpu();
        if (force.role === ModuleRole.Force && force.state) {
          const input: Record<string, number> = {};
          for (const key of force.keys ?? []) {
            input[key] = module.read()[key] ?? 0;
          }

          for (const particle of this.particles) {
            const setState = (name: string, value: number) => {
              if (!globalState[particle.id]) {
                globalState[particle.id] = {};
              }
              globalState[particle.id][name] = value;
            };

            force.state({
              particle: particle,
              dt,
              getNeighbors: this.getNeighbors,
              input,
              setState,
              view: this.view,
            });
          }
        }
      } catch (error) {}
    }

    // Second pass: apply forces for all modules
    for (const module of this.modules) {
      try {
        const force = module.cpu();
        if (force.role === ModuleRole.Force && force.apply) {
          const input: Record<string, number> = {};
          for (const key of force.keys ?? []) {
            input[key] = module.read()[key] ?? 0;
          }

          for (const particle of this.particles) {
            const getState = (name: string, pid?: number) => {
              return globalState[pid ?? particle.id]?.[name] ?? 0;
            };

            force.apply({
              particle: particle,
              dt,
              getNeighbors: this.getNeighbors,
              input,
              getState,
              view: this.view,
            });
          }
        }
      } catch (error) {}
    }

    // Third pass: integration (once per particle)
    for (const particle of this.particles) {
      particle.velocity.add(particle.acceleration.clone().multiply(dt));
      particle.position.add(particle.velocity.clone().multiply(dt));
      particle.acceleration.zero();
    }

    // Fourth pass: constraints for all modules
    for (const module of this.modules) {
      try {
        const force = module.cpu();
        if (force.role === ModuleRole.Force && force.constrain) {
          const input: Record<string, number> = {};
          for (const key of force.keys ?? []) {
            input[key] = module.read()[key] ?? 0;
          }

          for (const particle of this.particles) {
            const getState = (name: string, pid?: number) => {
              return globalState[pid ?? particle.id]?.[name] ?? 0;
            };

            force.constrain({
              particle: particle,
              getNeighbors: this.getNeighbors,
              dt: dt,
              input,
              getState,
              view: this.view,
            });
          }
        }
      } catch (error) {}
    }

    // Fifth pass: corrections for all modules
    for (const module of this.modules) {
      try {
        const force = module.cpu();
        if (force.role === ModuleRole.Force && force.correct) {
          const input: Record<string, number> = {};
          for (const key of force.keys ?? []) {
            input[key] = module.read()[key] ?? 0;
          }

          for (const particle of this.particles) {
            const getState = (name: string, pid?: number) => {
              return globalState[pid ?? particle.id]?.[name] ?? 0;
            };

            force.correct({
              particle: particle,
              getNeighbors: this.getNeighbors,
              dt: dt,
              input,
              getState,
              view: this.view,
            });
          }
        }
      } catch (error) {}
    }

    // remove dead particles
    this.removeDeadParticles();
  }

  private render(): void {
    for (const module of this.modules) {
      try {
        const render = module.cpu();
        if (render.role === ModuleRole.Render) {
          // input
          const input: Record<string, number> = {};
          for (const key of render.keys ?? []) {
            input[key] = module.read()[key] ?? 0;
          }

          render.render({
            context: this.canvas.getContext("2d")!,
            input,
            view: this.view,
            clearColor: DEFAULTS.clearColor,
            particles: this.particles,
          });
        }
      } catch (error) {}
    }
  }
}
