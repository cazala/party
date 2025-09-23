import { IEngine, IParticle } from "./interfaces";
import { Module } from "./module";
import { WebGPUEngine } from "./runtimes/webgpu/engine";
import { CPUEngine } from "./runtimes/cpu/engine";

export class Engine implements IEngine {
  private engine: IEngine;

  constructor(options: {
    canvas: HTMLCanvasElement;
    modules: Module[];
    type: "webgpu" | "cpu";
  }) {
    if (options.type === "webgpu") {
      this.engine = new WebGPUEngine(options);
    } else {
      this.engine = new CPUEngine(options);
    }
  }

  // Delegate all methods to the concrete engine implementation
  initialize(): Promise<void> { return this.engine.initialize(); }
  play(): void { this.engine.play(); }
  pause(): void { this.engine.pause(); }
  isPlaying(): boolean { return this.engine.isPlaying(); }
  toggle(): void { this.engine.toggle(); }
  destroy(): void { this.engine.destroy(); }
  getSize(): { width: number; height: number } { return this.engine.getSize(); }
  setSize(width: number, height: number): void { this.engine.setSize(width, height); }
  setCamera(x: number, y: number): void { this.engine.setCamera(x, y); }
  getCamera(): { x: number; y: number } { return this.engine.getCamera(); }
  setZoom(z: number): void { this.engine.setZoom(z); }
  getZoom(): number { return this.engine.getZoom(); }
  setParticles(p: IParticle[]): void { this.engine.setParticles(p); }
  addParticle(p: IParticle): void { this.engine.addParticle(p); }
  getParticles(): Promise<IParticle[]> { return this.engine.getParticles(); }
  getParticle(index: number): Promise<IParticle> { return this.engine.getParticle(index); }
  clear(): void { this.engine.clear(); }
  getCount(): number { return this.engine.getCount(); }
  getFPS(): number { return this.engine.getFPS(); }
  export(): Record<string, Record<string, number>> { return this.engine.export(); }
  import(settings: Record<string, Record<string, number>>): void { this.engine.import(settings); }
}
