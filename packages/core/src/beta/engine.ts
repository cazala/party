import { IEngine, IParticle } from "./interfaces";
import { Module } from "./module";
import { WebGPUEngine } from "./runtimes/webgpu/engine";
import { CPUEngine } from "./runtimes/cpu/engine";

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  forces: Module<string, any>[];
  render: Module<string, any>[];
  runtime: "cpu" | "webgpu" | "auto";
  constrainIterations?: number;
  clearColor?: { r: number; g: number; b: number; a: number };
  cellSize?: number;
  maxParticles?: number;
  workgroupSize?: number;
};

export class Engine implements IEngine {
  private engine: IEngine;
  private actualRuntime: "cpu" | "webgpu"; // The actual runtime being used
  private preferredRuntime: "cpu" | "webgpu" | "auto"; // The requested runtime (can be 'auto')
  private originalOptions: EngineOptions; // Store original options for fallback

  constructor(options: EngineOptions) {
    this.preferredRuntime = options.runtime;
    this.originalOptions = { ...options }; // Store original options for fallback

    // Determine actual runtime to use
    let targetRuntime: "cpu" | "webgpu" | "auto";
    if (options.runtime === "auto") {
      // Synchronous check - we'll handle WebGPU availability in initialize()
      targetRuntime = "webgpu"; // Default to WebGPU for auto, fallback to CPU if it fails
    } else {
      targetRuntime = options.runtime;
    }

    this.actualRuntime = targetRuntime;

    if (targetRuntime === "webgpu") {
      this.engine = new WebGPUEngine(options);
    } else {
      this.engine = new CPUEngine(options);
    }
  }

  // Delegate all methods to the concrete engine implementation
  async initialize(): Promise<void> {
    try {
      await this.engine.initialize();
    } catch (error) {
      // Handle fallback for auto mode or WebGPU failures
      if (this.preferredRuntime === "auto" && this.actualRuntime === "webgpu") {
        console.warn(
          "WebGPU initialization failed, falling back to CPU runtime:",
          error
        );

        // Destroy the failed WebGPU engine
        try {
          this.engine.destroy();
        } catch (destroyError) {
          console.warn("Error destroying failed WebGPU engine:", destroyError);
        }

        // Create CPU engine with same options
        this.actualRuntime = "cpu";
        const fallbackOptions = {
          ...this.originalOptions,
          runtime: "cpu",
        };
        this.engine = new CPUEngine(fallbackOptions);

        // Initialize the CPU engine
        await this.engine.initialize();
      } else {
        throw error; // Re-throw if not auto mode or already CPU
      }
    }

    // Log runtime selection for auto mode
    if (this.preferredRuntime === "auto") {
      if (this.actualRuntime === "cpu") {
        console.warn(
          "Auto runtime selection: Using CPU (WebGPU not available or failed)"
        );
      }
    }
  }

  // Get the actual runtime being used (cpu or webgpu)
  getActualRuntime(): "cpu" | "webgpu" {
    return this.actualRuntime;
  }
  play(): void {
    this.engine.play();
  }
  pause(): void {
    this.engine.pause();
  }
  isPlaying(): boolean {
    return this.engine.isPlaying();
  }
  toggle(): void {
    this.engine.toggle();
  }
  destroy(): void {
    this.engine.destroy();
  }
  getSize(): { width: number; height: number } {
    return this.engine.getSize();
  }
  setSize(width: number, height: number): void {
    this.engine.setSize(width, height);
  }
  setCamera(x: number, y: number): void {
    this.engine.setCamera(x, y);
  }
  getCamera(): { x: number; y: number } {
    return this.engine.getCamera();
  }
  setZoom(z: number): void {
    this.engine.setZoom(z);
  }
  getZoom(): number {
    return this.engine.getZoom();
  }
  setParticles(p: IParticle[]): void {
    this.engine.setParticles(p);
  }
  addParticle(p: IParticle): void {
    this.engine.addParticle(p);
  }
  getParticles(): Promise<IParticle[]> {
    return this.engine.getParticles();
  }
  getParticle(index: number): Promise<IParticle> {
    return this.engine.getParticle(index);
  }
  clear(): void {
    this.engine.clear();
  }
  getCount(): number {
    return this.engine.getCount();
  }
  getFPS(): number {
    return this.engine.getFPS();
  }
  export(): Record<string, Record<string, number>> {
    return this.engine.export();
  }
  import(settings: Record<string, Record<string, number>>): void {
    this.engine.import(settings);
  }

  // Configuration getters and setters
  getClearColor(): { r: number; g: number; b: number; a: number } {
    return this.engine.getClearColor();
  }
  setClearColor(color: { r: number; g: number; b: number; a: number }): void {
    this.engine.setClearColor(color);
  }
  getCellSize(): number {
    return this.engine.getCellSize();
  }
  setCellSize(size: number): void {
    this.engine.setCellSize(size);
  }
  getConstrainIterations(): number {
    return this.engine.getConstrainIterations();
  }
  setConstrainIterations(iterations: number): void {
    this.engine.setConstrainIterations(iterations);
  }
  getModule(name: string): Module | undefined {
    return this.engine.getModule(name);
  }

  // Check if a module is supported by the current runtime
  isSupported(module: Module): boolean {
    try {
      if (this.actualRuntime === "webgpu") {
        // For WebGPU, check if the module has a webgpu() method that doesn't throw
        module.webgpu();
        return true;
      } else {
        // For CPU, check if the module has a cpu() method that doesn't throw
        module.cpu();
        return true;
      }
    } catch (error) {
      // If the method throws "Not implemented" or any other error, the module is not supported
      return false;
    }
  }
}
