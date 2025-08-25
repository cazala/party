import type { WebGPURenderer } from "./WebGPURenderer";
import { renderShaderWGSL } from "./shaders/render";
import {
  buildComputeProgram,
  type ComputeProgramBuild,
  ComputeModule,
  type ComputeModuleDescriptor,
} from "./shaders/compute";
import { DEFAULTS } from "./config";

export interface WebGPUParticle {
  position: [number, number];
  velocity: [number, number];
  size: number;
  mass: number;
}

// Module-specific uniform interfaces are kept internal; uniforms are written dynamically.

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
  private moduleUniformBuffers: (GPUBuffer | null)[] = [];
  private moduleUniformState: Record<string, number>[] = [];
  private renderUniformBuffer: GPUBuffer | null = null;

  private renderBindGroup: GPUBindGroup | null = null;
  private computeBindGroup: GPUBindGroup | null = null;

  private renderPipeline: GPURenderPipeline | null = null;
  private computePipeline: GPUComputePipeline | null = null;

  private particleCount: number = 0;
  private maxParticles: number = DEFAULTS.maxParticles;

  private computeBuild: ComputeProgramBuild | null = null;

  constructor(
    private renderer: WebGPURenderer,
    private modules: readonly ComputeModule<string, string>[]
  ) {
    const webgpuDevice = renderer.getWebGPUDevice();
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error("WebGPU device not initialized");
    }
    this.device = webgpuDevice.device;
    this.context = webgpuDevice.context;
  }

  private static toDescriptor(
    m: ComputeModule<string, string>
  ): ComputeModuleDescriptor<string, string> {
    return m.descriptor();
  }

  getModule<Name extends string>(
    name: Name
  ): ComputeModule<string, string> | undefined {
    const found = (
      this.modules as readonly ComputeModule<string, string>[]
    ).find((m) => {
      const d = WebGPUParticleSystem.toDescriptor(m);
      return d.name === name;
    });
    return found;
  }

  async initialize(): Promise<void> {
    await this.createBuffers();
    await this.createPipelines();
    this.createBindGroups();
    // Attach to renderer automatically
    this.renderer.attachSystem(this);

    // Attach per-module uniform writers to modules
    (this.modules as readonly ComputeModule<string, string>[]).forEach(
      (mod) => {
        const name = WebGPUParticleSystem.toDescriptor(mod).name;
        const writer = (values: Partial<Record<string, number>>) => {
          this.writeUniform(name, values);
        };
        mod.attachUniformWriter(writer);
      }
    );
  }

  private async createBuffers(): Promise<void> {
    // Create storage buffer for particle data (position vec2, velocity vec2, size f32, mass f32)
    const particleDataSize = this.maxParticles * 6 * 4; // 6 floats per particle * 4 bytes per float
    this.particleBuffer = this.device.createBuffer({
      size: particleDataSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Build program to derive layouts and code
    this.computeBuild = buildComputeProgram(this.modules);

    // Create module uniform buffers dynamically (one per module) using computed sizes
    this.moduleUniformBuffers = this.computeBuild.layouts.map((layout) =>
      this.device.createBuffer({
        size: layout.sizeBytes,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
    );

    // Initialize per-module CPU-side uniform state for merging partial writes
    this.moduleUniformState = this.computeBuild.layouts.map((layout) => {
      const state: Record<string, number> = {};
      for (const key of Object.keys(layout.mapping)) {
        state[key] = 0;
      }
      return state;
    });

    // Create render uniform buffer (canvas_size, camera_position, zoom, padding)
    this.renderUniformBuffer = this.device.createBuffer({
      size: 24, // 6 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    // Load shader code (render + compute)
    const renderShaderCode = renderShaderWGSL;
    const computeShaderCode = this.computeBuild?.code || "";

    // Create render shader module
    const renderShaderModule = this.device.createShaderModule({
      code: renderShaderCode,
    });

    // Create compute shader module
    const computeShaderModule = this.device.createShaderModule({
      code: computeShaderCode,
    });

    // Create render pipeline (reads particles from storage buffer)
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
            format: this.renderer.getWebGPUDevice().format,
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

    // Create compute pipeline (updates positions/velocities)
    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: computeShaderModule,
        entryPoint: "main",
      },
    });
  }

  private createBindGroups(): void {
    if (
      !this.renderPipeline ||
      !this.particleBuffer ||
      this.moduleUniformBuffers.some((b) => !b) ||
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

    // Create compute bind group: particles storage + module uniforms
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
        ...this.moduleUniformBuffers.map((buf, i) => ({
          binding: i + 1,
          resource: { buffer: buf as GPUBuffer },
        })),
      ],
    });
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

    // Write to storage buffer
    this.device.queue.writeBuffer(this.particleBuffer, 0, data);
  }

  private getModuleIndex(name: string): number {
    return (this.modules as readonly ComputeModule<string, string>[]).findIndex(
      (m) => {
        const d = WebGPUParticleSystem.toDescriptor(m);
        return d.name === name;
      }
    );
  }

  private writeSimulationUniforms(
    deltaTime: number,
    particleCount: number
  ): void {
    const idx = this.getModuleIndex("simulation");
    if (idx === -1) return;
    const buf = this.moduleUniformBuffers[idx];
    if (!buf) return;
    const layout = this.computeBuild!.layouts[idx];
    // Merge into state
    this.moduleUniformState[idx]["dt"] = deltaTime;
    this.moduleUniformState[idx]["count"] = particleCount;
    // Build full vec array from state
    const values = new Float32Array(layout.vec4Count * 4);
    for (const [key, map] of Object.entries(layout.mapping)) {
      values[(map as unknown as { flatIndex: number }).flatIndex] =
        this.moduleUniformState[idx][key] ?? 0;
    }
    this.device.queue.writeBuffer(buf, 0, values);
  }

  writeUniform(
    moduleName: string,
    values: Partial<Record<string, number>>
  ): void {
    const idx = this.getModuleIndex(moduleName);
    if (idx === -1) return;
    const buf = this.moduleUniformBuffers[idx];
    if (!buf) return;
    const layout = this.computeBuild!.layouts[idx];
    // Merge into state to avoid zeroing unspecified fields
    const state = this.moduleUniformState[idx];
    for (const [key, value] of Object.entries(values)) {
      state[key] = value as number;
    }
    const data = new Float32Array(layout.vec4Count * 4);
    for (const [key, map] of Object.entries(layout.mapping)) {
      data[(map as { flatIndex: number }).flatIndex] = state[key] ?? 0;
    }
    this.device.queue.writeBuffer(buf, 0, data);
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

  update(deltaTime: number): void {
    this.writeSimulationUniforms(deltaTime, this.particleCount);
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
      const workgroupSize = DEFAULTS.workgroupSize;
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
          clearValue: DEFAULTS.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);

    renderPass.draw(4, this.particleCount);
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
    this.moduleUniformBuffers.forEach((b) => b?.destroy());
    this.renderUniformBuffer?.destroy();

    this.particleBuffer = null;
    this.moduleUniformBuffers = [];
    this.renderUniformBuffer = null;
    this.renderBindGroup = null;
    this.renderPipeline = null;
  }
}
