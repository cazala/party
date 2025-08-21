import { WebGPUDevice } from './WebGPUDevice';
import { WebGPUParticleSystem, WebGPUParticle } from './WebGPUParticleSystem';

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
  
  // Gravity settings
  private gravityStrength = 0;
  
  constructor(private options: WebGPURendererOptions) {
    this.webgpuDevice = new WebGPUDevice({ canvas: options.canvas });
    // Particle system will be created after device initialization
  }

  async initialize(): Promise<boolean> {
    console.log("WebGPURenderer: Starting device initialization...");
    const success = await this.webgpuDevice.initialize();
    console.log("WebGPURenderer: Device initialization result:", success);
    
    if (!success) return false;
    
    try {
      console.log("WebGPURenderer: Creating particle system...");
      this.particleSystem = new WebGPUParticleSystem(this.webgpuDevice);
      console.log("WebGPURenderer: Particle system created successfully");
      
      console.log("WebGPURenderer: Starting particle system initialization...");
      await this.particleSystem.initialize();
      console.log("WebGPURenderer: Particle system initialized successfully");
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU particle system:', error);
      return false;
    }
  }

  setGravityStrength(strength: number): void {
    this.gravityStrength = strength;
  }

  getGravityStrength(): number {
    return this.gravityStrength;
  }

  spawnParticles(particles: Array<{
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    size?: number;
    mass?: number;
  }>): void {
    console.log("WebGPURenderer.spawnParticles called with", particles.length, "particles");
    console.log("First few particles:", particles.slice(0, 3));
    
    if (!this.particleSystem) {
      console.warn("WebGPU particle system not available");
      return;
    }
    
    const webgpuParticles: WebGPUParticle[] = particles.map(p => ({
      position: [p.x, p.y],
      velocity: [p.vx || 0, p.vy || 0],
      size: p.size || 5,
      mass: p.mass || 1,
    }));
    
    console.log("Converted to WebGPU format:", webgpuParticles.length, "particles");
    console.log("First WebGPU particle:", webgpuParticles[0]);
    
    this.particleSystem.setParticles(webgpuParticles);
    
    console.log("Particle count after spawning:", this.particleSystem.getParticleCount());
  }

  clearParticles(): void {
    if (!this.particleSystem) return;
    this.particleSystem.clear();
  }

  getParticleCount(): number {
    return this.particleSystem?.getParticleCount() || 0;
  }

  setCamera(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
  }

  getCamera(): { x: number; y: number } {
    return { ...this.camera };
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  getZoom(): number {
    return this.zoom;
  }

  setSize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.options.canvas.width = width;
    this.options.canvas.height = height;
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
    if (!this.isPlaying || !this.particleSystem) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 1/30); // Cap at 30 FPS minimum
    this.lastTime = currentTime;

    // Update physics
    this.particleSystem.update(deltaTime, this.gravityStrength);

    // Render
    this.particleSystem.render(
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