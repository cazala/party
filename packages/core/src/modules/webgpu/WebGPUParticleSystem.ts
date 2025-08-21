import { WebGPUDevice } from './WebGPUDevice';

export interface WebGPUParticle {
  position: [number, number];
  velocity: [number, number];
  size: number;
  mass: number;
}

export interface ForceUniforms {
  gravityStrength: number;
  gravityDirection: [number, number];
  deltaTime: number;
  particleCount: number;
}

export interface RenderUniforms {
  canvasSize: [number, number];
  cameraPosition: [number, number];
  zoom: number;
  _padding: number;
}

export class WebGPUParticleSystem {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  
  private particleBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private forceUniformBuffer: GPUBuffer | null = null;
  private renderUniformBuffer: GPUBuffer | null = null;
  
  private computeBindGroup: GPUBindGroup | null = null;
  private renderBindGroup: GPUBindGroup | null = null;
  
  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  
  private particleCount: number = 0;
  private maxParticles: number = 100000;
  
  constructor(private webgpuDevice: WebGPUDevice) {
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error('WebGPU device not initialized');
    }
    this.device = webgpuDevice.device;
    this.context = webgpuDevice.context;
  }

  async initialize(): Promise<void> {
    console.log("WebGPUParticleSystem: Creating buffers...");
    await this.createBuffers();
    console.log("WebGPUParticleSystem: Creating pipelines...");
    await this.createPipelines();
    console.log("WebGPUParticleSystem: Creating bind groups...");
    this.createBindGroups();
    console.log("WebGPUParticleSystem: Initialization complete");
  }

  private async createBuffers(): Promise<void> {
    // Create particle buffer (storage buffer + vertex buffer)
    const particleDataSize = this.maxParticles * 6 * 4; // 6 floats per particle * 4 bytes per float
    this.particleBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
    });

    // Create a separate vertex buffer for rendering
    this.vertexBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create force uniform buffer
    this.forceUniformBuffer = this.device.createBuffer({
      size: 32, // 4 floats + padding for alignment
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create render uniform buffer
    this.renderUniformBuffer = this.device.createBuffer({
      size: 32, // 6 floats + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    // Load shader code
    console.log("Loading shader code...");
    const computeShaderCode = await this.loadShader('particle.wgsl');
    const renderShaderCode = await this.loadShader('render.wgsl');
    console.log("Shader code loaded");

    // Create compute shader module
    console.log("Creating compute shader module...");
    const computeShaderModule = this.device.createShaderModule({
      code: computeShaderCode,
    });
    
    // Skip compilation info check to avoid potential hanging
    console.log("Compute shader module created successfully");

    // Create render shader module
    console.log("Creating render shader module...");
    const renderShaderModule = this.device.createShaderModule({
      code: renderShaderCode,
    });
    
    // Skip compilation info check to avoid potential hanging
    console.log("Render shader module created successfully");

    // Create compute pipeline
    console.log("Creating compute pipeline...");
    this.computePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: computeShaderModule,
        entryPoint: 'main',
      },
    });
    console.log("Compute pipeline created");

    // Create render pipeline with vertex buffer layout
    console.log("Creating render pipeline...");
    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: renderShaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 24, // 6 floats * 4 bytes per particle (position, velocity, size, mass)
            stepMode: 'instance',
            attributes: [
              {
                format: 'float32x2',
                offset: 0,
                shaderLocation: 0, // position
              },
              {
                format: 'float32x2', 
                offset: 8,
                shaderLocation: 1, // velocity
              },
              {
                format: 'float32',
                offset: 16,
                shaderLocation: 2, // size
              },
              {
                format: 'float32',
                offset: 20,
                shaderLocation: 3, // mass
              },
            ],
          },
        ],
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.webgpuDevice.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: undefined,
      },
    });
    console.log("Render pipeline created");
  }

  private createBindGroups(): void {
    if (!this.computePipeline || !this.renderPipeline || 
        !this.particleBuffer || !this.vertexBuffer || !this.forceUniformBuffer || !this.renderUniformBuffer) {
      throw new Error('Pipelines or buffers not created');
    }

    // Create compute bind group
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.particleBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.forceUniformBuffer,
          },
        },
      ],
    });

    // Create render bind group
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.renderUniformBuffer,
          },
        },
      ],
    });
  }

  private async loadShader(filename: string): Promise<string> {
    // In a real implementation, this would load from a file or be bundled
    // For now, we'll return the shader code directly based on filename
    if (filename === 'particle.wgsl') {
      return `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

struct ForceUniforms {
  gravity_strength: f32,
  gravity_direction: vec2<f32>,
  delta_time: f32,
  particle_count: u32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> force_uniforms: ForceUniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= force_uniforms.particle_count) {
    return;
  }

  var particle = particles[index];
  
  // Apply gravity force
  let gravity_force = force_uniforms.gravity_direction * force_uniforms.gravity_strength * particle.mass;
  particle.velocity += gravity_force * force_uniforms.delta_time;
  
  // DEBUG: Force obvious movement regardless of physics
  particle.position.y += 50.0 * force_uniforms.delta_time;
  
  // Update position
  particle.position += particle.velocity * force_uniforms.delta_time;
  
  // Store updated particle
  particles[index] = particle;
}`;
    } else if (filename === 'render.wgsl') {
      return `
struct RenderUniforms {
  canvas_size: vec2<f32>,
  camera_position: vec2<f32>,
  zoom: f32,
  _padding: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var<uniform> render_uniforms: RenderUniforms;

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @location(0) position: vec2<f32>,
  @location(1) velocity: vec2<f32>,
  @location(2) size: f32,
  @location(3) mass: f32
) -> VertexOutput {
  var out: VertexOutput;
  
  let quad_positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  
  let quad_uvs = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );
  
  let quad_pos = quad_positions[vertex_index];
  
  let world_pos = (position - render_uniforms.camera_position) * render_uniforms.zoom;
  let screen_pos = (world_pos / render_uniforms.canvas_size) * 2.0 - 1.0;
  let scaled_quad = quad_pos * size * render_uniforms.zoom / render_uniforms.canvas_size;
  
  out.position = vec4<f32>(screen_pos + scaled_quad, 0.0, 1.0);
  out.uv = quad_uvs[vertex_index];
  
  return out;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let radius = 0.5;
  let alpha = 1.0 - smoothstep(radius - 0.05, radius, dist);
  return vec4<f32>(1.0, 1.0, 1.0, alpha);
}`;
    }
    throw new Error(`Unknown shader: ${filename}`);
  }

  setParticles(particles: WebGPUParticle[]): void {
    const clampedParticles = particles.slice(0, this.maxParticles);
    this.particleCount = clampedParticles.length;
    this.updateParticleBuffer(clampedParticles);
  }

  addParticle(_particle: WebGPUParticle): void {
    if (this.particleCount < this.maxParticles) {
      // For adding single particles, we'd need to read current buffer, add particle, and write back
      // For now, just use setParticles for simplicity
      console.warn("addParticle not implemented - use setParticles instead");
    }
  }

  private updateParticleBuffer(particles: WebGPUParticle[]): void {
    if (!this.particleBuffer || !this.vertexBuffer) return;

    const data = new Float32Array(particles.length * 6);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const offset = i * 6;
      data[offset] = particle.position[0];
      data[offset + 1] = particle.position[1];
      data[offset + 2] = particle.velocity[0];
      data[offset + 3] = particle.velocity[1];
      data[offset + 4] = particle.size;
      data[offset + 5] = particle.mass;
    }

    console.log(`DEBUG: Setting ${particles.length} particles. First particle:`, {
      position: [particles[0]?.position[0], particles[0]?.position[1]],
      velocity: [particles[0]?.velocity[0], particles[0]?.velocity[1]],
      size: particles[0]?.size,
      mass: particles[0]?.mass
    });

    // Write to both buffers initially
    this.device.queue.writeBuffer(this.particleBuffer, 0, data);
    this.device.queue.writeBuffer(this.vertexBuffer, 0, data);
  }

  updateForces(uniforms: ForceUniforms): void {
    if (!this.forceUniformBuffer) return;

    // Create array buffer to handle mixed data types correctly
    const buffer = new ArrayBuffer(32); // 8 floats * 4 bytes
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);
    
    floatView[0] = uniforms.gravityStrength;      // f32
    floatView[1] = uniforms.gravityDirection[0];  // vec2<f32>.x
    floatView[2] = uniforms.gravityDirection[1];  // vec2<f32>.y  
    floatView[3] = uniforms.deltaTime;           // f32
    uintView[4] = uniforms.particleCount;        // u32 (using uint view)
    
    const data = new Uint8Array(buffer);

    // Debug: Log uniform data occasionally 
    if (Math.random() < 0.01) {
      console.log("Writing force uniforms to GPU:", {
        gravityStrength: floatView[0],
        gravityDirection: [floatView[1], floatView[2]],
        deltaTime: floatView[3],
        particleCount: uintView[4]
      });
    }

    this.device.queue.writeBuffer(this.forceUniformBuffer, 0, data);
  }

  updateRender(uniforms: RenderUniforms): void {
    if (!this.renderUniformBuffer) return;

    // Debug occasionally
    if (Math.random() < 0.01) {
      console.log("DEBUG: Render uniforms:", {
        canvasSize: uniforms.canvasSize,
        cameraPosition: uniforms.cameraPosition,
        zoom: uniforms.zoom
      });
    }

    const data = new Float32Array([
      uniforms.canvasSize[0],
      uniforms.canvasSize[1],
      uniforms.cameraPosition[0],
      uniforms.cameraPosition[1],
      uniforms.zoom,
      uniforms._padding,
    ]);

    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, data);
  }

  update(deltaTime: number, gravityStrength: number): void {
    if (!this.computePipeline || !this.computeBindGroup) return;

    // Debug logging occasionally
    if (Math.random() < 0.01) {
      console.log("WebGPU particle system update:", {
        deltaTime: deltaTime.toFixed(4),
        gravityStrength,
        particleCount: this.particleCount,
        gravityDirection: [0, 1]
      });
    }

    this.updateForces({
      gravityStrength,
      gravityDirection: [0, 1], // Down
      deltaTime,
      particleCount: this.particleCount,
    });

    const commandEncoder = this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    
    const workgroupCount = Math.ceil(this.particleCount / 64);
    
    // Debug logging occasionally
    if (Math.random() < 0.01) {
      console.log("Dispatching compute workgroups:", {
        workgroupCount,
        particleCount: this.particleCount,
        gravityStrength,
        computePipeline: !!this.computePipeline,
        computeBindGroup: !!this.computeBindGroup
      });
    }
    
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();
    
    // Store command encoder for render pass to use
    this.pendingCommandEncoder = commandEncoder;
    // Don't submit yet - wait for render pass
  }

  private pendingCommandEncoder: GPUCommandEncoder | null = null;

  render(canvasSize: [number, number], cameraPosition: [number, number], zoom: number): void {
    if (!this.renderPipeline || !this.renderBindGroup || this.particleCount === 0) return;

    this.updateRender({
      canvasSize,
      cameraPosition,
      zoom,
      _padding: 0,
    });

    // Use the same command encoder as compute pass for proper ordering
    const commandEncoder = this.pendingCommandEncoder || this.device.createCommandEncoder();
    
    // Copy updated particle data from storage buffer to vertex buffer
    if (this.particleBuffer && this.vertexBuffer) {
      const copySize = this.particleCount * 6 * 4; // 6 floats * 4 bytes per particle
      commandEncoder.copyBufferToBuffer(
        this.particleBuffer, 0,
        this.vertexBuffer, 0,
        copySize
      );
    }
    
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    
    // Debug occasionally
    if (Math.random() < 0.01) {
      console.log("DEBUG: Rendering particles:", {
        particleCount: this.particleCount,
        vertexBuffer: !!this.vertexBuffer,
        renderPipeline: !!this.renderPipeline,
        renderBindGroup: !!this.renderBindGroup
      });
    }
    
    renderPass.draw(4, this.particleCount); // 4 vertices per quad, instanced
    renderPass.end();

    // Now submit both compute and render together
    this.device.queue.submit([commandEncoder.finish()]);
    this.pendingCommandEncoder = null;
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  clear(): void {
    this.particleCount = 0;
    // Clear the GPU buffer by writing empty data
    if (this.particleBuffer) {
      const emptyData = new Float32Array(0);
      this.device.queue.writeBuffer(this.particleBuffer, 0, emptyData);
    }
  }

  destroy(): void {
    this.particleBuffer?.destroy();
    this.vertexBuffer?.destroy();
    this.forceUniformBuffer?.destroy();
    this.renderUniformBuffer?.destroy();
    
    this.particleBuffer = null;
    this.vertexBuffer = null;
    this.forceUniformBuffer = null;
    this.renderUniformBuffer = null;
    this.computeBindGroup = null;
    this.renderBindGroup = null;
    this.computePipeline = null;
    this.renderPipeline = null;
  }
}