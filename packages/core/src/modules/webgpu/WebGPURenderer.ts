import { WebGPUDevice } from "./WebGPUDevice";
import { WebGPUParticleSystem, WebGPUParticle } from "./WebGPUParticleSystem";

export interface WebGPURendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class WebGPURenderer {
  private webgpuDevice: WebGPUDevice;
  private particleSystem: WebGPUParticleSystem | null = null;
  private camera = { x: 0, y: 0 };
  private zoom = 1;
  private animationId: number | null = null;
  private isPlaying = false;
  private lastTime = 0;

  public system: WebGPUParticleSystem | null = null;

  constructor(private options: WebGPURendererOptions) {
    this.webgpuDevice = new WebGPUDevice({ canvas: options.canvas });
    // Particle system will be created after device initialization
  }

  async initialize(): Promise<boolean> {
    const success = await this.webgpuDevice.initialize();

    if (!success) return false;

    try {
      // Renderer no longer owns the particle system; user creates it and passes renderer.
      // We still return true here just for device readiness.
      return true;
    } catch (error) {
      console.error("Failed to initialize WebGPU particle system:", error);
      return false;
    }
  }

  getWebGPUDevice(): WebGPUDevice {
    return this.webgpuDevice;
  }

  getSize(): { width: number; height: number } {
    return { width: this.options.width, height: this.options.height };
  }

  attachSystem(system: WebGPUParticleSystem): WebGPURenderer {
    (this as unknown as WebGPURenderer).system = system as WebGPUParticleSystem;
    return this as unknown as WebGPURenderer;
  }

  // Intentionally no uniform write API here; modules manage their own uniforms.

  spawnParticles(
    particles: Array<{
      x: number;
      y: number;
      vx?: number;
      vy?: number;
      size?: number;
      mass?: number;
    }>
  ): void {
    if (!this.system) {
      console.warn("WebGPU particle system not available");
      return;
    }

    const webgpuParticles: WebGPUParticle[] = particles.map((p) => ({
      position: [p.x, p.y],
      velocity: [p.vx || 0, p.vy || 0],
      size: p.size || 5,
      mass: p.mass || 1,
    }));

    this.system.setParticles(webgpuParticles);
  }

  clearParticles(): void {
    if (!this.system) return;
    this.system.clear();
    (this.system as any).clearTrials?.();
    (this.system as any).clearTrails?.();
  }

  getParticleCount(): number {
    return this.system?.getParticleCount() || 0;
  }

  setCamera(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
    if (this.system) {
      this.system.updateGridFromRenderer();
    }
  }

  getCamera(): { x: number; y: number } {
    return { ...this.camera };
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    if (this.system) {
      this.system.updateGridFromRenderer();
    }
  }

  getZoom(): number {
    return this.zoom;
  }

  setSize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.options.canvas.width = width;
    this.options.canvas.height = height;
    if (this.system) {
      this.system.updateGridForSize(width, height);
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
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate = (): void => {
    if (!this.isPlaying || !this.system) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 1 / 30); // Cap at 30 FPS minimum
    this.lastTime = currentTime;

    // Keep grid/world extents in sync with current view
    this.system.updateGridFromRenderer();

    // Update physics via system
    this.system.update(deltaTime);

    // Render
    this.system.render(
      [this.options.width, this.options.height],
      [this.camera.x, this.camera.y],
      this.zoom
    );

    this.animationId = requestAnimationFrame(this.animate);
  };

  destroy(): void {
    this.pause();
    if (this.particleSystem) {
      this.particleSystem.destroy();
    }
    this.webgpuDevice.destroy();
  }

  // Compatibility methods for existing interfaces
  getFPS(): number {
    return 60; // WebGPU runs at display refresh rate
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
    this.clearParticles();
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
  }

  isInitialized(): boolean {
    return this.webgpuDevice.isInitialized();
  }
}
