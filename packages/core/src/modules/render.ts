import { Particle } from "./particle.js";
import { ParticleSystem } from "./system.js";

// Default constants for Render options
export const DEFAULT_RENDER_COLOR_MODE = 'particle';
export const DEFAULT_RENDER_CUSTOM_COLOR = '#FFFFFF';

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  clearColor?: string;
  clearAlpha?: number;
  globalAlpha?: number;
  colorMode?: 'particle' | 'custom' | 'velocity';
  customColor?: string;
  maxSpeed?: number;
}

export abstract class Renderer {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected clearColor: string;
  protected clearAlpha: number;
  protected globalAlpha: number;
  public colorMode: 'particle' | 'custom' | 'velocity';
  public customColor: string;
  public maxSpeed: number;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor || "#000000";
    this.clearAlpha = options.clearAlpha || 1;
    this.globalAlpha = options.globalAlpha || 1;
    this.colorMode = options.colorMode || DEFAULT_RENDER_COLOR_MODE;
    this.customColor = options.customColor || DEFAULT_RENDER_CUSTOM_COLOR;
    this.maxSpeed = options.maxSpeed || 300;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context from canvas");
    }
    this.ctx = ctx;
  }

  abstract render(system: ParticleSystem): void;

  protected clear(): void {
    this.ctx.save();
    this.ctx.globalAlpha = this.clearAlpha;
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  setSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  setColorMode(mode: 'particle' | 'custom' | 'velocity'): void {
    this.colorMode = mode;
  }

  setCustomColor(color: string): void {
    this.customColor = color;
  }

  setMaxSpeed(speed: number): void {
    this.maxSpeed = speed;
  }
}

export class Canvas2DRenderer extends Renderer {
  render(system: ParticleSystem): void {
    this.clear();

    this.ctx.save();
    this.ctx.globalAlpha = this.globalAlpha;

    // Calculate min/max speeds for velocity color mode
    let minSpeed = Infinity;
    let maxSpeed = 0;
    
    if (this.colorMode === 'velocity' && system.particles.length > 0) {
      for (const particle of system.particles) {
        const speed = particle.velocity.magnitude();
        minSpeed = Math.min(minSpeed, speed);
        maxSpeed = Math.max(maxSpeed, speed);
      }
      
      // Handle edge case where all particles have the same speed
      if (minSpeed === maxSpeed) {
        minSpeed = 0;
      }
    }

    for (const particle of system.particles) {
      this.renderParticle(particle, minSpeed, maxSpeed);
    }

    this.ctx.restore();
  }

  private calculateVelocityColor(particle: Particle, minSpeed: number, maxSpeed: number): string {
    const speed = particle.velocity.magnitude();
    const speedRange = maxSpeed - minSpeed;
    const ratio = speedRange > 0 ? (speed - minSpeed) / speedRange : 0;
    
    // Interpolate from green (slow) to red (fast)
    const red = Math.floor(ratio * 255);
    const green = Math.floor((1 - ratio) * 255);
    
    return `rgb(${red}, ${green}, 0)`;
  }

  private getParticleColor(particle: Particle, minSpeed?: number, maxSpeed?: number): string {
    switch (this.colorMode) {
      case 'custom':
        return this.customColor;
      case 'velocity':
        return this.calculateVelocityColor(particle, minSpeed || 0, maxSpeed || 1);
      case 'particle':
      default:
        return particle.color;
    }
  }

  private renderParticle(particle: Particle, minSpeed?: number, maxSpeed?: number): void {
    this.ctx.save();
    
    const renderColor = this.getParticleColor(particle, minSpeed, maxSpeed);
    
    // Add glow effect
    this.ctx.shadowColor = renderColor;
    this.ctx.shadowBlur = particle.size * 2;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.fillStyle = renderColor;
    this.ctx.beginPath();
    this.ctx.arc(
      particle.position.x,
      particle.position.y,
      particle.size,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    
    // Add inner bright core for more glow effect
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = renderColor;
    this.ctx.globalAlpha = 0.8;
    this.ctx.fill();
    
    this.ctx.restore();
  }

  drawBackground(color: string, alpha: number = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
}

export function createCanvas2DRenderer(
  canvas: HTMLCanvasElement,
  options: Partial<RenderOptions> = {}
): Canvas2DRenderer {
  return new Canvas2DRenderer({
    canvas,
    ...options,
  });
}
