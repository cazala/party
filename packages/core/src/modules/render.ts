import { Particle } from './particle.js';
import { ParticleSystem } from './system.js';

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  clearColor?: string;
  clearAlpha?: number;
  globalAlpha?: number;
}

export interface ParticleRenderOptions {
  size?: number;
  color?: string;
  useParticleColor?: boolean;
  useParticleSize?: boolean;
}

export abstract class Renderer {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected clearColor: string;
  protected clearAlpha: number;
  protected globalAlpha: number;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor || '#000000';
    this.clearAlpha = options.clearAlpha || 1;
    this.globalAlpha = options.globalAlpha || 1;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  abstract render(system: ParticleSystem, options?: ParticleRenderOptions): void;

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
      height: this.canvas.height
    };
  }
}

export class Canvas2DRenderer extends Renderer {
  render(system: ParticleSystem, options: ParticleRenderOptions = {}): void {
    this.clear();
    
    this.ctx.save();
    this.ctx.globalAlpha = this.globalAlpha;

    const defaultSize = options.size || 5;
    const defaultColor = options.color || '#ffffff';
    const useParticleColor = options.useParticleColor !== false;
    const useParticleSize = options.useParticleSize !== false;

    system.particles.forEach(particle => {
      const size = useParticleSize ? particle.size : defaultSize;
      const color = useParticleColor ? particle.color : defaultColor;

      this.renderParticle(particle, size, color);
    });

    this.ctx.restore();
  }

  private renderParticle(particle: Particle, size: number, color: string): void {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(particle.position.x, particle.position.y, size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  renderParticles(particles: Particle[], options: ParticleRenderOptions = {}): void {
    const defaultSize = options.size || 5;
    const defaultColor = options.color || '#ffffff';
    const useParticleColor = options.useParticleColor !== false;
    const useParticleSize = options.useParticleSize !== false;

    particles.forEach(particle => {
      const size = useParticleSize ? particle.size : defaultSize;
      const color = useParticleColor ? particle.color : defaultColor;

      this.renderParticle(particle, size, color);
    });
  }

  drawBackground(color: string, alpha: number = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawGrid(spacing: number, color: string = '#333333', alpha: number = 0.3): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= this.canvas.width; x += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.canvas.height; y += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

export function createCanvas2DRenderer(canvas: HTMLCanvasElement, options: Partial<RenderOptions> = {}): Canvas2DRenderer {
  return new Canvas2DRenderer({
    canvas,
    ...options
  });
}