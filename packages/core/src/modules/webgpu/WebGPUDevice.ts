export interface WebGPUDeviceOptions {
  canvas: HTMLCanvasElement;
  requiredFeatures?: GPUFeatureName[];
}

export class WebGPUDevice {
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public adapter: GPUAdapter | null = null;
  public format: GPUTextureFormat = 'bgra8unorm';
  
  constructor(private options: WebGPUDeviceOptions) {}

  async initialize(): Promise<boolean> {
    console.log("WebGPUDevice: Checking WebGPU support...");
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return false;
    }

    console.log("WebGPU is supported, requesting adapter...");

    try {
      this.adapter = await navigator.gpu.requestAdapter();
      console.log("WebGPU adapter:", this.adapter);
      
      if (!this.adapter) {
        console.error('Failed to get WebGPU adapter');
        return false;
      }

      console.log("Requesting WebGPU device...");
      this.device = await this.adapter.requestDevice({
        requiredFeatures: this.options.requiredFeatures || [],
      });
      console.log("WebGPU device:", this.device);

      console.log("Getting WebGPU canvas context...");
      this.context = this.options.canvas.getContext('webgpu');
      if (!this.context) {
        console.error('Failed to get WebGPU context');
        return false;
      }

      console.log("Configuring WebGPU context...");
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'premultiplied',
      });

      console.log("WebGPU device initialized successfully");
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
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