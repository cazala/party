import { View } from "./view";
import type { Module } from "./module";

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

export interface IEngine {
  initialize(): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  isPlaying(): boolean;
  destroy(): void;
  getSize(): { width: number; height: number };
  setSize(width: number, height: number): void;
  setCamera(x: number, y: number): void;
  getCamera(): { x: number; y: number };
  setZoom(z: number): void;
  getZoom(): number;
  addParticle(p: IParticle): void;
  setParticles(p: IParticle[]): void;
  getParticles(): Promise<IParticle[]>;
  getParticle(index: number): Promise<IParticle>;
  clear(): void;
  getCount(): number;
  getFPS(): number;
  export(): Record<string, Record<string, number>>;
  import(settings: Record<string, Record<string, number>>): void;
}

export abstract class AbstractEngine implements IEngine {
  protected playing: boolean = false;
  protected lastTime: number = 0;
  protected fpsEstimate: number = 60;
  protected fpsSmoothing: number = 0.15;
  protected constrainIterations: number;
  protected clearColor: { r: number; g: number; b: number; a: number };
  protected cellSize: number;
  protected view: View;
  protected modules: Module[];

  constructor(options: {
    canvas: HTMLCanvasElement;
    forces: Module[];
    render: Module[];
    constrainIterations?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    cellSize?: number;
  }) {
    this.view = new View(options.canvas.width, options.canvas.height);
    this.modules = [...options.forces, ...options.render];
    this.constrainIterations = options.constrainIterations ?? 5;
    this.clearColor = options.clearColor ?? { r: 0, g: 0, b: 0, a: 1 };
    this.cellSize = options.cellSize ?? 16;
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract destroy(): void;
  abstract setSize(width: number, height: number): void;
  abstract addParticle(p: IParticle): void;
  abstract setParticles(p: IParticle[]): void;
  abstract getParticles(): Promise<IParticle[]>;
  abstract getParticle(index: number): Promise<IParticle>;
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

  export(): Record<string, Record<string, number>> {
    const settings: Record<string, Record<string, number>> = {};
    for (const module of this.modules) {
      const moduleData = module.read();
      // Include the enabled state in the exported data
      settings[module.name] = {
        ...moduleData as Record<string, number>,
        enabled: module.isEnabled() ? 1 : 0
      };
    }
    return settings;
  }

  import(settings: Record<string, Record<string, number>>): void {
    for (const module of this.modules) {
      if (settings[module.name]) {
        const moduleSettings = settings[module.name];
        
        // Restore enabled state if present
        if ('enabled' in moduleSettings) {
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
      const instantFps = 1 / dt;
      this.fpsEstimate =
        this.fpsEstimate * (1 - this.fpsSmoothing) +
        instantFps * this.fpsSmoothing;
    }
  }

  protected getTimeDelta(): number {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
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
}
