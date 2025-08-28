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
  private gridClearPipeline: GPUComputePipeline | null = null;
  private gridBuildPipeline: GPUComputePipeline | null = null;
  private statePipeline: GPUComputePipeline | null = null;
  private applyPipeline: GPUComputePipeline | null = null;
  private integratePipeline: GPUComputePipeline | null = null;
  private correctPipeline: GPUComputePipeline | null = null;
  private constrainPipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private pipelineLayout: GPUPipelineLayout | null = null;

  private particleCount: number = 0;
  private maxParticles: number = DEFAULTS.maxParticles;

  private computeBuild: ComputeProgramBuild | null = null;

  // Grid buffers
  private gridCountsBuffer: GPUBuffer | null = null;
  private gridIndicesBuffer: GPUBuffer | null = null;
  private simStateBuffer: GPUBuffer | null = null;
  private gridCells: number = 0;
  private gridMaxPerCell: number = 0;
  // Track last view to detect changes and avoid unnecessary uniform/buffer updates
  private lastView: {
    width: number;
    height: number;
    cx: number;
    cy: number;
    zoom: number;
  } | null = null;

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

        // Attach a reader so modules can implement getters
        const reader = () => {
          const idx = this.getModuleIndex(name);
          if (idx === -1) return {} as Partial<Record<string, number>>;
          return { ...this.moduleUniformState[idx] } as Partial<
            Record<string, number>
          >;
        };
        // attach typed reader without using any
        mod.attachUniformReader(reader);
      }
    );
  }

  private async createBuffers(): Promise<void> {
    // Create storage buffer for particle data (position vec2, velocity vec2, size f32, mass f32)
    const particleDataSize = this.maxParticles * 8 * 4; // 8 floats per particle * 4 bytes per float (pos2, vel2, accel2, size, mass)
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

    // Grid buffers (always enabled in compute builder)
    const gridLayout = this.computeBuild.layouts.find(
      (l) => l.moduleName === "grid"
    );
    if (gridLayout) {
      // Derive grid dimensions from current render size and default cell size; can be updated later via writeUniform
      const size = this.renderer.getSize
        ? this.renderer.getSize()
        : { width: 800, height: 600 };
      this.configureGrid(size.width, size.height);
    }

    // Create SIM_STATE buffer (prevX, prevY, posIntX, posIntY per particle)
    if (this.computeBuild.extraBindings.simState) {
      const stride = 4 * 4; // 4 floats * 4 bytes
      const size = this.maxParticles * stride;
      this.simStateBuffer = this.device.createBuffer({
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }
  }

  private configureGrid(width: number, height: number): void {
    const cam = this.renderer.getCamera
      ? this.renderer.getCamera()
      : { x: 0, y: 0 };
    const zoom = this.renderer.getZoom ? this.renderer.getZoom() : 1;
    const halfW = width / (2 * Math.max(zoom, 0.0001));
    const halfH = height / (2 * Math.max(zoom, 0.0001));
    const minX = cam.x - halfW;
    const maxX = cam.x + halfW;
    const minY = cam.y - halfH;
    const maxY = cam.y + halfH;
    this.lastView = { width, height, cx: cam.x, cy: cam.y, zoom };
    const cellSize = 16;
    const cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    const rows = Math.max(1, Math.ceil((maxY - minY) / cellSize));
    const maxPerCell = 256;
    this.gridCells = cols * rows;
    this.gridMaxPerCell = maxPerCell;

    // Recreate grid storage buffers sized to the new grid
    this.gridCountsBuffer?.destroy();
    this.gridIndicesBuffer?.destroy();
    const countsSize = this.gridCells * 4;
    const indicesSize = this.gridCells * this.gridMaxPerCell * 4;
    this.gridCountsBuffer = this.device.createBuffer({
      size: countsSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.gridIndicesBuffer = this.device.createBuffer({
      size: indicesSize,
      usage: GPUBufferUsage.STORAGE,
    });

    // Seed grid uniforms directly (grid is not a module)
    const gridIdx = this.computeBuild!.layouts.findIndex(
      (l) => l.moduleName === "grid"
    );
    if (gridIdx !== -1) {
      const gridBuf = this.moduleUniformBuffers[gridIdx];
      const layout = this.computeBuild!.layouts[gridIdx];
      const values = new Float32Array(layout.vec4Count * 4);
      const mapping = layout.mapping as Record<string, { flatIndex: number }>;
      values[mapping.minX.flatIndex] = minX;
      values[mapping.minY.flatIndex] = minY;
      values[mapping.maxX.flatIndex] = maxX;
      values[mapping.maxY.flatIndex] = maxY;
      values[mapping.cols.flatIndex] = cols;
      values[mapping.rows.flatIndex] = rows;
      values[mapping.cellSize.flatIndex] = cellSize;
      values[mapping.maxPerCell.flatIndex] = maxPerCell;
      this.device.queue.writeBuffer(gridBuf as GPUBuffer, 0, values);
    }

    // Recreate compute bind group to include new storage buffers
    if (this.bindGroupLayout) {
      this.createBindGroups();
    }
  }

  updateGridForSize(width: number, height: number): void {
    const cam = this.renderer.getCamera
      ? this.renderer.getCamera()
      : { x: 0, y: 0 };
    const zoom = this.renderer.getZoom ? this.renderer.getZoom() : 1;
    if (
      this.lastView &&
      this.lastView.width === width &&
      this.lastView.height === height &&
      this.lastView.cx === cam.x &&
      this.lastView.cy === cam.y &&
      this.lastView.zoom === zoom
    ) {
      return;
    }
    this.configureGrid(width, height);
  }

  updateGridFromRenderer(): void {
    const size = this.renderer.getSize
      ? this.renderer.getSize()
      : { width: 800, height: 600 };
    this.updateGridForSize(size.width, size.height);
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

    // Create an explicit bind group layout and pipeline layout shared by all compute entry points
    if (!this.computeBuild) throw new Error("Compute program not built");
    const bglEntries: GPUBindGroupLayoutEntry[] = [];
    bglEntries.push({
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    });
    for (const layout of this.computeBuild.layouts) {
      bglEntries.push({
        binding: layout.bindingIndex,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      });
    }
    if (this.computeBuild.extraBindings.grid) {
      bglEntries.push({
        binding: this.computeBuild.extraBindings.grid.countsBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
      bglEntries.push({
        binding: this.computeBuild.extraBindings.grid.indicesBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
    }
    if (this.computeBuild.extraBindings.simState) {
      bglEntries.push({
        binding: this.computeBuild.extraBindings.simState.stateBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
    }
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: bglEntries,
    });
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    // Create compute pipelines with the explicit layout
    this.computePipeline = this.device.createComputePipeline({
      layout: this.pipelineLayout,
      compute: { module: computeShaderModule, entryPoint: "main" },
    });
    this.gridClearPipeline = this.device.createComputePipeline({
      layout: this.pipelineLayout,
      compute: { module: computeShaderModule, entryPoint: "grid_clear" },
    });
    this.gridBuildPipeline = this.device.createComputePipeline({
      layout: this.pipelineLayout,
      compute: { module: computeShaderModule, entryPoint: "grid_build" },
    });
    // Optional split passes if available
    try {
      this.statePipeline = this.device.createComputePipeline({
        layout: this.pipelineLayout,
        compute: { module: computeShaderModule, entryPoint: "state_pass" },
      });
      this.applyPipeline = this.device.createComputePipeline({
        layout: this.pipelineLayout,
        compute: { module: computeShaderModule, entryPoint: "apply_pass" },
      });
      this.integratePipeline = this.device.createComputePipeline({
        layout: this.pipelineLayout,
        compute: { module: computeShaderModule, entryPoint: "integrate_pass" },
      });
      this.constrainPipeline = this.device.createComputePipeline({
        layout: this.pipelineLayout,
        compute: { module: computeShaderModule, entryPoint: "constrain_pass" },
      });
      this.correctPipeline = this.device.createComputePipeline({
        layout: this.pipelineLayout,
        compute: { module: computeShaderModule, entryPoint: "correct_pass" },
      });
    } catch (_e) {
      // Fallback to monolithic main if split entries not present
    }
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
    if (!this.bindGroupLayout) {
      throw new Error("Bind group layout not created");
    }
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.particleBuffer } },
      ...this.moduleUniformBuffers.map((buf, i) => ({
        binding: i + 1,
        resource: { buffer: buf as GPUBuffer },
      })),
    ];
    if (
      this.computeBuild?.extraBindings.grid &&
      this.gridCountsBuffer &&
      this.gridIndicesBuffer
    ) {
      entries.push(
        {
          binding: this.computeBuild.extraBindings.grid.countsBinding,
          resource: { buffer: this.gridCountsBuffer },
        },
        {
          binding: this.computeBuild.extraBindings.grid.indicesBinding,
          resource: { buffer: this.gridIndicesBuffer },
        }
      );
    }
    if (this.computeBuild?.extraBindings.simState && this.simStateBuffer) {
      entries.push({
        binding: this.computeBuild.extraBindings.simState.stateBinding,
        resource: { buffer: this.simStateBuffer },
      });
    }
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries,
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

    const data = new Float32Array(particles.length * 8);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const offset = i * 8;
      data[offset] = particle.position[0];
      data[offset + 1] = particle.position[1];
      data[offset + 2] = particle.velocity[0];
      data[offset + 3] = particle.velocity[1];
      // acceleration starts at zero
      data[offset + 4] = 0;
      data[offset + 5] = 0;
      data[offset + 6] = particle.size;
      data[offset + 7] = particle.mass;
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

    // Run compute passes to build grid and integrate physics
    if (this.computeBindGroup) {
      const workgroupSize = DEFAULTS.workgroupSize;

      // Grid clear pass
      if (this.gridClearPipeline && this.gridCells > 0) {
        const pass = commandEncoder.beginComputePass();
        pass.setBindGroup(0, this.computeBindGroup);
        pass.setPipeline(this.gridClearPipeline);
        const clearGroups = Math.ceil(this.gridCells / workgroupSize);
        if (clearGroups > 0) pass.dispatchWorkgroups(clearGroups);
        pass.end();
      }

      // Grid build pass
      if (this.gridBuildPipeline && this.particleCount > 0) {
        const pass = commandEncoder.beginComputePass();
        pass.setBindGroup(0, this.computeBindGroup);
        pass.setPipeline(this.gridBuildPipeline);
        const buildGroups = Math.ceil(this.particleCount / workgroupSize);
        if (buildGroups > 0) pass.dispatchWorkgroups(buildGroups);
        pass.end();
      }

      const groups = Math.ceil(this.particleCount / workgroupSize);
      // Split passes if available; otherwise fall back to main
      if (
        this.statePipeline &&
        this.applyPipeline &&
        this.integratePipeline &&
        this.constrainPipeline &&
        this.correctPipeline
      ) {
        // state
        const p1 = commandEncoder.beginComputePass();
        p1.setBindGroup(0, this.computeBindGroup);
        p1.setPipeline(this.statePipeline);
        if (groups > 0) p1.dispatchWorkgroups(groups);
        p1.end();

        // apply
        const p2 = commandEncoder.beginComputePass();
        p2.setBindGroup(0, this.computeBindGroup);
        p2.setPipeline(this.applyPipeline);
        if (groups > 0) p2.dispatchWorkgroups(groups);
        p2.end();

        // integrate
        const p3 = commandEncoder.beginComputePass();
        p3.setBindGroup(0, this.computeBindGroup);
        p3.setPipeline(this.integratePipeline);
        if (groups > 0) p3.dispatchWorkgroups(groups);
        p3.end();

        // Rebuild grid for updated positions
        if (this.gridClearPipeline && this.gridCells > 0) {
          const pass = commandEncoder.beginComputePass();
          pass.setBindGroup(0, this.computeBindGroup);
          pass.setPipeline(this.gridClearPipeline);
          const clearGroups2 = Math.ceil(this.gridCells / workgroupSize);
          if (clearGroups2 > 0) pass.dispatchWorkgroups(clearGroups2);
          pass.end();
        }
        if (this.gridBuildPipeline && this.particleCount > 0) {
          const pass = commandEncoder.beginComputePass();
          pass.setBindGroup(0, this.computeBindGroup);
          pass.setPipeline(this.gridBuildPipeline);
          if (groups > 0) pass.dispatchWorkgroups(groups);
          pass.end();
        }

        // constrain — iterate to improve convergence
        const constrainIterations = 10;
        for (let iter = 0; iter < constrainIterations; iter++) {
          const pc = commandEncoder.beginComputePass();
          pc.setBindGroup(0, this.computeBindGroup);
          pc.setPipeline(this.constrainPipeline);
          if (groups > 0) pc.dispatchWorkgroups(groups);
          pc.end();
        }

        // correct
        const p5 = commandEncoder.beginComputePass();
        p5.setBindGroup(0, this.computeBindGroup);
        p5.setPipeline(this.correctPipeline);
        if (groups > 0) p5.dispatchWorkgroups(groups);
        p5.end();
      } else if (this.computePipeline) {
        // Fallback monolithic
        const simPass = commandEncoder.beginComputePass();
        simPass.setBindGroup(0, this.computeBindGroup);
        simPass.setPipeline(this.computePipeline);
        if (groups > 0) simPass.dispatchWorkgroups(groups);
        simPass.end();
      }
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
