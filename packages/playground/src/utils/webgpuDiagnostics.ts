export async function diagnoseWebGPU(): Promise<{
  supported: boolean;
  error?: string;
  details?: any;
}> {
  console.log("=== WebGPU Diagnostics ===");
  
  // Check basic support
  if (!navigator.gpu) {
    return {
      supported: false,
      error: "navigator.gpu not available",
    };
  }

  try {
    // Request adapter
    console.log("Requesting adapter...");
    const adapter = await navigator.gpu.requestAdapter();
    
    if (!adapter) {
      return {
        supported: false,
        error: "No WebGPU adapter available",
      };
    }

    console.log("Adapter obtained:", adapter);
    console.log("Adapter features:", Array.from(adapter.features || []));
    console.log("Adapter limits:", adapter.limits);

    // Request device
    console.log("Requesting device...");
    const device = await adapter.requestDevice();
    
    if (!device) {
      return {
        supported: false,
        error: "Failed to create WebGPU device",
      };
    }

    console.log("Device obtained:", device);

    // Test canvas context
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgpu');
    
    if (!context) {
      return {
        supported: false,
        error: "Failed to get WebGPU canvas context",
      };
    }

    console.log("Canvas context obtained");

    // Test basic buffer creation
    try {
      const buffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      console.log("Test buffer created successfully");
      buffer.destroy();
    } catch (error) {
      return {
        supported: false,
        error: "Failed to create test buffer: " + (error as Error).message,
      };
    }

    // Test shader module creation
    try {
      const shaderModule = device.createShaderModule({
        code: `
          @compute @workgroup_size(1)
          fn main() {
            // Empty compute shader for testing
          }
        `,
      });
      console.log("Test shader module created successfully", shaderModule);
    } catch (error) {
      return {
        supported: false,
        error: "Failed to create test shader: " + (error as Error).message,
      };
    }

    device.destroy();

    return {
      supported: true,
      details: {
        adapterFeatures: Array.from(adapter.features || []),
        adapterLimits: adapter.limits,
      },
    };

  } catch (error) {
    return {
      supported: false,
      error: "WebGPU diagnostic error: " + (error as Error).message,
    };
  }
}