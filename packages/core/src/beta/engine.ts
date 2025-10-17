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
  maxNeighbors?: number;
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
  stop(): void {
    this.engine.stop();
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
  // Oscillator API passthroughs
  addOscillator(params: {
    moduleName: string;
    inputName: string;
    min: number;
    max: number;
    speedHz: number;
    options?: any;
  }): string {
    return this.engine.addOscillator(params);
  }
  removeOscillator(moduleName: string, inputName: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.engine as any).removeOscillator(moduleName, inputName);
  }
  updateOscillatorSpeed(
    moduleName: string,
    inputName: string,
    speedHz: number
  ): void {
    this.engine.updateOscillatorSpeed(moduleName, inputName, speedHz);
  }
  updateOscillatorBounds(
    moduleName: string,
    inputName: string,
    min: number,
    max: number
  ): void {
    this.engine.updateOscillatorBounds(moduleName, inputName, min, max);
  }
  hasOscillator(moduleName: string, inputName: string): boolean {
    return this.engine.hasOscillator(moduleName, inputName);
  }
  getOscillator(moduleName: string, inputName: string) {
    return this.engine.getOscillator(moduleName, inputName);
  }
  clearOscillators(): void {
    this.engine.clearOscillators();
  }
  addOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    this.engine.addOscillatorListener(moduleName, inputName, handler);
  }
  removeOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    this.engine.removeOscillatorListener(moduleName, inputName, handler);
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
  // Helpers for pinning/unpinning
  async pinParticles(indexes: number[]): Promise<void> {
    const particles = await this.getParticles();
    for (const idx of indexes) {
      if (particles[idx]) particles[idx].mass = -1;
    }
    this.setParticles(particles);
  }
  async unpinParticles(indexes: number[]): Promise<void> {
    const particles = await this.getParticles();
    for (const idx of indexes) {
      if (particles[idx]) {
        const size = particles[idx].size;
        // Derive mass from size deterministically (simple proportional mapping)
        particles[idx].mass = Math.max(0.1, size);
      }
    }
    this.setParticles(particles);
  }
  async unpinAll(): Promise<void> {
    const particles = await this.getParticles();
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].mass < 0) {
        const size = particles[i].size;
        particles[i].mass = Math.max(0.1, size);
      }
    }
    this.setParticles(particles);
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
  getMaxNeighbors(): number {
    return this.engine.getMaxNeighbors();
  }
  setMaxNeighbors(size: number): void {
    this.engine.setMaxNeighbors(size);
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
