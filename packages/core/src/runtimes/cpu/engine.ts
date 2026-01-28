import {
  AbstractEngine,
  GetParticlesInRadiusOptions,
  GetParticlesInRadiusResult,
  IParticle,
  ParticleQuery,
} from "../../interfaces";
import {
  Module,
  ModuleRole,
  CanvasComposition,
  CPURenderDescriptor,
  CPUForceDescriptor,
  CPUGridDescriptor,
  GridSpec,
} from "../../module";
import { SpatialGrid } from "./spatial-grid";
import { Particle } from "../../particle";
import { Vector } from "../../vector";
import { GridStore, resampleGridBuffer } from "../../grid/store";

export class CPUEngine extends AbstractEngine {
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement;
  private grid: SpatialGrid;
  private animationId: number | null = null;
  private particleIdToIndex: Map<number, number> = new Map();
  private gridStores: Map<string, GridStore> = new Map();
  private gridInitialized: Set<string> = new Set();
  private lastGridResizeAt = 0;
  private gridResizeCooldownMs = 150;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    grids?: Module[];
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
    this.setupGridStores();
    return Promise.resolve();
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
    this.particleIdToIndex.clear();
    for (const store of this.gridStores.values()) {
      (store.readBuffer as any).fill(0);
      (store.writeBuffer as any).fill(0);
    }
    this.gridInitialized.clear();
  }

  getCount(): number {
    const actualCount = this.particles.length;
    if (this.maxParticles === null) {
      return actualCount;
    }
    return Math.min(actualCount, this.maxParticles);
  }

  protected getEffectiveCount(): number {
    return this.getCount();
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
    this.particleIdToIndex.clear();
  }

  addParticle(particle: IParticle): number {
    const index = this.particles.length;
    this.particles.push(new Particle(particle));
    // Update maxSize tracking
    this.updateMaxSize(particle.size);
    const created = this.particles[index];
    if (created) this.particleIdToIndex.set(created.id, index);
    return index;
  }

  setParticle(index: number, p: IParticle): void {
    if (index < 0) return;
    if (index >= this.particles.length) return;
    this.particles[index] = new Particle(p);
    // Best-effort maxSize tracking (monotonic)
    this.updateMaxSize(p.size);
  }

  setParticleMass(index: number, mass: number): void {
    if (index < 0) return;
    if (index >= this.particles.length) return;
    this.particles[index].mass = mass;
  }

  getParticles(): Promise<IParticle[]> {
    return Promise.resolve(this.particles.map((p) => p.toJSON()));
  }

  getParticle(index: number): Promise<IParticle> {
    return Promise.resolve(this.particles[index]);
  }

  getGrid(moduleName: string): Promise<ArrayBufferView> {
    const store = this.gridStores.get(moduleName);
    if (!store) {
      return Promise.reject(new Error(`Grid module not found: ${moduleName}`));
    }
    const buffer = store.readBuffer as any;
    return Promise.resolve(buffer.slice ? buffer.slice() : buffer);
  }

  setGrid(moduleName: string, data: ArrayBufferView): void {
    const store = this.gridStores.get(moduleName);
    if (!store) return;
    const target = store.readBuffer as any;
    const src = data as any;
    const len = Math.min(target.length ?? 0, src.length ?? 0);
    for (let i = 0; i < len; i++) {
      target[i] = src[i];
    }
    const targetWrite = store.writeBuffer as any;
    for (let i = 0; i < len; i++) {
      targetWrite[i] = src[i];
    }
  }

  async getParticlesInRadius(
    center: { x: number; y: number },
    radius: number,
    opts?: GetParticlesInRadiusOptions
  ): Promise<GetParticlesInRadiusResult> {
    const maxResults = Math.max(1, Math.floor(opts?.maxResults ?? 20000));

    // Expand search radius to ensure we can find large particles whose discs
    // intersect the query circle: dist <= radius + p.size.
    const searchRadius = Math.max(0, radius) + this.getMaxSize();

    // Use the existing spatial grid (built during the last simulation tick).
    // Snapshot semantics: this is "as of last grid build" which is good enough
    // for tool usage and avoids global scans.
    const neighbors = this.grid.getParticles(
      new Vector(center.x, center.y),
      searchRadius,
      // Ask for up to maxResults+1 so we can mark truncated more reliably.
      maxResults + 1
    );

    const out: ParticleQuery[] = [];
    const r = Math.max(0, radius);
    for (const p of neighbors) {
      if (p.mass === 0) continue;
      const index = this.particleIdToIndex.get(p.id);
      if (index === undefined) continue;
      const dx = p.position.x - center.x;
      const dy = p.position.y - center.y;
      const rr = r + p.size;
      if (dx * dx + dy * dy <= rr * rr) {
        out.push({
          index,
          position: { x: p.position.x, y: p.position.y },
          size: p.size,
          mass: p.mass,
        });
        if (out.length >= maxResults + 1) break;
      }
    }

    const truncated = out.length > maxResults;
    return { particles: truncated ? out.slice(0, maxResults) : out, truncated };
  }

  destroy(): Promise<void> {
    this.pause();
    this.particles = [];
    this.grid.clear();
    this.particleIdToIndex.clear();
    return Promise.resolve();
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

  protected onMaxNeighborsChanged(): void {
    // No additional state to update on CPU when max neighbors changes
  }

  protected onMaxParticlesChanged(): void {
    // No additional state to update on CPU when max particles changes
  }

  protected onModuleSettingsChanged(): void {
    this.updateGridStoresForView();
  }

  protected onViewChanged(): void {
    this.updateGridStoresForView();
  }

  private animate = (): void => {
    const dt = this.getTimeDelta();
    this.updateFPS(dt);

    if (this.playing) {
      // Update engine-owned oscillators before module updates
      this.updateOscillators(dt);
      this.update(dt);
    }

    this.render();

    this.animationId = requestAnimationFrame(this.animate);
  };

  private getNeighbors(position: { x: number; y: number }, radius: number) {
    return this.grid.getParticles(
      new Vector(position.x, position.y),
      radius,
      this.getMaxNeighbors()
    );
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
    const effectiveCount = this.getEffectiveCount();

    this.updateGridStoresForView();
    this.stepGrids(dt);
    
    // Update spatial grid with current particle positions and camera
    this.grid.setCamera(
      this.view.getCamera().x,
      this.view.getCamera().y,
      this.view.getZoom()
    );
    this.grid.clear();
    this.particleIdToIndex.clear();
    for (let i = 0; i < effectiveCount; i++) {
      this.grid.insert(this.particles[i]);
      this.particleIdToIndex.set(this.particles[i].id, i);
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
        if (module.role === ModuleRole.Force) {
          const force = module.cpu() as CPUForceDescriptor;
          if (force.state) {
            const input: Record<string, number | number[]> = {};
            for (const key of Object.keys(module.inputs)) {
              const value = module.read()[key];
              input[key] = value ?? 0;
            }
            // Always add enabled
            input.enabled = module.isEnabled() ? 1 : 0;

            for (let pi = 0; pi < effectiveCount; pi++) {
              const particle = this.particles[pi];
              if (particle.mass <= 0) continue;
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
                index: pi,
                particles: this.particles,
                getImageData,
                getGrid: (name: string) => this.gridStores.get(name),
              });
            }
          }
        }
      } catch (error) {}
    }

    // Second pass: apply forces for all modules
    for (const module of this.modules) {
      try {
        // Skip disabled modules
        if (!module.isEnabled()) continue;
        if (module.role === ModuleRole.Force) {
          const force = module.cpu() as CPUForceDescriptor;
          if (force.apply) {
            const input: Record<string, number | number[]> = {};
            for (const key of Object.keys(module.inputs)) {
              const value = module.read()[key];
              input[key] = value ?? 0;
            }
            // Always add enabled
            input.enabled = module.isEnabled() ? 1 : 0;

            for (let pi = 0; pi < effectiveCount; pi++) {
              const particle = this.particles[pi];
              if (particle.mass <= 0) continue;
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
                index: pi,
                particles: this.particles,
                getImageData,
                getGrid: (name: string) => this.gridStores.get(name),
              });
            }
          }
        }
      } catch (error) {}
    }

    // Third pass: integration (once per particle)
    for (let i = 0; i < effectiveCount; i++) {
      const particle = this.particles[i];
      if (particle.mass <= 0) continue;
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
          if (module.role === ModuleRole.Force) {
            const force = module.cpu() as CPUForceDescriptor;
            if (force.constrain) {
              const input: Record<string, number | number[]> = {};
              for (const key of Object.keys(module.inputs)) {
                const value = module.read()[key];
                input[key] = value ?? 0;
              }
              // Always add enabled
              input.enabled = module.isEnabled() ? 1 : 0;
              for (let pi = 0; pi < effectiveCount; pi++) {
                const particle = this.particles[pi];
                if (particle.mass <= 0) continue;
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
                  index: pi,
                  particles: this.particles,
                  getImageData,
                  getGrid: (name: string) => this.gridStores.get(name),
                });
              }
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
        if (module.role === ModuleRole.Force) {
          const force = module.cpu() as CPUForceDescriptor;
          if (force.correct) {
            const input: Record<string, number | number[]> = {};
            for (const key of Object.keys(module.inputs)) {
              const value = module.read()[key];
              input[key] = value ?? 0;
            }
            // Always add enabled
            input.enabled = module.isEnabled() ? 1 : 0;

            for (let index = 0; index < effectiveCount; index++) {
              const particle = this.particles[index];
              if (particle.mass <= 0) continue;
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
                particles: this.particles,
                getImageData,
                getGrid: (name: string) => this.gridStores.get(name),
              });
            }
          }
        }
      } catch (error) {}
    }
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
      if (!module.isEnabled()) return false;
      const descriptor =
        module.role === ModuleRole.Render
          ? (module.cpu() as CPURenderDescriptor)
          : module.role === ModuleRole.Grid
            ? (module.cpu() as CPUGridDescriptor).render
            : undefined;
      return descriptor?.composition === CanvasComposition.HandlesBackground;
    });

    // Determine if there are any enabled renderers
    const hasEnabledRenderer = this.modules.some((module) => {
      if (!module.isEnabled()) return false;
      if (module.role === ModuleRole.Render) return true;
      if (module.role === ModuleRole.Grid) {
        return !!(module.cpu() as CPUGridDescriptor).render;
      }
      return false;
    });

    // Only clear canvas if no module handles background AND either some module requires clearing
    // or there are no enabled renderers (to avoid leaving a stale frame on canvas)
    if (!hasBackgroundHandler) {
      const needsClearing = this.modules.some((module) => {
        if (!module.isEnabled()) return false;
        const descriptor =
          module.role === ModuleRole.Render
            ? (module.cpu() as CPURenderDescriptor)
            : module.role === ModuleRole.Grid
              ? (module.cpu() as CPUGridDescriptor).render
              : undefined;
        return descriptor?.composition === CanvasComposition.RequiresClear;
      });

      if (needsClearing || !hasEnabledRenderer) {
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
        const isGridModule = module.role === ModuleRole.Grid;
        const renderDescriptor =
          module.role === ModuleRole.Render
            ? (module.cpu() as CPURenderDescriptor)
            : module.role === ModuleRole.Grid
              ? (module.cpu() as CPUGridDescriptor).render
              : undefined;
        if (renderDescriptor) {
          const render = renderDescriptor;
          // input
          const input: Record<string, number | number[]> = {};
          for (const key of Object.keys(module.inputs)) {
            const value = module.read()[key];
            input[key] = value ?? 0;
          }
          // Always add enabled
          input.enabled = module.isEnabled() ? 1 : 0;
          const gridStore = isGridModule ? this.gridStores.get(module.name) : undefined;

          // Setup phase
          render.setup?.({
            context,
            input,
            view: this.view,
            clearColor: this.clearColor,
            utils,
            particles: this.particles,
            grid: gridStore,
          });

          if (!isGridModule) {
            // Render each visible particle
            const effectiveCount = this.getEffectiveCount();
            for (let i = 0; i < effectiveCount; i++) {
              const particle = this.particles[i];
              if (particle.mass == 0) continue;

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
                grid: gridStore,
              });
            }
          }

          // Teardown phase
          render.teardown?.({
            context,
            input,
            utils,
            grid: gridStore,
          });
        }
      } catch (error) {}
    }
  }

  private setupGridStores(): void {
    this.gridStores.clear();
    this.gridInitialized.clear();
    const view = this.view.getSnapshot();
    for (const module of this.gridModules) {
      if (module.role !== ModuleRole.Grid) continue;
      const spec = (module as unknown as { gridSpec?: GridSpec }).gridSpec;
      if (!spec) continue;
      const resolved = this.resolveGridSpec(spec, view);
      if (resolved !== spec) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
      }
      this.gridStores.set(module.name, new GridStore(resolved));
    }
    for (const module of this.modules) {
      const attach = (module as unknown as { attachGridSpec?: (spec: GridSpec) => void }).attachGridSpec;
      const getName = (module as unknown as { getGridModuleName?: () => string }).getGridModuleName;
      if (!attach || !getName) continue;
      const gridName = getName.call(module);
      const store = this.gridStores.get(gridName);
      if (store) attach.call(module, store.spec);
    }
  }

  private stepGrids(dt: number): void {
    for (const module of this.gridModules) {
      try {
        if (!module.isEnabled()) continue;
        if (module.role !== ModuleRole.Grid) continue;
        const descriptor = module.cpu() as CPUGridDescriptor;
        if (!descriptor || !descriptor.step) continue;
        const store = this.gridStores.get(module.name);
        if (!store) continue;
        const input: Record<string, number | number[]> = {};
        for (const key of Object.keys(module.inputs)) {
          const value = module.read()[key];
          input[key] = value ?? 0;
        }
        input.enabled = module.isEnabled() ? 1 : 0;

        const ctx = {
          input: input as any,
          dt,
          width: store.width,
          height: store.height,
          read: (x: number, y: number, channel?: number) =>
            store.read(x, y, channel),
          write: (x: number, y: number, value: number | number[]) =>
            store.write(x, y, value),
          sample: (x: number, y: number, channel?: number) =>
            store.read(x, y, channel),
          grid: store,
          particles: this.particles,
          view: this.view.getSnapshot(),
        };

        if (!this.gridInitialized.has(module.name)) {
          descriptor.init?.(ctx);
          store.swap();
          this.gridInitialized.add(module.name);
        }

        descriptor.step(ctx);
        store.swap();
        if (descriptor.post) {
          descriptor.post(ctx);
          store.swap();
        }
      } catch (error) {}
    }
  }

  private resolveGridSpec(
    spec: GridSpec,
    view: { width: number; height: number; zoom: number }
  ) {
    if (!spec.followView) return spec;
    const cellSize = spec.cellSize;
    if (!cellSize || cellSize <= 0) return spec;
    const width = Math.max(1, Math.ceil(view.width / cellSize));
    const height = Math.max(1, Math.ceil(view.height / cellSize));
    if (
      width === spec.width &&
      height === spec.height &&
      cellSize === spec.cellSize
    ) {
      return spec;
    }
    return { ...spec, width, height, cellSize };
  }

  private updateGridStoresForView(): void {
    if (this.gridModules.length === 0) return;
    const view = this.view.getSnapshot();
    const now = performance.now();
    const allowResize = now - this.lastGridResizeAt >= this.gridResizeCooldownMs;
    let resized = false;
    let specChanged = false;
    for (const module of this.gridModules) {
      if (module.role !== ModuleRole.Grid) continue;
      const spec = (module as unknown as { gridSpec?: GridSpec }).gridSpec;
      if (!spec) continue;
      const input = module.read() as Record<string, number>;
      const inputCellSize =
        typeof input.cellSize === "number" && input.cellSize > 0
          ? input.cellSize
          : undefined;
      const cellSizeChanged =
        inputCellSize !== undefined && inputCellSize !== spec.cellSize;
      const baseSpec = cellSizeChanged
        ? { ...spec, cellSize: inputCellSize }
        : spec;
      if (!cellSizeChanged && !allowResize) continue;
      const resolved = this.resolveGridSpec(baseSpec, view);
      if (resolved === spec) continue;
      const sizeChanged =
        resolved.width !== spec.width || resolved.height !== spec.height;
      if (cellSizeChanged) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
        this.gridStores.set(module.name, new GridStore(resolved));
        this.gridInitialized.delete(module.name);
        resized = true;
        continue;
      }
      if (!sizeChanged) {
        (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
        const store = this.gridStores.get(module.name);
        if (store) {
          (store as any).spec = resolved;
        }
        specChanged = true;
        continue;
      }
      const prev = this.gridStores.get(module.name);
      const newStore = prev
        ? (() => {
            const buffer = resampleGridBuffer(prev.readBuffer, prev.spec, resolved);
            const store = new GridStore(resolved);
            (store.readBuffer as any).set(buffer as any);
            (store.writeBuffer as any).set(buffer as any);
            return store;
          })()
        : new GridStore(resolved);
      (module as unknown as { gridSpec?: GridSpec }).gridSpec = resolved;
      this.gridStores.set(module.name, newStore);
      if (prev) {
        this.gridInitialized.add(module.name);
      } else {
        this.gridInitialized.delete(module.name);
      }
      resized = true;
    }
    if (!resized && !specChanged) return;
    if (resized) {
      this.lastGridResizeAt = now;
    }
    for (const module of this.modules) {
      const attach = (module as unknown as {
        attachGridSpec?: (spec: GridSpec) => void;
      }).attachGridSpec;
      const getName = (module as unknown as {
        getGridModuleName?: () => string;
      }).getGridModuleName;
      if (!attach || !getName) continue;
      const gridName = getName.call(module);
      const store = this.gridStores.get(gridName);
      if (store) attach.call(module, store.spec);
    }
  }
}
