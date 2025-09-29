import { AbstractEngine, IParticle } from "../../interfaces";
import { Module, ModuleRole, CanvasComposition } from "../../module";
import { SpatialGrid } from "./spatial-grid";
import { Particle } from "../../particle";
import { Vector } from "../../vector";

export class CPUEngine extends AbstractEngine {
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement;
  private grid: SpatialGrid;
  private animationId: number | null = null;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
  }) {
    super(options);
    this.canvas = options.canvas;
    this.grid = new SpatialGrid({
      width: this.canvas.width,
      height: this.canvas.height,
      cellSize: this.cellSize,
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

  // Implement abstract methods for animation loop
  protected startAnimationLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  protected stopAnimationLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Resets animation timing to prevent large deltaTime spikes.
   * Useful when starting after engine restoration or long pauses.
   */
  public resetTiming(): void {
    this.lastTime = performance.now();
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
    this.grid.clear();
    this.fpsEstimate = 60;
    // Reset maxSize tracking
    this.resetMaxSize();
  }

  getCount(): number {
    return this.particles.length;
  }

  // Override setSize to also update spatial grid
  setSize(width: number, height: number): void {
    this.view.setSize(width, height);
    this.grid.setSize(width, height);
  }

  setParticles(particle: IParticle[]): void {
    this.particles = particle.map((p) => new Particle(p));
    // Update maxSize tracking
    this.resetMaxSize();
    for (const p of particle) {
      this.updateMaxSize(p.size);
    }
  }

  addParticle(particle: IParticle): void {
    this.particles.push(new Particle(particle));
    // Update maxSize tracking
    this.updateMaxSize(particle.size);
  }

  getParticles(): Promise<IParticle[]> {
    return Promise.resolve(this.particles.map((p) => p.toJSON()));
  }

  getParticle(index: number): Promise<IParticle> {
    return Promise.resolve(this.particles[index]);
  }

  destroy(): void {
    this.pause();
    this.particles = [];
    this.grid.clear();
  }

  // Handle configuration changes
  protected onClearColorChanged(): void {
    // Clear color changes don't require any immediate system updates
    // The new color will be used in the next render pass
  }

  protected onCellSizeChanged(): void {
    // Rebuild spatial grid with new cell size
    this.grid.setCellSize(this.cellSize);
  }

  protected onConstrainIterationsChanged(): void {
    // Constrain iterations changes don't require any immediate system updates
    // The new value will be used in the next simulation pass
  }

  private animate = (): void => {
    const dt = this.getTimeDelta();
    this.updateFPS(dt);

    if (this.playing) {
      this.update(dt);
    }

    this.render();

    this.animationId = requestAnimationFrame(this.animate);
  };

  private getNeighbors(position: { x: number; y: number }, radius: number) {
    return this.grid.getParticles(new Vector(position.x, position.y), radius);
  }

  private getImageData(
    x: number,
    y: number,
    width: number,
    height: number
  ): ImageData | null {
    try {
      const context = this.canvas.getContext("2d")!;

      // Clamp to canvas bounds
      const clampedX = Math.max(0, Math.min(x, this.canvas.width));
      const clampedY = Math.max(0, Math.min(y, this.canvas.height));
      const clampedWidth = Math.max(
        0,
        Math.min(width, this.canvas.width - clampedX)
      );
      const clampedHeight = Math.max(
        0,
        Math.min(height, this.canvas.height - clampedY)
      );

      if (clampedWidth <= 0 || clampedHeight <= 0) {
        return null;
      }

      return context.getImageData(
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight
      );
    } catch (error) {
      return null;
    }
  }

  private update(dt: number): void {
    // Update spatial grid with current particle positions and camera
    this.grid.setCamera(
      this.view.getCamera().x,
      this.view.getCamera().y,
      this.view.getZoom()
    );
    this.grid.clear();
    for (const particle of this.particles) {
      this.grid.insert(particle);
    }

    // Global state for modules that need it
    const globalState: Record<number, Record<string, number>> = {};

    // Position tracking for correct pass
    const positionState: Map<
      number,
      { prev: { x: number; y: number }; post: { x: number; y: number } }
    > = new Map();

    // Get neighbors function
    const getNeighbors = (position: { x: number; y: number }, radius: number) =>
      this.getNeighbors(position, radius);

    // Image data access function
    const getImageData = (
      x: number,
      y: number,
      width: number,
      height: number
    ) => this.getImageData(x, y, width, height);

    // First pass: state computation for all modules
    for (const module of this.modules) {
      try {
        // Skip disabled modules
        if (!module.isEnabled()) continue;

        const descriptor = module.cpu();
        if (module.role === ModuleRole.Force && (descriptor as any).state) {
          const force = descriptor as any;
          const input: Record<string, number | number[]> = {};
          for (const key of Object.keys(module.inputs)) {
            const value = module.read()[key];
            input[key] = value ?? 0;
          }
          // Always add enabled
          input.enabled = module.isEnabled() ? 1 : 0;

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
              getNeighbors,
              input,
              setState,
              view: this.view,
              getImageData,
            });
          }
        }
      } catch (error) {}
    }

    // Second pass: apply forces for all modules
    for (const module of this.modules) {
      try {
        // Skip disabled modules
        if (!module.isEnabled()) continue;

        const descriptor = module.cpu();
        if (module.role === ModuleRole.Force && (descriptor as any).apply) {
          const force = descriptor as any;
          const input: Record<string, number | number[]> = {};
          for (const key of Object.keys(module.inputs)) {
            const value = module.read()[key];
            input[key] = value ?? 0;
          }
          // Always add enabled
          input.enabled = module.isEnabled() ? 1 : 0;

          for (const particle of this.particles) {
            const getState = (name: string, pid?: number) => {
              return globalState[pid ?? particle.id]?.[name] ?? 0;
            };

            force.apply({
              particle: particle,
              dt,
              maxSize: this.getMaxSize(),
              getNeighbors,
              input,
              getState,
              view: this.view,
              getImageData,
            });
          }
        }
      } catch (error) {}
    }

    // Third pass: integration (once per particle)
    for (const particle of this.particles) {
      // Capture position before integration
      const prevPos = { x: particle.position.x, y: particle.position.y };

      particle.velocity.add(particle.acceleration.clone().multiply(dt));
      particle.position.add(particle.velocity.clone().multiply(dt));
      particle.acceleration.zero();

      // Capture position after integration
      const postPos = { x: particle.position.x, y: particle.position.y };
      positionState.set(particle.id, { prev: prevPos, post: postPos });
    }

    // Fourth pass: constraints for all modules (multiple iterations)
    const iterations = Math.max(1, this.constrainIterations);
    for (let iter = 0; iter < iterations; iter++) {
      for (const module of this.modules) {
        try {
          // Skip disabled modules
          if (!module.isEnabled()) continue;

          const descriptor = module.cpu();
          if (
            module.role === ModuleRole.Force &&
            (descriptor as any).constrain
          ) {
            const force = descriptor as any;
            const input: Record<string, number | number[]> = {};
            for (const key of Object.keys(module.inputs)) {
              const value = module.read()[key];
              input[key] = value ?? 0;
            }
            // Always add enabled
            input.enabled = module.isEnabled() ? 1 : 0;
            for (const particle of this.particles) {
              const getState = (name: string, pid?: number) => {
                return globalState[pid ?? particle.id]?.[name] ?? 0;
              };

              force.constrain({
                particle: particle,
                getNeighbors,
                dt: dt,
                maxSize: this.getMaxSize(),
                input,
                getState,
                view: this.view,
              });
            }
          }
        } catch (error) {}
      }
    }

    // Fifth pass: corrections for all modules
    for (const module of this.modules) {
      try {
        // Skip disabled modules
        if (!module.isEnabled()) continue;

        const descriptor = module.cpu();
        if (module.role === ModuleRole.Force && (descriptor as any).correct) {
          const force = descriptor as any;
          const input: Record<string, number | number[]> = {};
          for (const key of Object.keys(module.inputs)) {
            const value = module.read()[key];
            input[key] = value ?? 0;
          }
          // Always add enabled
          input.enabled = module.isEnabled() ? 1 : 0;

          for (let index = 0; index < this.particles.length; index++) {
            const particle = this.particles[index];
            const getState = (name: string, pid?: number) => {
              return globalState[pid ?? particle.id]?.[name] ?? 0;
            };

            const positions = positionState.get(particle.id);
            const prevPos = positions?.prev ?? {
              x: particle.position.x,
              y: particle.position.y,
            };
            const postPos = positions?.post ?? {
              x: particle.position.x,
              y: particle.position.y,
            };

            force.correct({
              particle: particle,
              getNeighbors,
              dt: dt,
              maxSize: this.getMaxSize(),
              prevPos,
              postPos,
              input,
              getState,
              view: this.view,
              index,
            });
          }
        }
      } catch (error) {}
    }

    // remove dead particles
    this.removeDeadParticles();
  }

  private createRenderUtils(context: CanvasRenderingContext2D) {
    return {
      formatColor: (color: {
        r: number;
        g: number;
        b: number;
        a: number;
      }): string => {
        return `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${
          color.a
        })`;
      },
      drawCircle: (
        x: number,
        y: number,
        radius: number,
        color: { r: number; g: number; b: number; a: number }
      ): void => {
        context.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${
          color.b * 255
        }, ${color.a})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      },
      drawRect: (
        x: number,
        y: number,
        width: number,
        height: number,
        color: { r: number; g: number; b: number; a: number }
      ): void => {
        context.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${
          color.b * 255
        }, ${color.a})`;
        context.fillRect(x, y, width, height);
      },
    };
  }

  private render(): void {
    const context = this.canvas.getContext("2d")!;

    // Get camera and canvas info for coordinate transformation
    const camera = this.view.getCamera();
    const zoom = this.view.getZoom();
    const size = this.view.getSize();
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const utils = this.createRenderUtils(context);

    // Check composition requirements of enabled render modules
    const hasBackgroundHandler = this.modules.some((module) => {
      if (!module.isEnabled() || module.role !== ModuleRole.Render)
        return false;
      const descriptor = module.cpu() as any;
      return descriptor.composition === CanvasComposition.HandlesBackground;
    });

    // Only clear canvas if no module handles background AND some module requires clearing
    if (!hasBackgroundHandler) {
      const needsClearing = this.modules.some((module) => {
        if (!module.isEnabled() || module.role !== ModuleRole.Render)
          return false;
        const descriptor = module.cpu() as any;
        return descriptor.composition === CanvasComposition.RequiresClear;
      });

      if (needsClearing) {
        context.fillStyle = `rgba(${this.clearColor.r * 255}, ${
          this.clearColor.g * 255
        }, ${this.clearColor.b * 255}, ${this.clearColor.a})`;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      }
    }

    for (const module of this.modules) {
      try {
        // Skip disabled modules
        if (!module.isEnabled()) continue;

        const descriptor = module.cpu();
        if (module.role === ModuleRole.Render) {
          const render = descriptor as any;
          // input
          const input: Record<string, number | number[]> = {};
          for (const key of Object.keys(module.inputs)) {
            const value = module.read()[key];
            input[key] = value ?? 0;
          }
          // Always add enabled
          input.enabled = module.isEnabled() ? 1 : 0;

          // Setup phase
          render.setup?.({
            context,
            input,
            view: this.view,
            clearColor: this.clearColor,
            utils,
          });

          // Render each visible particle
          for (const particle of this.particles) {
            // Transform world position to screen position
            const worldX = (particle.position.x - camera.x) * zoom;
            const worldY = (particle.position.y - camera.y) * zoom;
            const screenX = centerX + worldX;
            const screenY = centerY + worldY;
            const screenSize = particle.size * zoom;

            // Skip rendering if particle is outside canvas bounds (culling)
            if (
              screenX + screenSize < 0 ||
              screenX - screenSize > size.width ||
              screenY + screenSize < 0 ||
              screenY - screenSize > size.height
            ) {
              continue;
            }

            render.render?.({
              context,
              particle,
              screenX,
              screenY,
              screenSize,
              input,
              utils,
            });
          }

          // Teardown phase
          render.teardown?.({
            context,
            input,
            utils,
          });
        }
      } catch (error) {}
    }
  }
}
