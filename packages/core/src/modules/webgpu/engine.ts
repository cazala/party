import { IEngine, WebGPUParticle } from "./interfaces";
import { Module } from "./module";
import { WebGPUEngine } from "./runtimes/webgpu/engine";

export class Engine implements IEngine {
  private engine: WebGPUEngine;

  constructor(options: { canvas: HTMLCanvasElement; modules: Module[] }) {
    this.engine = new WebGPUEngine(options);
  }

  initialize(): Promise<void> {
    return this.engine.initialize();
  }

  play(): void {
    this.engine.play();
  }

  pause(): void {
    this.engine.pause();
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

  setParticles(p: WebGPUParticle[]): void {
    this.engine.setParticles(p);
  }

  addParticle(p: WebGPUParticle): void {
    this.engine.addParticle(p);
  }

  getParticles(): WebGPUParticle[] {
    return this.engine.getParticles();
  }

  getParticle(index: number): WebGPUParticle {
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
}
