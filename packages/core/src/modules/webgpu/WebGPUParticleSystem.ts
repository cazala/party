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
  time: number;
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
  
  private vertexBuffer: GPUBuffer | null = null;
  private forceUniformBuffer: GPUBuffer | null = null;
  private renderUniformBuffer: GPUBuffer | null = null;
  
  private renderBindGroup: GPUBindGroup | null = null;
  
  private renderPipeline: GPURenderPipeline | null = null;
  
  private particleCount: number = 0;
  private maxParticles: number = 100000;
  private startTime: number = 0;
  
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
    this.startTime = performance.now();
  }

  private async createBuffers(): Promise<void> {
    // Create vertex buffer for particle data
    const particleDataSize = this.maxParticles * 6 * 4; // 6 floats per particle * 4 bytes per float
    this.vertexBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create force uniform buffer (gravity_strength, gravity_direction, time, padding1, padding2)
    this.forceUniformBuffer = this.device.createBuffer({
      size: 32, // 8 floats * 4 bytes (with padding for alignment)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create render uniform buffer (canvas_size, camera_position, zoom, padding)
    this.renderUniformBuffer = this.device.createBuffer({
      size: 24, // 6 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    // Load shader code (only render shader now)
    console.log("Loading render shader code...");
    const renderShaderCode = await this.loadShader('render.wgsl');
    console.log("Shader code loaded");

    // Create render shader module
    console.log("Creating render shader module...");
    const renderShaderModule = this.device.createShaderModule({
      code: renderShaderCode,
    });
    console.log("Render shader module created successfully");

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
                shaderLocation: 0, // initial_position
              },
              {
                format: 'float32x2', 
                offset: 8,
                shaderLocation: 1, // initial_velocity
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
    if (!this.renderPipeline || !this.vertexBuffer || !this.forceUniformBuffer || !this.renderUniformBuffer) {
      throw new Error('Pipeline or buffers not created');
    }

    // Create render bind group with both uniforms
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.forceUniformBuffer,
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
    // Render shader with simple gravity physics
    if (filename === 'render.wgsl') {
      return `
struct ForceUniforms {
  time: f32,
  gravity_strength: f32,
  gravity_direction_x: f32,
  gravity_direction_y: f32,
  _padding1: f32,
  _padding2: f32,
  _padding3: f32,
  _padding4: f32,
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
  @location(1) color: vec3<f32>,
}

@group(0) @binding(0) var<uniform> force_uniforms: ForceUniforms;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
  @location(0) initial_position: vec2<f32>,
  @location(1) initial_velocity: vec2<f32>,
  @location(2) size: f32,
  @location(3) mass: f32
) -> VertexOutput {
  var out: VertexOutput;
  
  // Proper gravity physics!
  var current_position = initial_position;
  
  // Base falling speed (always fall down a bit)
  current_position.y -= force_uniforms.time * 50.0;
  
  // Gravity acceleration - makes particles fall faster over time
  let gravity_acceleration = force_uniforms.gravity_strength;
  current_position.y -= 0.5 * gravity_acceleration * force_uniforms.time * force_uniforms.time;
  
  // Create quad geometry
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
  
  // Transform to screen space
  let world_pos = (current_position - render_uniforms.camera_position) * render_uniforms.zoom;
  let screen_pos = (world_pos / render_uniforms.canvas_size) * 2.0 - 1.0;
  let scaled_quad = quad_pos * size * render_uniforms.zoom / render_uniforms.canvas_size;
  
  out.position = vec4<f32>(screen_pos + scaled_quad, 0.0, 1.0);
  out.uv = quad_uvs[vertex_index];
  
  // Test both time and gravity
  let time_component = clamp(force_uniforms.time * 0.1, 0.0, 1.0);
  let gravity_component = clamp(force_uniforms.gravity_strength * 0.1, 0.0, 1.0);
  out.color = vec3<f32>(gravity_component, time_component, 1.0); // Red=gravity, Green=time, Blue=constant
  
  return out;
}

@fragment
fn fs_main(
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>
) -> @location(0) vec4<f32> {
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let radius = 0.5;
  let alpha = 1.0 - smoothstep(radius - 0.05, radius, dist);
  return vec4<f32>(color, alpha);
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
    if (!this.vertexBuffer) return;

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

    // Write to vertex buffer
    this.device.queue.writeBuffer(this.vertexBuffer, 0, data);
  }

  updateForces(uniforms: ForceUniforms): void {
    if (!this.forceUniformBuffer) return;

    const data = new Float32Array([
      uniforms.time,                 // time: f32
      uniforms.gravityStrength,      // gravity_strength: f32
      uniforms.gravityDirection[0],  // gravity_direction_x: f32
      uniforms.gravityDirection[1],  // gravity_direction_y: f32
      0.0,                          // _padding1
      0.0,                          // _padding2
      0.0,                          // _padding3
      0.0                           // _padding4
    ]);

    // ALWAYS log to debug what we're actually sending to GPU
    console.log("Writing force uniforms to GPU:", {
      gravityStrength: data[0],
      gravityDirection: [data[1], data[2]],
      time: data[3],
      padding: [data[4], data[5]],
      fullArray: Array.from(data),
      inputTime: uniforms.time
    });

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
    // Update force uniforms with time since start
    const currentTime = (performance.now() - this.startTime) / 1000; // Convert to seconds
    
    // ALWAYS log to debug time issue
    console.log("WebGPU particle system update:", {
      deltaTime: deltaTime.toFixed(4),
      gravityStrength,
      particleCount: this.particleCount,
      time: currentTime.toFixed(2),
      startTime: this.startTime,
      performanceNow: performance.now(),
      timeDiff: performance.now() - this.startTime,
      gravityDirection: [0, 1]
    });

    this.updateForces({
      gravityStrength,
      gravityDirection: [0, 1], // Down
      deltaTime,
      time: currentTime,
    });
  }


  render(canvasSize: [number, number], cameraPosition: [number, number], zoom: number): void {
    if (!this.renderPipeline || !this.renderBindGroup || this.particleCount === 0) return;

    this.updateRender({
      canvasSize,
      cameraPosition,
      zoom,
      _padding: 0,
    });

    // Create command encoder for rendering
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

    // Submit render commands
    this.device.queue.submit([commandEncoder.finish()]);
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  clear(): void {
    this.particleCount = 0;
    this.startTime = performance.now(); // Reset time when clearing
  }

  destroy(): void {
    this.vertexBuffer?.destroy();
    this.forceUniformBuffer?.destroy();
    this.renderUniformBuffer?.destroy();
    
    this.vertexBuffer = null;
    this.forceUniformBuffer = null;
    this.renderUniformBuffer = null;
    this.renderBindGroup = null;
    this.renderPipeline = null;
  }
}