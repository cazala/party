import { Particle } from "./particle.js";
import { ParticleSystem } from "./system.js";

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  clearColor?: string;
  clearAlpha?: number;
  globalAlpha?: number;
}

export abstract class Renderer {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected clearColor: string;
  protected clearAlpha: number;
  protected globalAlpha: number;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor || "#000000";
    this.clearAlpha = options.clearAlpha || 1;
    this.globalAlpha = options.globalAlpha || 1;

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
}

export class Canvas2DRenderer extends Renderer {
  render(system: ParticleSystem): void {
    this.clear();

    this.ctx.save();
    this.ctx.globalAlpha = this.globalAlpha;

    for (const particle of system.particles) {
      this.renderParticle(particle);
    }

    this.ctx.restore();
  }

  private renderParticle(particle: Particle): void {
    this.ctx.save();
    this.ctx.fillStyle = particle.color;
    this.ctx.beginPath();
    this.ctx.arc(
      particle.position.x,
      particle.position.y,
      particle.size,
      0,
      Math.PI * 2
    );
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
