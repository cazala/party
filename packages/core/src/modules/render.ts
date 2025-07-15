import { Particle } from "./particle";
import { ParticleSystem } from "./system";
import { SpatialGrid } from "./spatial-grid";
import { Vector2D } from "./vector";
import { calculateDensity, Fluid } from "./forces/fluid";

// Default constants for Render options
export const DEFAULT_RENDER_COLOR_MODE = "particle";
export const DEFAULT_RENDER_CUSTOM_COLOR = "#FFFFFF";
export const DEFAULT_RENDER_MAX_SPEED = 400;

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
  public showDensityAtCursor: boolean;
  public showVelocity: boolean;
  public cursorPosition: Vector2D | null;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor ?? "#000000";
    this.clearAlpha = options.clearAlpha ?? 1;
    this.globalAlpha = options.globalAlpha ?? 1;
    this.colorMode = options.colorMode ?? DEFAULT_RENDER_COLOR_MODE;
    this.customColor = options.customColor ?? DEFAULT_RENDER_CUSTOM_COLOR;
    this.maxSpeed = options.maxSpeed ?? DEFAULT_RENDER_MAX_SPEED;
    this.showSpatialGrid = false;
    this.showDensityAtCursor = false;
    this.showVelocity = false;
    this.cursorPosition = null;

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

  getColorMode(): "particle" | "custom" | "velocity" {
    return this.colorMode;
  }

  getCustomColor(): string {
    return this.customColor;
  }

  setShowSpatialGrid(show: boolean): void {
    this.showSpatialGrid = show;
  }

  setShowDensityAtCursor(show: boolean): void {
    this.showDensityAtCursor = show;
  }

  setShowVelocity(show: boolean): void {
    this.showVelocity = show;
  }

  setCursorPosition(position: Vector2D | null): void {
    this.cursorPosition = position;
  }
}

export class Canvas2DRenderer extends Renderer {
  private previewParticle: Particle | null = null;
  private isDragMode: boolean = false;
  private previewVelocity: Vector2D | null = null;
  private removalPreview: { position: Vector2D; radius: number } | null = null;
  
  // Camera/Zoom properties
  private zoom: number = 1;
  private cameraX: number = 0;
  private cameraY: number = 0;

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

  setRemovalPreview(preview: { position: Vector2D; radius: number } | null): void {
    this.removalPreview = preview;
  }

  setShowDensityAtCursor(show: boolean): void {
    this.showDensityAtCursor = show;
  }

  setCursorPosition(position: Vector2D | null): void {
    this.cursorPosition = position;
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(2, zoom)); // Limit zoom between 0.1x and 2x
  }

  getZoom(): number {
    return this.zoom;
  }

  setCamera(x: number, y: number): void {
    this.cameraX = x;
    this.cameraY = y;
  }

  getCamera(): { x: number; y: number } {
    return { x: this.cameraX, y: this.cameraY };
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.cameraX) / this.zoom,
      y: (screenY - this.cameraY) / this.zoom
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.cameraX,
      y: worldY * this.zoom + this.cameraY
    };
  }

  render(system: ParticleSystem): void {
    this.clear();

    this.ctx.save();
    this.ctx.globalAlpha = this.globalAlpha;

    // Apply camera transform (zoom and pan)
    this.ctx.translate(this.cameraX, this.cameraY);
    this.ctx.scale(this.zoom, this.zoom);

    // Render spatial grid if enabled
    if (this.showSpatialGrid) {
      this.renderSpatialGrid(system.spatialGrid);
    }

    // Calculate min/max speeds for velocity color mode

    for (const particle of system.particles) {
      this.renderParticle(particle);
    }

    // Render velocity arrows if enabled
    if (this.showVelocity) {
      for (const particle of system.particles) {
        this.renderParticleVelocity(particle);
      }
    }

    // Render preview particle if it exists
    if (this.previewParticle) {
      this.renderPreviewParticle(this.previewParticle, this.isDragMode);

      // Render velocity arrow if preview velocity is set
      if (this.previewVelocity) {
        this.renderPreviewVelocity(this.previewParticle, this.previewVelocity);
      }
    }

    // Render removal preview circle if it exists
    if (this.removalPreview) {
      this.renderRemovalPreview(this.removalPreview);
    }

    // Render density circle and arrow in world coordinates
    if (this.showDensityAtCursor && this.cursorPosition) {
      this.renderDensityCircleAndArrow(system);
    }

    this.ctx.restore();

    // Render density info box in screen coordinates (fixed position)
    if (this.showDensityAtCursor && this.cursorPosition) {
      this.renderDensityInfoBox(system);
    }
  }

  private calculateVelocityColor(particle: Particle): string {
    const speed = particle.velocity.magnitude();
    const ratio = speed / this.maxSpeed;

    // Interpolate from green (slow) to red (fast)
    const red = Math.floor(ratio * 255);
    const green = Math.floor((1 - ratio) * 255);

    const color = `rgb(${red}, ${green}, 0)`;
    console.log(color, this.maxSpeed);
    return color;
  }

  private getParticleColor(particle: Particle): string {
    switch (this.colorMode) {
      case "custom":
        return this.customColor;
      case "velocity":
        return this.calculateVelocityColor(particle);
      case "particle":
      default:
        return particle.color;
    }
  }

  private getVelocityArrowColor(
    particle: Particle,
    velocity?: Vector2D
  ): string {
    switch (this.colorMode) {
      case "custom":
        return this.customColor;
      case "velocity":
        if (velocity) {
          // Calculate color based on the provided velocity (for previews)
          const speed = velocity.magnitude();
          const ratio = speed / this.maxSpeed;

          const red = Math.floor(Math.min(ratio, 1) * 255);
          const green = Math.floor((1 - Math.min(ratio, 1)) * 255);
          return `rgb(${red}, ${green}, 0)`;
        } else {
          // Use particle's velocity (for regular arrows)
          return this.calculateVelocityColor(particle);
        }
      case "particle":
      default:
        return particle.color;
    }
  }

  private renderParticle(particle: Particle): void {
    this.ctx.save();

    const renderColor = this.getParticleColor(particle);

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
      // Scale line width and dash pattern to match velocity arrow
      this.ctx.lineWidth = Math.max(1, 2 / this.zoom);
      const dashSize = Math.max(2, 5 / this.zoom);
      this.ctx.setLineDash([dashSize, dashSize]); // Dashed line pattern
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.size + Math.max(1, 2 / this.zoom), // Slightly larger outline, scaled with zoom
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

  private renderPreviewVelocity(particle: Particle, velocity: Vector2D): void {
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

    // Scale max arrow length based on zoom to maintain pixel size
    const maxArrowLength = 300 / this.zoom;
    const arrowLength = Math.min(maxArrowLength, targetDistance);

    // End point
    const endX = startX + direction.x * arrowLength;
    const endY = startY + direction.y * arrowLength;

    // Arrow color - respect renderer color mode
    const arrowColor = this.getVelocityArrowColor(particle, velocity);

    this.ctx.strokeStyle = arrowColor;
    this.ctx.globalAlpha = 1; // Match particle preview alpha
    // Scale line width based on zoom - thicker when zoomed out
    this.ctx.lineWidth = Math.max(1, 2 / this.zoom);
    this.ctx.lineCap = "round";

    // Scale dash pattern based on zoom
    const dashSize = Math.max(2, 5 / this.zoom);
    this.ctx.setLineDash([dashSize, dashSize]); // Always dashed for velocity arrows

    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead - scale size based on zoom
    const arrowHeadLength = Math.max(6, 12 / this.zoom);
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

  private renderParticleVelocity(particle: Particle): void {
    this.ctx.save();

    const velocityMagnitude = particle.velocity.magnitude();

    // Don't render if velocity is zero or very small
    if (velocityMagnitude < 0.1) {
      this.ctx.restore();
      return;
    }

    // Calculate arrow direction
    const direction = particle.velocity.clone().normalize();

    // Scale the arrow length proportional to velocity magnitude
    // Use a scaling factor to make arrows visible but not too long
    const scaleFactor = 0.1; // Adjust this to control arrow length
    const arrowLength = Math.min(velocityMagnitude * scaleFactor, 20); // Cap at 50px

    // Start point: at the edge of the particle, not the center
    const startX = particle.position.x + direction.x * particle.size;
    const startY = particle.position.y + direction.y * particle.size;

    // End point
    const endX = startX + direction.x * arrowLength;
    const endY = startY + direction.y * arrowLength;

    // Use appropriate color based on renderer color mode
    const arrowColor = this.getVelocityArrowColor(particle);

    this.ctx.strokeStyle = arrowColor;
    this.ctx.globalAlpha = 0.8;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";

    // Draw arrow line
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead
    const arrowHeadLength = 8;
    const arrowHeadAngle = Math.PI / 6; // 30 degrees

    // Calculate arrowhead points
    const angle = Math.atan2(direction.y, direction.x);
    const leftX = endX - arrowHeadLength * Math.cos(angle - arrowHeadAngle);
    const leftY = endY - arrowHeadLength * Math.sin(angle - arrowHeadAngle);
    const rightX = endX - arrowHeadLength * Math.cos(angle + arrowHeadAngle);
    const rightY = endY - arrowHeadLength * Math.sin(angle + arrowHeadAngle);

    // Draw arrowhead as filled triangle
    this.ctx.fillStyle = arrowColor;
    this.ctx.globalAlpha = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(leftX, leftY);
    this.ctx.lineTo(rightX, rightY);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private renderSpatialGrid(spatialGrid: SpatialGrid): void {
    this.ctx.save();

    const { cols, rows, cellSize } = spatialGrid.getGridDimensions();
    const { minX, minY } = spatialGrid.getGridBounds();

    // Base grid color
    const baseColor = "#dee7f0";
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 0.5;
    this.ctx.globalAlpha = 0.3;

    // Draw grid lines using world coordinates
    for (let col = 0; col <= cols; col++) {
      const x = minX + col * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, minY);
      this.ctx.lineTo(x, minY + rows * cellSize);
      this.ctx.stroke();
    }

    for (let row = 0; row <= rows; row++) {
      const y = minY + row * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(minX, y);
      this.ctx.lineTo(minX + cols * cellSize, y);
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
          
          // Draw cell using world coordinates
          const cellX = minX + col * cellSize;
          const cellY = minY + row * cellSize;
          this.ctx.fillRect(cellX, cellY, cellSize, cellSize);
        }
      }
    }

    this.ctx.restore();
  }

  private renderDensityCircleAndArrow(system: ParticleSystem): void {
    if (!this.cursorPosition) return;

    this.ctx.save();

    const fluid = system.forces.find(
      (force) => force instanceof Fluid
    ) as Fluid;

    // Get particles near cursor
    const particles = system.spatialGrid.getParticles(
      this.cursorPosition,
      fluid.influenceRadius
    );

    // Calculate density at cursor position
    const density = calculateDensity(
      this.cursorPosition,
      fluid.influenceRadius,
      particles
    );

    const vector = fluid.calculatePressureForce(this.cursorPosition, particles);
    const force =
      density > 0
        ? vector.clone().normalize().multiply(fluid.influenceRadius)
        : Vector2D.zero();
    // not devided by density

    // Use same color palette as spatial grid
    const baseColor = "#dee7f0";

    // Draw circle at cursor with influence radius
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.6;
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.arc(
      this.cursorPosition.x,
      this.cursorPosition.y,
      fluid.influenceRadius,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // draw arrow from cursor position to force vector
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.cursorPosition.x, this.cursorPosition.y);
    this.ctx.lineTo(
      this.cursorPosition.x + force.x,
      this.cursorPosition.y + force.y
    );
    this.ctx.stroke();

    this.ctx.restore();
  }

  private renderDensityInfoBox(system: ParticleSystem): void {
    if (!this.cursorPosition) return;

    this.ctx.save();

    const fluid = system.forces.find(
      (force) => force instanceof Fluid
    ) as Fluid;

    // Get particles near cursor
    const particles = system.spatialGrid.getParticles(
      this.cursorPosition,
      fluid.influenceRadius
    );

    // Calculate density at cursor position
    const density = calculateDensity(
      this.cursorPosition,
      fluid.influenceRadius,
      particles
    );

    const pressure = fluid.convertDensityToPressure(density);

    // Use same color palette as spatial grid
    const baseColor = "#dee7f0";

    // Draw density text with smart positioning
    this.ctx.globalAlpha = 1;
    this.ctx.font = "14px monospace";
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";

    const longestText = Math.max(
      this.ctx.measureText(`Density: ${density.toFixed(2)}`).width,
      this.ctx.measureText(`Pressure: ${pressure.toFixed(2)}`).width,
      this.ctx.measureText(`Particles: ${particles.length}`).width
    );

    // Background panel: outline in grid color, interior in translucent black
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(10, 10, longestText + 10, 55);

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)"; // 50% black
    this.ctx.fillRect(10, 10, longestText + 10, 55);

    // Draw text
    this.ctx.fillStyle = baseColor;
    this.ctx.fillText(`Density: ${density.toFixed(2)}`, 15, 15);
    this.ctx.fillText(`Pressure: ${pressure.toFixed(2)}`, 15, 30);
    this.ctx.fillText(`Particles: ${particles.length}`, 15, 45);

    this.ctx.restore();
  }

  drawBackground(color: string, alpha: number = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  private renderRemovalPreview(preview: { position: Vector2D; radius: number }): void {
    // The removal preview is rendered within the world coordinate system
    // (after camera transforms are applied), so we use world coordinates
    // but scale the radius to maintain constant screen size
    
    this.ctx.strokeStyle = "white";
    this.ctx.fillStyle = "transparent";
    this.ctx.globalAlpha = 0.8;
    
    // Scale line width and dash pattern to maintain constant screen appearance
    this.ctx.lineWidth = 2 / this.zoom;
    const dashSize = 6 / this.zoom;
    this.ctx.setLineDash([dashSize, dashSize]);
    
    // Convert screen-space radius to world-space radius for rendering
    const worldRadius = preview.radius / this.zoom;
    
    this.ctx.beginPath();
    this.ctx.arc(preview.position.x, preview.position.y, worldRadius, 0, 2 * Math.PI);
    this.ctx.stroke();
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
