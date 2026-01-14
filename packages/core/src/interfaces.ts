import { View } from "./view";
import type { Module } from "./module";
import { OscillatorManager, AddOscillatorOptions } from "./oscillators";

export interface IParticle {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  size: number;
  mass: number;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export type ParticleQuery = {
  position: { x: number; y: number };
  size: number;
  mass: number;
};

export type GetParticlesInRadiusOptions = {
  maxResults?: number;
};

export type GetParticlesInRadiusResult = {
  particles: ParticleQuery[];
  truncated: boolean;
};

export interface IEngine {
  initialize(): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  toggle(): void;
  isPlaying(): boolean;
  destroy(): Promise<void>;
  getSize(): { width: number; height: number };
  setSize(width: number, height: number): void;
  setCamera(x: number, y: number): void;
  getCamera(): { x: number; y: number };
  setZoom(z: number): void;
  getZoom(): number;
  addParticle(p: IParticle): number;
  /**
   * Set a particle at an existing index without reallocating the whole list.
   * Intended for tool/undo operations; avoids full-scene readbacks on WebGPU.
   */
  setParticle(index: number, p: IParticle): void;
  /**
   * Fast path to "remove" (mass=0) or pin/unpin (mass<0 / mass>0) without
   * fetching all particles.
   */
  setParticleMass(index: number, mass: number): void;
  setParticles(p: IParticle[]): void;
  getParticles(): Promise<IParticle[]>;
  getParticle(index: number): Promise<IParticle>;
  /**
   * Fetch particles near a region for local occupancy queries (Brush/Pin/Remove tools).
   * Implementations should avoid full-scene GPU->CPU readbacks when possible.
   *
   * Semantics: returns particles whose discs intersect the query circle, i.e.
   * `distance(center, p.position) <= radius + p.size`.
   */
  getParticlesInRadius(
    center: { x: number; y: number },
    radius: number,
    opts?: GetParticlesInRadiusOptions
  ): Promise<GetParticlesInRadiusResult>;
  clear(): void;
  getCount(): number;
  getFPS(): number;
  export(): Record<string, Record<string, number>>;
  import(settings: Record<string, Record<string, number>>): void;

  // Configuration getters and setters
  getClearColor(): { r: number; g: number; b: number; a: number };
  setClearColor(color: { r: number; g: number; b: number; a: number }): void;
  getCellSize(): number;
  setCellSize(size: number): void;
  getMaxNeighbors(): number;
  setMaxNeighbors(size: number): void;
  getMaxParticles(): number | null;
  setMaxParticles(value: number | null): void;
  getConstrainIterations(): number;
  setConstrainIterations(iterations: number): void;
  getModule(name: string): Module | undefined;

  // Oscillator API
  addOscillator(params: {
    moduleName: string;
    inputName: string;
    min: number;
    max: number;
    speedHz: number;
    options?: AddOscillatorOptions;
  }): string;
  removeOscillator(moduleName: string, inputName: string): void;
  updateOscillatorSpeed(
    moduleName: string,
    inputName: string,
    speedHz: number
  ): void;
  updateOscillatorBounds(
    moduleName: string,
    inputName: string,
    min: number,
    max: number
  ): void;
  hasOscillator(moduleName: string, inputName: string): boolean;
  getOscillator(
    moduleName: string,
    inputName: string
  ):
    | {
        moduleName: string;
        inputName: string;
        min: number;
        max: number;
        speedHz: number;
        curveExponent: number;
        jitterMultiplier: number;
        phaseOffset: number;
        lastDirection: -1 | 0 | 1;
        lastValue: number;
        active: boolean;
      }
    | undefined;
  clearOscillators(): void;
  clearModuleOscillators(moduleName: string): void;
  addOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void;
  removeOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void;
  setOscillatorState(
    moduleName: string,
    inputName: string,
    lastValue: number,
    lastDirection: -1 | 0 | 1
  ): boolean;
  getOscillatorsElapsedSeconds(): number;
  setOscillatorsElapsedSeconds(seconds: number): void;
}

export abstract class AbstractEngine implements IEngine {
  protected playing: boolean = false;
  protected lastTime: number = 0;
  protected fpsEstimate: number = 60;
  protected fpsSmoothing: number = 0.15;
  protected constrainIterations: number;
  protected clearColor: { r: number; g: number; b: number; a: number };
  protected cellSize: number;
  protected maxNeighbors: number;
  protected maxParticles: number | null = null;
  protected view: View;
  protected modules: Module[];
  protected maxSize: number = 0;
  protected oscillatorManager: OscillatorManager;

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
    maxNeighbors?: number;
  }) {
    this.view = new View(options.canvas.width, options.canvas.height);
    this.modules = [...options.forces, ...options.render];
    this.constrainIterations = options.constrainIterations ?? 5;
    this.clearColor = options.clearColor ?? { r: 0, g: 0, b: 0, a: 1 };
    this.cellSize = options.cellSize ?? 16;
    this.maxNeighbors = options.maxNeighbors ?? 100;
    // Initialize oscillator manager with a setter bound to module input writes
    this.oscillatorManager = new OscillatorManager(
      (moduleName: string, inputName: string, value: number) => {
        const module = this.getModule(moduleName);
        if (!module) return;
        // Write input and notify settings change
        (module as Module<any, Record<string, number>>).write({
          [inputName]: value,
        } as Record<string, number>);
        this.onModuleSettingsChanged();
      }
    );
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract destroy(): Promise<void>;
  abstract setSize(width: number, height: number): void;
  abstract addParticle(p: IParticle): number;
  abstract setParticle(index: number, p: IParticle): void;
  abstract setParticleMass(index: number, mass: number): void;
  abstract setParticles(p: IParticle[]): void;
  abstract getParticles(): Promise<IParticle[]>;
  abstract getParticle(index: number): Promise<IParticle>;
  abstract getParticlesInRadius(
    center: { x: number; y: number },
    radius: number,
    opts?: GetParticlesInRadiusOptions
  ): Promise<GetParticlesInRadiusResult>;
  abstract clear(): void;
  abstract getCount(): number;

  // Protected abstract methods for animation loop
  protected abstract startAnimationLoop(): void;
  protected abstract stopAnimationLoop(): void;

  // Common implementations
  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTime = performance.now();
    this.startAnimationLoop();
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.pause();
    this.stopAnimationLoop();
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getSize(): { width: number; height: number } {
    return this.view.getSize();
  }

  setCamera(x: number, y: number): void {
    this.view.setCamera(x, y);
    this.onViewChanged();
  }

  getCamera(): { x: number; y: number } {
    return this.view.getCamera();
  }

  setZoom(z: number): void {
    this.view.setZoom(z);
    this.onViewChanged();
  }

  getZoom(): number {
    return this.view.getZoom();
  }

  getFPS(): number {
    return this.fpsEstimate;
  }

  // Oscillator API implementations
  addOscillator(params: {
    moduleName: string;
    inputName: string;
    min: number;
    max: number;
    speedHz: number;
    options?: AddOscillatorOptions;
  }): string {
    return this.oscillatorManager.addOscillator(params);
  }
  removeOscillator(moduleName: string, inputName: string): void {
    this.oscillatorManager.removeOscillator(moduleName, inputName);
  }
  updateOscillatorSpeed(
    moduleName: string,
    inputName: string,
    speedHz: number
  ): void {
    this.oscillatorManager.updateOscillatorSpeed(
      moduleName,
      inputName,
      speedHz
    );
  }
  updateOscillatorBounds(
    moduleName: string,
    inputName: string,
    min: number,
    max: number
  ): void {
    this.oscillatorManager.updateOscillatorBounds(
      moduleName,
      inputName,
      min,
      max
    );
  }
  hasOscillator(moduleName: string, inputName: string): boolean {
    return this.oscillatorManager.hasOscillator(moduleName, inputName);
  }
  getOscillator(moduleName: string, inputName: string) {
    return this.oscillatorManager.getOscillator(moduleName, inputName);
  }
  clearOscillators(): void {
    this.oscillatorManager.clear();
  }
  clearModuleOscillators(moduleName: string): void {
    this.oscillatorManager.clearModule(moduleName);
  }
  addOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    this.oscillatorManager.addOscillatorListener(
      moduleName,
      inputName,
      handler
    );
  }
  removeOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    this.oscillatorManager.removeOscillatorListener(
      moduleName,
      inputName,
      handler
    );
  }
  setOscillatorState(
    moduleName: string,
    inputName: string,
    lastValue: number,
    lastDirection: -1 | 0 | 1
  ): boolean {
    return this.oscillatorManager.setOscillatorState(
      moduleName,
      inputName,
      lastValue,
      lastDirection
    );
  }

  getOscillatorsElapsedSeconds(): number {
    return this.oscillatorManager.getElapsedSeconds();
  }

  setOscillatorsElapsedSeconds(seconds: number): void {
    this.oscillatorManager.setElapsedSeconds(seconds);
  }

  export(): Record<string, Record<string, number>> {
    const settings: Record<string, Record<string, number>> = {};
    for (const module of this.modules) {
      const moduleData = module.read();
      // Include the enabled state in the exported data
      settings[module.name] = {
        ...(moduleData as Record<string, number>),
        enabled: module.isEnabled() ? 1 : 0,
      };
    }
    return settings;
  }

  import(settings: Record<string, Record<string, number>>): void {
    for (const module of this.modules) {
      if (settings[module.name]) {
        const moduleSettings = settings[module.name];

        // Restore enabled state if present
        if ("enabled" in moduleSettings) {
          module.setEnabled(moduleSettings.enabled === 1);
        }

        // Restore other settings
        module.write(moduleSettings);
      }
    }
    this.onModuleSettingsChanged();
  }

  // Protected helper methods
  protected updateFPS(dt: number): void {
    if (dt > 0) {
      // Clamp dt to a minimum to prevent unrealistic FPS values
      // Minimum dt corresponds to maximum FPS (e.g., 1/144 = ~0.0069s for 144 FPS max)
      const minDt = 1 / 144; // Cap at 144 FPS maximum
      const clampedDt = Math.max(dt, minDt);
      const instantFps = 1 / clampedDt;
      this.fpsEstimate =
        this.fpsEstimate * (1 - this.fpsSmoothing) +
        instantFps * this.fpsSmoothing;
    }
  }

  protected updateOscillators(dt: number): void {
    if (!this.playing) return; // follow global pause
    this.oscillatorManager.updateAll(dt);
  }

  protected getTimeDelta(): number {
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100) / 1000; // clamp to 100ms
    this.lastTime = now;
    return dt;
  }

  // Hook methods for subclasses
  protected onViewChanged(): void {
    // Override in subclasses if needed
  }

  protected onModuleSettingsChanged(): void {
    // Override in subclasses if needed
  }

  // Configuration getters and setters
  getClearColor(): { r: number; g: number; b: number; a: number } {
    return { ...this.clearColor };
  }

  setClearColor(color: { r: number; g: number; b: number; a: number }): void {
    this.clearColor = { ...color };
    this.onClearColorChanged();
  }

  getCellSize(): number {
    return this.cellSize;
  }

  setCellSize(size: number): void {
    if (size <= 0) {
      throw new Error("Cell size must be greater than 0");
    }
    this.cellSize = size;
    this.onCellSizeChanged();
  }

  getMaxNeighbors(): number {
    return this.maxNeighbors;
  }

  setMaxNeighbors(size: number): void {
    if (size <= 0) {
      throw new Error("Max neighbors must be greater than 0");
    }
    this.maxNeighbors = size;
    this.onMaxNeighborsChanged();
  }

  getMaxParticles(): number | null {
    return this.maxParticles;
  }

  setMaxParticles(value: number | null): void {
    if (value !== null && value < 0) {
      throw new Error("Max particles must be non-negative or null");
    }
    this.maxParticles = value;
    this.onMaxParticlesChanged();
  }

  getConstrainIterations(): number {
    return this.constrainIterations;
  }

  setConstrainIterations(iterations: number): void {
    if (iterations < 0) {
      throw new Error("Constrain iterations must be non-negative");
    }
    this.constrainIterations = iterations;
    this.onConstrainIterationsChanged();
  }

  // MaxSize tracking
  getMaxSize(): number {
    return this.maxSize;
  }

  protected updateMaxSize(size: number): void {
    this.maxSize = Math.max(this.maxSize, size);
  }

  protected resetMaxSize(): void {
    this.maxSize = 0;
  }

  // Protected hooks for subclasses to override
  protected onClearColorChanged(): void {
    // Override in subclasses if needed
  }

  protected onCellSizeChanged(): void {
    // Override in subclasses if needed
  }

  protected onConstrainIterationsChanged(): void {
    // Override in subclasses if needed
  }

  protected onMaxNeighborsChanged(): void {
    // Override in subclasses if needed
  }

  protected onMaxParticlesChanged(): void {
    // Override in subclasses if needed
  }

  getModule<T extends Module>(name: string): T | undefined {
    return this.modules.find((module) => module.name === name) as T | undefined;
  }
}
