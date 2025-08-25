export interface WebGPUDeviceOptions {
  canvas: HTMLCanvasElement;
  requiredFeatures?: GPUFeatureName[];
}

export class WebGPUDevice {
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public adapter: GPUAdapter | null = null;
  public format: GPUTextureFormat = "bgra8unorm";

  constructor(private options: WebGPUDeviceOptions) {}

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error("WebGPU not supported");
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter();

      if (!this.adapter) {
        console.error("Failed to get WebGPU adapter");
        return false;
      }

      this.device = await this.adapter.requestDevice({
        requiredFeatures: this.options.requiredFeatures || [],
      });

      this.context = this.options.canvas.getContext("webgpu");
      if (!this.context) {
        console.error("Failed to get WebGPU context");
        return false;
      }

      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied",
      });
      return true;
    } catch (error) {
      console.error("Failed to initialize WebGPU:", error);
      return false;
    }
  }

  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.context = null;
    this.adapter = null;
  }

  isInitialized(): boolean {
    return this.device !== null && this.context !== null;
  }
}
