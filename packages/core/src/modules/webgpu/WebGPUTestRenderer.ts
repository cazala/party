import { WebGPUDevice } from './WebGPUDevice';

export interface WebGPUTestRendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class WebGPUTestRenderer {
  private webgpuDevice: WebGPUDevice;
  
  constructor(options: WebGPUTestRendererOptions) {
    this.webgpuDevice = new WebGPUDevice({ canvas: options.canvas });
  }

  async initialize(): Promise<boolean> {
    console.log("WebGPUTestRenderer: Starting minimal initialization...");
    
    // Just test device initialization
    const success = await this.webgpuDevice.initialize();
    console.log("WebGPUTestRenderer: Device initialization result:", success);
    
    if (!success || !this.webgpuDevice.device) return false;
    
    try {
      // Test basic buffer creation
      console.log("WebGPUTestRenderer: Testing buffer creation...");
      const testBuffer = this.webgpuDevice.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      console.log("WebGPUTestRenderer: Buffer created successfully");
      testBuffer.destroy();
      
      // Test simple shader
      console.log("WebGPUTestRenderer: Testing shader creation...");
      const shaderModule = this.webgpuDevice.device.createShaderModule({
        code: `
          @vertex
          fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 3>(
              vec2<f32>( 0.0,  0.5),
              vec2<f32>(-0.5, -0.5),
              vec2<f32>( 0.5, -0.5)
            );
            return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
          }
          
          @fragment
          fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 1.0, 1.0, 1.0);
          }
        `,
      });
      console.log("WebGPUTestRenderer: Shader created successfully");
      
      // Test simple pipeline
      console.log("WebGPUTestRenderer: Testing pipeline creation...");
      const pipeline = this.webgpuDevice.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: this.webgpuDevice.format,
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
      console.log("WebGPUTestRenderer: Pipeline created successfully", pipeline);
      
      console.log("WebGPUTestRenderer: All tests passed!");
      return true;
    } catch (error) {
      console.error('WebGPUTestRenderer: Test failed:', error);
      return false;
    }
  }

  render(): void {
    if (!this.webgpuDevice.device || !this.webgpuDevice.context) return;
    
    const commandEncoder = this.webgpuDevice.device.createCommandEncoder();
    const textureView = this.webgpuDevice.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    
    renderPass.end();
    this.webgpuDevice.device.queue.submit([commandEncoder.finish()]);
  }

  destroy(): void {
    this.webgpuDevice.destroy();
  }
}