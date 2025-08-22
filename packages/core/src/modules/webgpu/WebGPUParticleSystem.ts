import { WebGPUDevice } from "./WebGPUDevice";

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

  private particleBuffer: GPUBuffer | null = null;
  private forceUniformBuffer: GPUBuffer | null = null;
  private renderUniformBuffer: GPUBuffer | null = null;

  private renderBindGroup: GPUBindGroup | null = null;
  private computeBindGroup: GPUBindGroup | null = null;

  private renderPipeline: GPURenderPipeline | null = null;
  private computePipeline: GPUComputePipeline | null = null;

  private particleCount: number = 0;
  private maxParticles: number = 100000;

  constructor(private webgpuDevice: WebGPUDevice) {
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error("WebGPU device not initialized");
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
    // Create storage buffer for particle data (position vec2, velocity vec2, size f32, mass f32)
    const particleDataSize = this.maxParticles * 6 * 4; // 6 floats per particle * 4 bytes per float
    this.particleBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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
    // Load shader code (render + compute)
    console.log("Loading shader code...");
    const renderShaderCode = await this.loadRenderShader();
    const computeShaderCode = await this.loadComputeShader();
    console.log("Shader code loaded");

    // Create render shader module
    console.log("Creating render shader module...");
    const renderShaderModule = this.device.createShaderModule({
      code: renderShaderCode,
    });
    console.log("Render shader module created successfully");

    // Create compute shader module
    console.log("Creating compute shader module...");
    const computeShaderModule = this.device.createShaderModule({
      code: computeShaderCode,
    });
    console.log("Compute shader module created successfully");

    // Create render pipeline (reads particles from storage buffer)
    console.log("Creating render pipeline...");
    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderShaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.webgpuDevice.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-strip",
        stripIndexFormat: undefined,
      },
    });
    console.log("Render pipeline created");

    // Create compute pipeline (updates positions/velocities)
    console.log("Creating compute pipeline...");
    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: computeShaderModule,
        entryPoint: "main",
      },
    });
    console.log("Compute pipeline created");
  }

  private createBindGroups(): void {
    if (
      !this.renderPipeline ||
      !this.particleBuffer ||
      !this.forceUniformBuffer ||
      !this.renderUniformBuffer
    ) {
      throw new Error("Pipeline or buffers not created");
    }

    // Create render bind group: particles storage (read) + render uniforms
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.renderUniformBuffer },
        },
      ],
    });

    // Create compute bind group: particles storage (read_write) + force uniforms
    if (!this.computePipeline) {
      throw new Error("Compute pipeline not created");
    }
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.forceUniformBuffer },
        },
      ],
    });
  }

  private async loadRenderShader(): Promise<string> {
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
  // For instanced triangle-strip without a vertex buffer, vertex_index increments across instances.
  // Use local index per instance to select the quad corner.
  let local_index = vertex_index & 3u; // vertex_index % 4
  let quad_pos = quad_positions[local_index];
  
  // Transform to NDC with Y flipped to make positive Y go down in world space
  let world_pos = (particle.position - render_uniforms.camera_position) * render_uniforms.zoom;
  let ndc_pos = vec2<f32>(
    world_pos.x * 2.0 / render_uniforms.canvas_size.x,
    -world_pos.y * 2.0 / render_uniforms.canvas_size.y
  );
  let scaled_quad = vec2<f32>(
    quad_pos.x * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.x,
    -quad_pos.y * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.y
  );
  
  out.position = vec4<f32>(ndc_pos + scaled_quad, 0.0, 1.0);
  out.uv = quad_uvs[local_index];
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

  private async loadComputeShader(): Promise<string> {
    return `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

struct ForceUniforms {
  v0: vec4<f32>, // x: gravity_strength, y: delta_time, z: particle_count, w: unused
  v1: vec4<f32>, // x: dir.x, y: dir.y, z: unused, w: unused
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> force_uniforms: ForceUniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(force_uniforms.v0.z);
  if (index >= count) {
    return;
  }

  var particle = particles[index];
  
  // Apply gravity acceleration (Y positive is down in world, so use +)
  let gravity = vec2<f32>(force_uniforms.v1.x, force_uniforms.v1.y) * force_uniforms.v0.x;
  particle.velocity += gravity * force_uniforms.v0.y;
  
  // Integrate position
  particle.position += particle.velocity * force_uniforms.v0.y;
  
  particles[index] = particle;
}`;
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
    if (!this.particleBuffer) return;

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

    console.log(
      `DEBUG: Setting ${particles.length} particles. First particle:`,
      {
        position: [particles[0]?.position[0], particles[0]?.position[1]],
        velocity: [particles[0]?.velocity[0], particles[0]?.velocity[1]],
        size: particles[0]?.size,
        mass: particles[0]?.mass,
      }
    );

    // Write to storage buffer
    this.device.queue.writeBuffer(this.particleBuffer, 0, data);
  }

  updateForces(uniforms: ForceUniforms): void {
    if (!this.forceUniformBuffer) return;

    // Pack uniforms into two vec4s to avoid alignment issues
    // v0: [gravity_strength, delta_time, particle_count, 0]
    // v1: [dir.x, dir.y, 0, 0]
    const data = new Float32Array([
      uniforms.gravityStrength,
      uniforms.deltaTime,
      this.particleCount,
      0.0,
      uniforms.gravityDirection[0],
      uniforms.gravityDirection[1],
      0.0,
      0.0,
    ]);

    // ALWAYS log to debug what we're actually sending to GPU
    console.log("Writing force uniforms to GPU:", {
      gravityStrength: data[0],
      deltaTime: data[1],
      particleCount: data[2],
      gravityDirection: [data[4], data[5]],
      fullArray: Array.from(data),
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
        zoom: uniforms.zoom,
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
    // Update force uniforms with per-frame delta time
    console.log("WebGPU particle system update:", {
      deltaTime: deltaTime.toFixed(4),
      gravityStrength,
      particleCount: this.particleCount,
      gravityDirection: [0, 1],
    });

    this.updateForces({
      gravityStrength,
      gravityDirection: [0, 1], // Down
      deltaTime,
      time: 0,
    });
  }

  render(
    canvasSize: [number, number],
    cameraPosition: [number, number],
    zoom: number
  ): void {
    if (
      !this.renderPipeline ||
      !this.renderBindGroup ||
      this.particleCount === 0
    )
      return;

    this.updateRender({
      canvasSize,
      cameraPosition,
      zoom,
      _padding: 0,
    });

    // Create command encoder for rendering
    const commandEncoder = this.device.createCommandEncoder();

    const textureView = this.context.getCurrentTexture().createView();

    // Run compute pass to integrate physics
    if (this.computePipeline && this.computeBindGroup) {
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.computeBindGroup);
      const workgroupSize = 64;
      const numWorkgroups = Math.ceil(this.particleCount / workgroupSize);
      if (numWorkgroups > 0) {
        computePass.dispatchWorkgroups(numWorkgroups);
      }
      computePass.end();
    }

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);

    // Debug occasionally
    if (Math.random() < 0.01) {
      console.log("DEBUG: Rendering particles:", {
        particleCount: this.particleCount,
        particleBuffer: !!this.particleBuffer,
        renderPipeline: !!this.renderPipeline,
        renderBindGroup: !!this.renderBindGroup,
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
  }

  destroy(): void {
    this.particleBuffer?.destroy();
    this.forceUniformBuffer?.destroy();
    this.renderUniformBuffer?.destroy();

    this.particleBuffer = null;
    this.forceUniformBuffer = null;
    this.renderUniformBuffer = null;
    this.renderBindGroup = null;
    this.renderPipeline = null;
  }
}
