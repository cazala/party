import { Particle } from "./particle";
import { ParticleSystem } from "./system";
import { SpatialGrid } from "./spatial-grid";
import { Vector2D } from "./vector";

// Default constants for Render options
export const DEFAULT_RENDER_COLOR_MODE = "particle";
export const DEFAULT_RENDER_CUSTOM_COLOR = "#FFFFFF";

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  clearColor?: string;
  clearAlpha?: number;
  globalAlpha?: number;
  colorMode?: "particle" | "custom" | "velocity";
  customColor?: string;
  maxSpeed?: number;
}

export abstract class Renderer {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected clearColor: string;
  protected clearAlpha: number;
  protected globalAlpha: number;
  public colorMode: "particle" | "custom" | "velocity";
  public customColor: string;
  public maxSpeed: number;
  public showSpatialGrid: boolean;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor || "#000000";
    this.clearAlpha = options.clearAlpha || 1;
    this.globalAlpha = options.globalAlpha || 1;
    this.colorMode = options.colorMode || DEFAULT_RENDER_COLOR_MODE;
    this.customColor = options.customColor || DEFAULT_RENDER_CUSTOM_COLOR;
    this.maxSpeed = options.maxSpeed || 300;
    this.showSpatialGrid = false;

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

  setColorMode(mode: "particle" | "custom" | "velocity"): void {
    this.colorMode = mode;
  }

  setCustomColor(color: string): void {
    this.customColor = color;
  }

  setMaxSpeed(speed: number): void {
    this.maxSpeed = speed;
  }

  setShowSpatialGrid(show: boolean): void {
    this.showSpatialGrid = show;
  }
}

export class Canvas2DRenderer extends Renderer {
  private previewParticle: Particle | null = null;
  private isDragMode: boolean = false;
  private previewVelocity: Vector2D | null = null;

  setPreviewParticle(
    particle: Particle | null,
    isDragMode: boolean = false
  ): void {
    this.previewParticle = particle;
    this.isDragMode = isDragMode;
  }

  setPreviewVelocity(velocity: Vector2D | null): void {
    this.previewVelocity = velocity;
  }

  render(system: ParticleSystem): void {
    this.clear();

    this.ctx.save();
    this.ctx.globalAlpha = this.globalAlpha;

    // Render spatial grid if enabled
    if (this.showSpatialGrid) {
      this.renderSpatialGrid(system.spatialGrid);
    }

    // Calculate min/max speeds for velocity color mode
    let minSpeed = Infinity;
    let maxSpeed = 0;

    if (this.colorMode === "velocity" && system.particles.length > 0) {
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

    // Render preview particle if it exists
    if (this.previewParticle) {
      this.renderPreviewParticle(this.previewParticle, this.isDragMode);

      // Render velocity arrow if preview velocity is set
      if (this.previewVelocity) {
        this.renderVelocityArrow(this.previewParticle, this.previewVelocity);
      }
    }

    this.ctx.restore();
  }

  private calculateVelocityColor(
    particle: Particle,
    minSpeed: number,
    maxSpeed: number
  ): string {
    const speed = particle.velocity.magnitude();
    const speedRange = maxSpeed - minSpeed;
    const ratio = speedRange > 0 ? (speed - minSpeed) / speedRange : 0;

    // Interpolate from green (slow) to red (fast)
    const red = Math.floor(ratio * 255);
    const green = Math.floor((1 - ratio) * 255);

    return `rgb(${red}, ${green}, 0)`;
  }

  private getParticleColor(
    particle: Particle,
    minSpeed?: number,
    maxSpeed?: number
  ): string {
    switch (this.colorMode) {
      case "custom":
        return this.customColor;
      case "velocity":
        return this.calculateVelocityColor(
          particle,
          minSpeed || 0,
          maxSpeed || 1
        );
      case "particle":
      default:
        return particle.color;
    }
  }

  private renderParticle(
    particle: Particle,
    minSpeed?: number,
    maxSpeed?: number
  ): void {
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

  private renderPreviewParticle(particle: Particle, isDragMode: boolean): void {
    this.ctx.save();

    if (isDragMode) {
      // Drag mode: semi-transparent with dashed outline
      this.ctx.globalAlpha = 0.6;

      // Render the particle body with reduced opacity
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

      // Add a dashed outline to distinguish it as drag mode
      this.ctx.globalAlpha = 1;
      this.ctx.strokeStyle = particle.color;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]); // Dashed line pattern
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.size + 2, // Slightly larger outline
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
      this.ctx.setLineDash([]); // Reset line dash
    } else {
      // Normal click mode: render like a regular particle but slightly transparent
      this.ctx.globalAlpha = 0.8;

      // Add subtle glow effect like normal particles
      this.ctx.shadowColor = particle.color;
      this.ctx.shadowBlur = particle.size * 1.5;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;

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

      // Add inner bright core
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 0.7;
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private renderVelocityArrow(particle: Particle, velocity: Vector2D): void {
    this.ctx.save();

    // Don't render if velocity is zero or very small
    const velocityMagnitude = velocity.magnitude();
    if (velocityMagnitude < 0.1) {
      this.ctx.restore();
      return;
    }

    // Calculate arrow direction
    const direction = velocity.clone().divide(velocityMagnitude);

    // Start point: at the edge of the particle, not the center
    const startX = particle.position.x + direction.x * particle.size;
    const startY = particle.position.y + direction.y * particle.size;

    // Calculate the actual distance from particle edge to cursor position
    // The velocity represents the distance from particle center to cursor
    const distanceFromCenter = velocityMagnitude;
    const distanceFromEdge = distanceFromCenter - particle.size;

    // Reach 95% of the distance to avoid cursor overlap when far away
    const targetDistance = Math.max(0, distanceFromEdge) * 0.9;

    // Only apply size limitation if the distance would be excessive (>300px from edge)
    const maxArrowLength = 300;
    const arrowLength = Math.min(maxArrowLength, targetDistance);

    // End point
    const endX = startX + direction.x * arrowLength;
    const endY = startY + direction.y * arrowLength;

    // Arrow color - match particle color with same alpha as particle preview
    const arrowColor = particle.color;

    this.ctx.strokeStyle = arrowColor;
    this.ctx.globalAlpha = 1; // Match particle preview alpha
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";

    this.ctx.setLineDash([5, 5]); // Always dashed for velocity arrows

    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead
    const arrowHeadLength = 12;
    const arrowHeadAngle = Math.PI / 6; // 30 degrees

    // Calculate arrowhead points
    const angle = Math.atan2(direction.y, direction.x);
    const leftX = endX - arrowHeadLength * Math.cos(angle - arrowHeadAngle);
    const leftY = endY - arrowHeadLength * Math.sin(angle - arrowHeadAngle);
    const rightX = endX - arrowHeadLength * Math.cos(angle + arrowHeadAngle);
    const rightY = endY - arrowHeadLength * Math.sin(angle + arrowHeadAngle);

    // Draw arrowhead as filled triangle
    this.ctx.fillStyle = arrowColor;
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(leftX, leftY);
    this.ctx.lineTo(rightX, rightY);
    this.ctx.closePath();
    this.ctx.fill();

    // Reset line dash
    this.ctx.setLineDash([]);

    this.ctx.restore();
  }

  private renderSpatialGrid(spatialGrid: SpatialGrid): void {
    this.ctx.save();

    const { cols, rows, cellSize } = spatialGrid.getGridDimensions();

    // Base grid color
    const baseColor = "#dee7f0";
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 0.5;
    this.ctx.globalAlpha = 0.3;

    // Draw grid lines
    for (let col = 0; col <= cols; col++) {
      const x = col * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, rows * cellSize);
      this.ctx.stroke();
    }

    for (let row = 0; row <= rows; row++) {
      const y = row * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(cols * cellSize, y);
      this.ctx.stroke();
    }

    // Fill cells based on particle density
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const particleCount = spatialGrid.getCellParticleCount(col, row);
        if (particleCount > 0) {
          // Calculate cell color based on particle density
          const density = Math.min(particleCount / 10, 1); // Normalize to max 10 particles
          const alpha = 0.1 + density * 0.3; // Range from 0.1 to 0.4

          this.ctx.fillStyle = baseColor;
          this.ctx.globalAlpha = alpha;
          this.ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

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
