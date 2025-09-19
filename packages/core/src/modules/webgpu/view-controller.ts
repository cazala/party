import { GPUResources } from "./gpu-resources";

export interface ViewSnapshot {
  width: number;
  height: number;
  cx: number;
  cy: number;
  zoom: number;
}

export class ViewController {
  private width: number;
  private height: number;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1;
  private minZoom: number = 0.01;
  private maxZoom: number = 5;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  setCamera(x: number, y: number): void {
    this.cameraX = x;
    this.cameraY = y;
  }

  getCamera(): { x: number; y: number } {
    return { x: this.cameraX, y: this.cameraY };
  }

  setZoom(zoom: number): void {
    const size = this.getSize();
    const maxBytes = 120 * 1024 * 1024; // safety threshold below typical 128MB default
    const minZoomByGrid = Math.sqrt((4 * size.width * size.height) / maxBytes);
    const minZoom = Math.max(0.01, minZoomByGrid);
    const clamped = Math.max(minZoom, Math.min(zoom, this.maxZoom));
    this.zoom = clamped;
  }

  getZoom(): number {
    return this.zoom;
  }

  /**
   * Optional: allow external systems (e.g., GridSystem) to update zoom limits.
   */
  setZoomLimits(minZoom: number, maxZoom: number): void {
    this.minZoom = Math.max(0.0001, minZoom);
    this.maxZoom = Math.max(this.minZoom, maxZoom);
    this.setZoom(this.zoom);
  }

  getSnapshot(): ViewSnapshot {
    return {
      width: this.width,
      height: this.height,
      cx: this.cameraX,
      cy: this.cameraY,
      zoom: this.zoom,
    };
  }

  /**
   * Writes the render uniforms: [canvasWidth, canvasHeight, cameraX, cameraY, zoom, padding]
   */
  writeRenderUniforms(resources: GPUResources): void {
    const data = new Float32Array([
      this.width,
      this.height,
      this.cameraX,
      this.cameraY,
      this.zoom,
      0,
    ]);
    resources.writeRenderUniforms(data);
  }
}
