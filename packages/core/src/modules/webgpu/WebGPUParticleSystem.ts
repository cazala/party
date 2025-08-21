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
  private forceUniformBuffer: GPUBuffer | null = null;
  private renderUniformBuffer: GPUBuffer | null = null;
  
  private computeBindGroup: GPUBindGroup | null = null;
  private renderBindGroup: GPUBindGroup | null = null;
  
  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  
  private particles: WebGPUParticle[] = [];
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
    // Create particle buffer (storage buffer)
    const particleDataSize = this.maxParticles * 6 * 4; // 6 floats per particle * 4 bytes per float
    this.particleBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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

    // Create render pipeline
    console.log("Creating render pipeline...");
    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: renderShaderModule,
        entryPoint: 'vs_main',
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
        !this.particleBuffer || !this.forceUniformBuffer || !this.renderUniformBuffer) {
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
            buffer: this.particleBuffer,
          },
        },
        {
          binding: 1,
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
  
  // Update position
  particle.position += particle.velocity * force_uniforms.delta_time;
  
  // Store updated particle
  particles[index] = particle;
}`;
    } else if (filename === 'render.wgsl') {
      return `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

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

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
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
  
  let particle = particles[instance_index];
  let quad_pos = quad_positions[vertex_index];
  
  let world_pos = (particle.position - render_uniforms.camera_position) * render_uniforms.zoom;
  let screen_pos = (world_pos / render_uniforms.canvas_size) * 2.0 - 1.0;
  let scaled_quad = quad_pos * particle.size * render_uniforms.zoom / render_uniforms.canvas_size;
  
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
    this.particles = particles.slice(0, this.maxParticles);
    this.updateParticleBuffer();
  }

  addParticle(particle: WebGPUParticle): void {
    if (this.particles.length < this.maxParticles) {
      this.particles.push(particle);
      this.updateParticleBuffer();
    }
  }

  private updateParticleBuffer(): void {
    if (!this.particleBuffer) return;

    const data = new Float32Array(this.particles.length * 6);
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const offset = i * 6;
      data[offset] = particle.position[0];
      data[offset + 1] = particle.position[1];
      data[offset + 2] = particle.velocity[0];
      data[offset + 3] = particle.velocity[1];
      data[offset + 4] = particle.size;
      data[offset + 5] = particle.mass;
    }

    this.device.queue.writeBuffer(this.particleBuffer, 0, data);
  }

  updateForces(uniforms: ForceUniforms): void {
    if (!this.forceUniformBuffer) return;

    const data = new Float32Array([
      uniforms.gravityStrength,
      uniforms.gravityDirection[0],
      uniforms.gravityDirection[1],
      uniforms.deltaTime,
      uniforms.particleCount,
      0, 0, 0 // padding for alignment
    ]);

    this.device.queue.writeBuffer(this.forceUniformBuffer, 0, data);
  }

  updateRender(uniforms: RenderUniforms): void {
    if (!this.renderUniformBuffer) return;

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

    this.updateForces({
      gravityStrength,
      gravityDirection: [0, 1], // Down
      deltaTime,
      particleCount: this.particles.length,
    });

    const commandEncoder = this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    
    const workgroupCount = Math.ceil(this.particles.length / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  render(canvasSize: [number, number], cameraPosition: [number, number], zoom: number): void {
    if (!this.renderPipeline || !this.renderBindGroup || this.particles.length === 0) return;

    this.updateRender({
      canvasSize,
      cameraPosition,
      zoom,
      _padding: 0,
    });

    const commandEncoder = this.device.createCommandEncoder();
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
    renderPass.draw(4, this.particles.length); // 4 vertices per quad, instanced
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  clear(): void {
    this.particles = [];
    this.updateParticleBuffer();
  }

  destroy(): void {
    this.particleBuffer?.destroy();
    this.forceUniformBuffer?.destroy();
    this.renderUniformBuffer?.destroy();
    
    this.particleBuffer = null;
    this.forceUniformBuffer = null;
    this.renderUniformBuffer = null;
    this.computeBindGroup = null;
    this.renderBindGroup = null;
    this.computePipeline = null;
    this.renderPipeline = null;
  }
}