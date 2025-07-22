import { Particle } from "./particle";
import { System } from "./system";
import { SpatialGrid } from "./spatial-grid";
import { Vector2D } from "./vector";
import { calculateDensity, Fluid } from "./forces/fluid";
import { Sensors } from "./forces/sensors";

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
  sensors?: Sensors | null;
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
  public showDensity: boolean;
  public showVelocity: boolean;
  public densityFieldColor: string;
  public cursorPosition: Vector2D | null;
  protected sensors: Sensors | null;

  // Trail system properties
  protected trailImageData: ImageData | null = null;

  constructor(options: RenderOptions) {
    this.canvas = options.canvas;
    this.clearColor = options.clearColor ?? "#000000";
    this.clearAlpha = options.clearAlpha ?? 1;
    this.globalAlpha = options.globalAlpha ?? 1;
    this.colorMode = options.colorMode ?? DEFAULT_RENDER_COLOR_MODE;
    this.customColor = options.customColor ?? DEFAULT_RENDER_CUSTOM_COLOR;
    this.maxSpeed = options.maxSpeed ?? DEFAULT_RENDER_MAX_SPEED;
    this.showSpatialGrid = false;
    this.showDensity = false;
    this.showVelocity = false;
    this.densityFieldColor = "#ffffff";
    this.cursorPosition = null;
    this.sensors = options.sensors ?? null;
    this.trailImageData = null;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context from canvas");
    }
    this.ctx = ctx;
  }

  abstract render(system: System): void;

  protected clear(): void {
    this.ctx.save();

    if (this.sensors && this.sensors.enableTrail) {
      // Use proper trail decay with color interpolation
      this.clearWithTrailDecay();
    } else {
      // Normal clearing when trail is disabled
      this.ctx.globalAlpha = this.clearAlpha;
      this.ctx.fillStyle = this.clearColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.ctx.restore();
  }

  private clearWithTrailDecay(): void {
    if (!this.sensors) return;

    const decay = this.sensors.trailDecay / 10;

    if (decay >= 0.49) {
      // Near full decay - do normal clear
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = this.clearColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // Use pixel-level color interpolation for proper trail decay
    this.applyTrailDecayToPixels(decay);
  }

  private applyTrailDecayToPixels(decay: number): void {
    try {
      // Get current canvas image data
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      const data = imageData.data;

      // Parse background color (assuming it's in hex format like "#0D0D12")
      const bgColor = this.parseHexColor(this.clearColor);

      // For very small decay values, ensure minimum decay step to prevent permanent trails
      const minDecayStep = 0.001; // Minimum 1% decay per frame
      const effectiveDecay = Math.max(decay, minDecayStep);

      // Apply trail decay by interpolating each pixel toward background color
      for (let i = 0; i < data.length; i += 4) {
        // Get current pixel RGB
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Alpha stays the same

        // Calculate color differences
        const rDiff = bgColor.r - r;
        const gDiff = bgColor.g - g;
        const bDiff = bgColor.b - b;

        // Check if pixel is close to background color
        const colorDistance =
          Math.abs(rDiff) + Math.abs(gDiff) + Math.abs(bDiff);

        if (colorDistance <= 6) {
          // If very close to background, snap to background
          data[i] = bgColor.r;
          data[i + 1] = bgColor.g;
          data[i + 2] = bgColor.b;
        } else {
          // Interpolate toward background color with enhanced decay for small values
          let actualDecay = effectiveDecay;

          // For very small user decay values, use a progressive decay system
          // if (decay < 0.1) {
          //   // Add a base decay that's proportional to color distance
          //   const distanceDecay = Math.min(colorDistance / 255, 0.05);
          //   actualDecay = Math.max(decay, distanceDecay);
          // }
          const prevR = data[i];
          data[i] = r + rDiff * actualDecay;
          if (data[i] === prevR) {
            debugger;
            data[i] = bgColor.r;
          }
          const prevG = data[i + 1];
          data[i + 1] = g + gDiff * actualDecay;
          if (data[i + 1] === prevG) {
            data[i + 1] = bgColor.g;
          }
          const prevB = data[i + 2];
          data[i + 2] = b + bDiff * actualDecay;
          if (data[i + 2] === prevB) {
            data[i + 2] = bgColor.b;
          }
        }
      }

      // Put the modified image data back
      this.ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      // Fallback to alpha blending if pixel manipulation fails
      this.ctx.globalAlpha = Math.max(decay, 0.01);
      this.ctx.fillStyle = this.clearColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private parseHexColor(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    hex = hex.replace("#", "");

    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
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

  setShowDensity(show: boolean): void {
    this.showDensity = show;
  }

  setShowVelocity(show: boolean): void {
    this.showVelocity = show;
  }

  setDensityFieldColor(color: string): void {
    this.densityFieldColor = color;
  }

  setCursorPosition(position: Vector2D | null): void {
    this.cursorPosition = position;
  }

  setSensors(sensors: Sensors | null): void {
    this.sensors = sensors;
  }

  public clearCanvas(): void {
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  protected applyBlurFilter(diffuse: number): void {
    // Apply blur filter
    this.ctx.save();
    this.ctx.filter = `blur(${diffuse}px)`;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1;

    // Create a temporary canvas to apply blur without affecting original
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (tempCtx) {
      // Copy current canvas to temp canvas
      tempCtx.drawImage(this.canvas, 0, 0);

      // Clear current canvas and draw blurred version
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(tempCanvas, 0, 0);
    }

    this.ctx.restore();
  }

  public readPixelIntensity(x: number, y: number, radius: number): number {
    try {
      // For base Renderer class, assume coordinates are already in screen space
      const screenX = Math.round(x);
      const screenY = Math.round(y);

      // Check bounds
      if (
        screenX < 0 ||
        screenY < 0 ||
        screenX >= this.canvas.width ||
        screenY >= this.canvas.height
      ) {
        return 0;
      }

      // For radius of 1, just sample single pixel
      if (radius <= 1) {
        const imageData = this.ctx.getImageData(screenX, screenY, 1, 1);
        const data = imageData.data;

        // Calculate luminance (perceived brightness)
        const r = data[0];
        const g = data[1];
        const b = data[2];
        const alpha = data[3] / 255;

        // Use standard luminance formula, weighted by alpha
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance * alpha;
      }

      // For larger radius, sample circular area
      const sampleRadius = Math.max(1, Math.round(radius));

      // Clamp sample area to canvas bounds
      const startX = Math.max(0, screenX - sampleRadius);
      const startY = Math.max(0, screenY - sampleRadius);
      const endX = Math.min(this.canvas.width - 1, screenX + sampleRadius);
      const endY = Math.min(this.canvas.height - 1, screenY + sampleRadius);

      const width = endX - startX + 1;
      const height = endY - startY + 1;

      if (width <= 0 || height <= 0) return 0;

      const imageData = this.ctx.getImageData(startX, startY, width, height);
      const data = imageData.data;

      let totalIntensity = 0;
      let sampleCount = 0;

      // Sample pixels in circular pattern
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const pixelX = startX + dx;
          const pixelY = startY + dy;

          // Check if pixel is within circular radius
          const distanceFromCenter = Math.sqrt(
            Math.pow(pixelX - screenX, 2) + Math.pow(pixelY - screenY, 2)
          );

          if (distanceFromCenter <= sampleRadius) {
            const pixelIndex = (dy * width + dx) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const alpha = data[pixelIndex + 3] / 255;

            // Calculate luminance weighted by alpha
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            totalIntensity += luminance * alpha;
            sampleCount++;
          }
        }
      }

      return sampleCount > 0 ? totalIntensity / sampleCount : 0;
    } catch (error) {
      // Return 0 if reading fails
      return 0;
    }
  }
}

export class Canvas2DRenderer extends Renderer {
  private previewParticle: Particle | null = null;
  private isDragMode: boolean = false;
  private previewVelocity: Vector2D | null = null;
  private removalPreview: { position: Vector2D; radius: number } | null = null;
  private densityFieldFrameCount: number = 0;

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

  setRemovalPreview(
    preview: { position: Vector2D; radius: number } | null
  ): void {
    this.removalPreview = preview;
  }

  setShowDensity(show: boolean): void {
    this.showDensity = show;
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
      y: (screenY - this.cameraY) / this.zoom,
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.cameraX,
      y: worldY * this.zoom + this.cameraY,
    };
  }

  render(system: System): void {
    this.clear();

    // Render density field first (as background overlay)
    this.renderDensityField(system);

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

    // Apply blur filter to particles if trail diffusion is enabled
    if (
      this.sensors &&
      this.sensors.enableTrail &&
      this.sensors.trailDiffuse > 0
    ) {
      // Save the current state before applying blur
      this.ctx.restore();
      this.applyBlurFilter(this.sensors.trailDiffuse);
      
      // Re-establish camera transform for subsequent rendering
      this.ctx.save();
      this.ctx.globalAlpha = this.globalAlpha;
      this.ctx.translate(this.cameraX, this.cameraY);
      this.ctx.scale(this.zoom, this.zoom);
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
    if (this.showDensity && this.cursorPosition) {
      this.renderDensityCircleAndArrow(system);
    }

    this.ctx.restore();

    // Render density info box in screen coordinates (fixed position)
    if (this.showDensity && this.cursorPosition) {
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
    if (this.showDensity) return;

    this.ctx.save();

    const renderColor = this.getParticleColor(particle);

    // Only add glow effect if trails are disabled
    const trailsEnabled = this.sensors && this.sensors.enableTrail;

    if (!trailsEnabled) {
      // Add glow effect
      this.ctx.shadowColor = renderColor;
      this.ctx.shadowBlur = particle.size * 2;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }

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

    if (!trailsEnabled) {
      // Add inner bright core for more glow effect
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = renderColor;
      this.ctx.globalAlpha = 0.8;
      this.ctx.fill();
    }

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

      // Only add glow effect if trails are disabled
      const trailsEnabled = this.sensors && this.sensors.enableTrail;

      if (!trailsEnabled) {
        // Add subtle glow effect like normal particles
        this.ctx.shadowColor = particle.color;
        this.ctx.shadowBlur = particle.size * 1.5;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
      }

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

      if (!trailsEnabled) {
        // Add inner bright core
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 0.7;
        this.ctx.fill();
      }
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
    const scaleFactor = 0.1;
    const baseArrowLength = velocityMagnitude * scaleFactor;

    // Scale arrow length based on zoom - bigger when zoomed out, but never larger than particle
    const zoomScaledLength = baseArrowLength / this.zoom;
    const maxArrowLength = particle.size * 0.8; // Never bigger than 80% of particle size
    const minArrowLength = Math.max(particle.size * 0.3, 8 / this.zoom); // Minimum length to stay outside particle
    const arrowLength = Math.max(
      minArrowLength,
      Math.min(zoomScaledLength, maxArrowLength, 50)
    ); // Ensure minimum length

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
    // Scale line width based on zoom - thicker when zoomed out
    this.ctx.lineWidth = Math.max(1, 2 / this.zoom);
    this.ctx.lineCap = "round";

    // Draw arrow line
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead - scale size based on zoom
    const arrowHeadLength = Math.max(4, 8 / this.zoom);
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

  private renderDensityCircleAndArrow(system: System): void {
    if (!this.cursorPosition) return;

    this.ctx.save();

    const fluid = system.forces.find(
      (force) => force instanceof Fluid
    ) as Fluid;

    // Define constant screen-space radius (in pixels) for density visualization
    const screenRadius = 60; // 60 pixels constant radius
    const worldRadius = screenRadius / this.zoom; // Convert to world space for calculations

    // Get particles near cursor using the zoom-adjusted radius
    const particles = system.spatialGrid.getParticles(
      this.cursorPosition,
      worldRadius
    );

    // Calculate density at cursor position using the zoom-adjusted radius
    const density = calculateDensity(
      this.cursorPosition,
      worldRadius,
      particles
    );

    const vector = fluid.calculatePressureForce(this.cursorPosition, particles);
    const force =
      density > 0
        ? vector.clone().normalize().multiply(worldRadius)
        : Vector2D.zero();
    // not devided by density

    // Use same color palette as spatial grid
    const baseColor = "#dee7f0";

    // Draw circle at cursor with constant screen radius
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2 / this.zoom; // Scale line width to maintain constant screen thickness
    this.ctx.globalAlpha = 0.6;
    const dashSize = 5 / this.zoom; // Scale dash pattern with zoom
    this.ctx.setLineDash([dashSize, dashSize]);

    this.ctx.beginPath();
    this.ctx.arc(
      this.cursorPosition.x,
      this.cursorPosition.y,
      worldRadius, // Use world radius for drawing
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // draw arrow from cursor position to force vector
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 2 / this.zoom; // Scale line width to maintain constant screen thickness
    this.ctx.beginPath();
    this.ctx.moveTo(this.cursorPosition.x, this.cursorPosition.y);
    this.ctx.lineTo(
      this.cursorPosition.x + force.x,
      this.cursorPosition.y + force.y
    );
    this.ctx.stroke();

    this.ctx.restore();
  }

  private renderDensityInfoBox(system: System): void {
    if (!this.cursorPosition) return;

    this.ctx.save();

    const fluid = system.forces.find(
      (force) => force instanceof Fluid
    ) as Fluid;

    // Use the same constant screen-space radius as the circle visualization
    const screenRadius = 60; // 60 pixels constant radius
    const worldRadius = screenRadius / this.zoom; // Convert to world space for calculations

    // Get particles near cursor using the zoom-adjusted radius
    const particles = system.spatialGrid.getParticles(
      this.cursorPosition,
      worldRadius
    );

    // Calculate density at cursor position using the zoom-adjusted radius
    const density = calculateDensity(
      this.cursorPosition,
      worldRadius,
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

  private renderRemovalPreview(preview: {
    position: Vector2D;
    radius: number;
  }): void {
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
    this.ctx.arc(
      preview.position.x,
      preview.position.y,
      worldRadius,
      0,
      2 * Math.PI
    );
    this.ctx.stroke();
  }

  private renderDensityField(system: System): void {
    if (!this.showDensity) return;

    const fluid = system.forces.find(
      (force) => force instanceof Fluid
    ) as Fluid;
    if (!fluid || !fluid.enabled) return;

    // Performance optimization: Update density field every 3 frames
    this.densityFieldFrameCount++;

    this.ctx.save();

    // Reset transform to work in screen coordinates for ImageData
    this.ctx.resetTransform();

    // Adaptive sampling resolution based on zoom level
    const sampleResolution = Math.max(4, Math.floor(this.zoom / 8));
    const influenceRadius = fluid.influenceRadius;

    // Create ImageData for efficient pixel manipulation
    const imageData = this.ctx.createImageData(
      this.canvas.width,
      this.canvas.height
    );
    const data = imageData.data;

    // Parse hex color to RGB
    const hexColor = this.densityFieldColor;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Find maximum density for normalization
    let maxDensity = 0;
    const densityValues: number[][] = [];

    // Pre-calculate density values and find maximum
    for (
      let screenX = 0;
      screenX < this.canvas.width;
      screenX += sampleResolution
    ) {
      densityValues[screenX] = [];
      for (
        let screenY = 0;
        screenY < this.canvas.height;
        screenY += sampleResolution
      ) {
        const worldPos = this.screenToWorld(screenX, screenY);
        const worldPoint = new Vector2D(worldPos.x, worldPos.y);

        // Get nearby particles using spatial grid
        const nearbyParticles = system.spatialGrid.getParticles(
          worldPoint,
          influenceRadius
        );

        // Calculate density at this point
        const density = calculateDensity(
          worldPoint,
          influenceRadius,
          nearbyParticles
        );
        densityValues[screenX][screenY] = density;
        maxDensity = Math.max(maxDensity, density);
      }
    }

    // Render density field using ImageData
    for (
      let screenX = 0;
      screenX < this.canvas.width;
      screenX += sampleResolution
    ) {
      for (
        let screenY = 0;
        screenY < this.canvas.height;
        screenY += sampleResolution
      ) {
        const density = densityValues[screenX][screenY];

        if (density > 0) {
          // Normalize density to [0, 1] range
          const normalizedDensity = Math.min(density / (maxDensity * 0.5), 1);
          const alpha = Math.floor(normalizedDensity * 255);

          // Fill a block of pixels for the sample resolution
          for (
            let dx = 0;
            dx < sampleResolution && screenX + dx < this.canvas.width;
            dx++
          ) {
            for (
              let dy = 0;
              dy < sampleResolution && screenY + dy < this.canvas.height;
              dy++
            ) {
              const pixelX = screenX + dx;
              const pixelY = screenY + dy;
              const index = (pixelY * this.canvas.width + pixelX) * 4;

              if (index < data.length) {
                data[index] = r; // Red
                data[index + 1] = g; // Green
                data[index + 2] = b; // Blue
                data[index + 3] = alpha; // Alpha
              }
            }
          }
        }
      }
    }

    // Apply the density field to the canvas
    this.ctx.putImageData(imageData, 0, 0);

    this.ctx.restore();
  }

  // Override to handle world-to-screen coordinate transformation
  public readPixelIntensity(
    worldX: number,
    worldY: number,
    radius: number
  ): number {
    // Convert world coordinates to screen coordinates
    const screenCoords = this.worldToScreen(worldX, worldY);
    return super.readPixelIntensity(screenCoords.x, screenCoords.y, radius);
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
