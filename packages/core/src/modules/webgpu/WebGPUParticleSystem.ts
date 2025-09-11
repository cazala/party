import type { WebGPURenderer } from "./WebGPURenderer";
import { renderShaderWGSL } from "./shaders/render";
import {
  buildComputeProgram,
  type ComputeProgramBuild,
  ComputeModule,
  type ComputeModuleDescriptor,
} from "./shaders/compute";
import { trailDecayShaderWGSL, trailBlurShaderWGSL } from "./shaders/trails";
import { copyShaderWGSL } from "./shaders/copy";
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
  enableTrails: number;
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
  private trailRenderPipeline: GPURenderPipeline | null = null;
  private copyPipeline: GPURenderPipeline | null = null;
  private copyBindGroup: GPUBindGroup | null = null;
  private renderBindGroupLayout: GPUBindGroupLayout | null = null;
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

  // Constraint solver iterations per frame
  private constrainIterations: number = 50;

  // Trail system
  private trailTextureA: GPUTexture | null = null;
  private trailTextureB: GPUTexture | null = null;
  private trailTextureViewA: GPUTextureView | null = null;
  private trailTextureViewB: GPUTextureView | null = null;
  private currentTrailTexture: "A" | "B" = "A";
  private trailSampler: GPUSampler | null = null;
  private trailDecayPipeline: GPUComputePipeline | null = null;
  private trailBlurPipeline: GPUComputePipeline | null = null;
  private trailDecayBindGroupA: GPUBindGroup | null = null;
  private trailDecayBindGroupB: GPUBindGroup | null = null;
  private trailBlurBindGroupA: GPUBindGroup | null = null;
  private trailBlurBindGroupB: GPUBindGroup | null = null;
  private trailDecayUniformBuffer: GPUBuffer | null = null;
  private trailBlurUniformBuffer: GPUBuffer | null = null;

  constructor(
    private renderer: WebGPURenderer,
    private modules: readonly ComputeModule<string, string, any>[]
  ) {
    const webgpuDevice = renderer.getWebGPUDevice();
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error("WebGPU device not initialized");
    }
    this.device = webgpuDevice.device;
    this.context = webgpuDevice.context;
  }

  private static toDescriptor(
    m: ComputeModule<string, string, any>
  ): ComputeModuleDescriptor<string, string, any> {
    return m.descriptor();
  }

  getModule<Name extends string>(
    name: Name
  ): ComputeModule<string, string, any> | undefined {
    const found = (
      this.modules as readonly ComputeModule<string, string, any>[]
    ).find((m) => {
      const d = WebGPUParticleSystem.toDescriptor(m);
      return d.name === name;
    });
    return found;
  }

  setConstrainIterations(iters: number): void {
    this.constrainIterations = Math.max(1, Math.floor(iters));
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

    // Debug logging removed - issue resolved

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
      // Default-enable non-simulation modules that have 'enabled'
      if (layout.moduleName !== "simulation" && "enabled" in layout.mapping) {
        state["enabled"] = 1;
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

    // Create trail textures for sensors system
    await this.createTrailTextures();
  }

  private async createTrailTextures(): Promise<void> {
    const size = this.renderer.getSize();
    const width = size.width;
    const height = size.height;

    // Create dual trail textures for ping-pong rendering
    const textureDescriptor: GPUTextureDescriptor = {
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    };

    this.trailTextureA = this.device.createTexture(textureDescriptor);
    this.trailTextureB = this.device.createTexture(textureDescriptor);

    this.trailTextureViewA = this.trailTextureA.createView();
    this.trailTextureViewB = this.trailTextureB.createView();

    // Create sampler for texture reads
    this.trailSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    // Initialize textures with transparent black
    const commandEncoder = this.device.createCommandEncoder();

    // Clear texture A
    const passA = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.trailTextureViewA!,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    passA.end();

    // Clear texture B
    const passB = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.trailTextureViewB!,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    passB.end();

    this.device.queue.submit([commandEncoder.finish()]);

    // Create uniform buffers for trail operations
    this.trailDecayUniformBuffer = this.device.createBuffer({
      size: 32, // TrailUniforms: vec2 + f32 + vec3 + f32 = 8 floats = 32 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.trailBlurUniformBuffer = this.device.createBuffer({
      size: 16, // BlurUniforms: vec2 + f32 + f32 = 4 floats = 16 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
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

    // Create explicit bind group layout for render shaders
    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    const renderPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.renderBindGroupLayout],
    });

    // Create render pipeline for canvas (BGRA8Unorm format)
    this.renderPipeline = this.device.createRenderPipeline({
      layout: renderPipelineLayout,
      vertex: {
        module: renderShaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.renderer.getWebGPUDevice().format, // BGRA8Unorm
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

    // Create render pipeline for trail textures (RGBA8Unorm format)
    this.trailRenderPipeline = this.device.createRenderPipeline({
      layout: renderPipelineLayout,
      vertex: {
        module: renderShaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: renderShaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: "rgba8unorm", // Trail texture format
            blend: {
              color: {
                srcFactor: "src-alpha", // Proper alpha blending for particles
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

    // Create copy bind group layout (simpler - just texture and sampler)
    const copyBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    const copyPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [copyBindGroupLayout],
    });

    // Create copy pipeline for trail-to-canvas copying
    const copyShaderModule = this.device.createShaderModule({
      code: copyShaderWGSL,
    });

    this.copyPipeline = this.device.createRenderPipeline({
      layout: copyPipelineLayout,
      vertex: {
        module: copyShaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: copyShaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.renderer.getWebGPUDevice().format, // Canvas format
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

    // Create copy bind group (for copy pipeline)
    this.copyBindGroup = this.device.createBindGroup({
      layout: copyBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.getCurrentTrailTextureView(),
        },
        {
          binding: 1,
          resource: this.trailSampler!,
        },
      ],
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
    if (this.computeBuild.extraBindings.trailTexture) {
      bglEntries.push({
        binding: this.computeBuild.extraBindings.trailTexture.textureBinding,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "float" },
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

    // Create trail compute pipelines
    await this.createTrailPipelines();
  }

  private async createTrailPipelines(): Promise<void> {
    // Create trail pipelines

    // Create trail decay shader module
    let trailDecayModule;
    try {
      trailDecayModule = this.device.createShaderModule({
        code: trailDecayShaderWGSL,
      });
    } catch (error) {
      console.error("Trail decay shader compilation failed:", error);
      throw error;
    }

    // Create trail blur shader module
    const trailBlurModule = this.device.createShaderModule({
      code: trailBlurShaderWGSL,
    });

    // Create bind group layouts for trail operations
    const trailDecayBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { format: "rgba8unorm", access: "write-only" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    const trailBlurBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { format: "rgba8unorm", access: "write-only" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    // Create pipeline layouts
    const trailDecayPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [trailDecayBindGroupLayout],
    });

    const trailBlurPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [trailBlurBindGroupLayout],
    });

    // Create compute pipelines
    try {
      this.trailDecayPipeline = this.device.createComputePipeline({
        layout: trailDecayPipelineLayout,
        compute: { module: trailDecayModule, entryPoint: "trail_decay" },
      });
    } catch (error) {
      console.error("Trail decay pipeline creation failed:", error);
      throw error;
    }

    this.trailBlurPipeline = this.device.createComputePipeline({
      layout: trailBlurPipelineLayout,
      compute: { module: trailBlurModule, entryPoint: "trail_blur" },
    });

    // Create trail bind groups for ping-pong rendering
    await this.createTrailBindGroups(
      trailDecayBindGroupLayout,
      trailBlurBindGroupLayout
    );
  }

  private async createTrailBindGroups(
    decayLayout: GPUBindGroupLayout,
    blurLayout: GPUBindGroupLayout
  ): Promise<void> {
    // Trail decay bind groups (A->B and B->A)
    this.trailDecayBindGroupA = this.device.createBindGroup({
      layout: decayLayout,
      entries: [
        { binding: 0, resource: this.trailTextureViewA! },
        { binding: 1, resource: this.trailTextureViewB! },
        { binding: 2, resource: { buffer: this.trailDecayUniformBuffer! } },
      ],
    });

    this.trailDecayBindGroupB = this.device.createBindGroup({
      layout: decayLayout,
      entries: [
        { binding: 0, resource: this.trailTextureViewB! },
        { binding: 1, resource: this.trailTextureViewA! },
        { binding: 2, resource: { buffer: this.trailDecayUniformBuffer! } },
      ],
    });

    // Trail blur bind groups (A->B and B->A)
    this.trailBlurBindGroupA = this.device.createBindGroup({
      layout: blurLayout,
      entries: [
        { binding: 0, resource: this.trailTextureViewA! },
        { binding: 1, resource: this.trailTextureViewB! },
        { binding: 2, resource: { buffer: this.trailBlurUniformBuffer! } },
      ],
    });

    this.trailBlurBindGroupB = this.device.createBindGroup({
      layout: blurLayout,
      entries: [
        { binding: 0, resource: this.trailTextureViewB! },
        { binding: 1, resource: this.trailTextureViewA! },
        { binding: 2, resource: { buffer: this.trailBlurUniformBuffer! } },
      ],
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

    // Create render bind group: particles storage (read) + render uniforms + trail texture
    // Both render pipelines use the same explicit bind group layout
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout!,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.particleBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.renderUniformBuffer },
        },
        {
          binding: 2,
          resource: this.getCurrentTrailTextureView(),
        },
        {
          binding: 3,
          resource: this.trailSampler!,
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
    // Bind current trail texture as sampled texture for sensors
    if (this.computeBuild?.extraBindings.trailTexture) {
      entries.push({
        binding: this.computeBuild.extraBindings.trailTexture.textureBinding,
        resource: this.getCurrentTrailTextureView(),
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
    return (
      this.modules as readonly ComputeModule<string, string, any>[]
    ).findIndex((m) => {
      const d = WebGPUParticleSystem.toDescriptor(m);
      return d.name === name;
    });
  }

  private getCurrentTrailTextureView(): GPUTextureView {
    return this.currentTrailTexture === "A"
      ? this.trailTextureViewA!
      : this.trailTextureViewB!;
  }

  private swapTrailTextures(): void {
    this.currentTrailTexture = this.currentTrailTexture === "A" ? "B" : "A";
  }

  private copyTrailToCanvas(
    commandEncoder: GPUCommandEncoder,
    canvasView: GPUTextureView
  ): void {
    if (!this.copyPipeline || !this.copyBindGroup) return;

    // Update copy bind group with current trail texture
    const updatedCopyBindGroup = this.device.createBindGroup({
      layout: this.copyPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.getCurrentTrailTextureView(),
        },
        {
          binding: 1,
          resource: this.trailSampler!,
        },
      ],
    });

    // Create a fullscreen quad pass to copy trail texture to canvas
    // This handles format conversion from RGBA8Unorm to BGRA8Unorm
    const copyPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          clearValue: DEFAULTS.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // Use dedicated copy pipeline
    copyPass.setPipeline(this.copyPipeline);
    copyPass.setBindGroup(0, updatedCopyBindGroup);

    // Draw fullscreen quad (4 vertices, triangle strip)
    copyPass.draw(4, 1);
    copyPass.end();
  }

  private updateTrailUniforms(): void {
    if (!this.trailDecayUniformBuffer || !this.trailBlurUniformBuffer) return;

    const sensorsModule = this.getModule("sensors");
    const sensorsUniforms = sensorsModule
      ? (sensorsModule as any).read?.()
      : {};

    const size = this.renderer.getSize();

    // Update trail decay uniforms
    const decayRate = sensorsUniforms.trailDecay || 0.1;
    const decayData = new Float32Array([
      size.width, // canvas_size.x
      size.height, // canvas_size.y
      decayRate, // decay_rate
      0.0, // _padding (for background_color alignment)
      DEFAULTS.clearColor.r, // background_color.r
      DEFAULTS.clearColor.g, // background_color.g
      DEFAULTS.clearColor.b, // background_color.b
      0.0, // _padding
    ]);

    // (no debug logging)

    this.device.queue.writeBuffer(this.trailDecayUniformBuffer, 0, decayData);

    // Update trail blur uniforms
    const blurData = new Float32Array([
      size.width, // canvas_size.x
      size.height, // canvas_size.y
      sensorsUniforms.trailDiffuse || 0.0, // blur_radius
      0.0, // _padding
    ]);
    this.device.queue.writeBuffer(this.trailBlurUniformBuffer, 0, blurData);
  }

  private processTrails(commandEncoder: GPUCommandEncoder): void {
    if (
      !this.trailDecayPipeline ||
      !this.trailDecayBindGroupA ||
      !this.trailDecayBindGroupB
    ) {
      // Missing trail pipelines or bind groups
      return;
    }

    this.updateTrailUniforms();

    const size = this.renderer.getSize();
    const workgroupsX = Math.ceil(size.width / 8);
    const workgroupsY = Math.ceil(size.height / 8);

    // Note: currentTrailTexture was already swapped after particle rendering
    // Apply trail decay (ping-pong from current texture to other texture)
    const decayPass = commandEncoder.beginComputePass();
    decayPass.setPipeline(this.trailDecayPipeline);

    // Use appropriate bind group based on current texture
    // After particle rendering, currentTrailTexture was swapped, so we need to read from the "other" texture
    const decayBindGroup =
      this.currentTrailTexture === "A"
        ? this.trailDecayBindGroupB // Read from B, write to A
        : this.trailDecayBindGroupA; // Read from A, write to B

    decayPass.setBindGroup(0, decayBindGroup);
    decayPass.dispatchWorkgroups(workgroupsX, workgroupsY);
    decayPass.end();

    // Apply blur if diffuse > 0 (blur from current texture back to other texture)
    const sensorsModule = this.getModule("sensors");
    const trailDiffuse = sensorsModule
      ? (sensorsModule as any).read?.().trailDiffuse || 0
      : 0;

    if (
      trailDiffuse > 0 &&
      this.trailBlurPipeline &&
      this.trailBlurBindGroupA &&
      this.trailBlurBindGroupB
    ) {
      const blurPass = commandEncoder.beginComputePass();
      blurPass.setPipeline(this.trailBlurPipeline);

      // Use appropriate bind group based on current texture (after decay swap)
      const blurBindGroup =
        this.currentTrailTexture === "A"
          ? this.trailBlurBindGroupA // Read from A, write to B
          : this.trailBlurBindGroupB; // Read from B, write to A
      blurPass.setBindGroup(0, blurBindGroup);
      blurPass.dispatchWorkgroups(workgroupsX, workgroupsY);
      blurPass.end();

      // Swap textures after blur
      this.swapTrailTextures();
    }
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
      uniforms.enableTrails,
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

    // Check if sensors module has trails enabled
    const sensorsModule = this.getModule("sensors");
    const enableTrails =
      sensorsModule && (sensorsModule as any).read?.().enableTrail ? 1.0 : 0.0;

    this.updateRender({
      canvasSize,
      cameraPosition,
      zoom,
      enableTrails,
    });

    // Create command encoder for rendering
    const commandEncoder = this.device.createCommandEncoder();

    const textureView = this.context.getCurrentTexture().createView();

    // Recreate compute bind group to update trail texture binding for sensors
    if (this.bindGroupLayout) {
      this.createBindGroups();
    }

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
        const descs = (
          this.modules as readonly ComputeModule<string, string, any>[]
        ).map((m) => WebGPUParticleSystem.toDescriptor(m));
        const stateEnabled = descs.some(
          (d, idx) =>
            d.role === "force" &&
            (this.modules[idx] as any).isEnabled?.() &&
            !!d.state
        );
        const applyEnabled = descs.some(
          (d, idx) =>
            d.role === "force" &&
            (this.modules[idx] as any).isEnabled?.() &&
            !!d.apply
        );
        const constrainEnabled = descs.some(
          (d, idx) =>
            d.role === "force" &&
            (this.modules[idx] as any).isEnabled?.() &&
            !!d.constrain
        );
        // state
        if (stateEnabled) {
          const p1 = commandEncoder.beginComputePass();
          p1.setBindGroup(0, this.computeBindGroup);
          p1.setPipeline(this.statePipeline);
          if (groups > 0) p1.dispatchWorkgroups(groups);
          p1.end();
        }

        // apply
        if (applyEnabled) {
          const p2 = commandEncoder.beginComputePass();
          p2.setBindGroup(0, this.computeBindGroup);
          p2.setPipeline(this.applyPipeline);
          if (groups > 0) p2.dispatchWorkgroups(groups);
          p2.end();
        }

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
        if (constrainEnabled) {
          for (let iter = 0; iter < this.constrainIterations; iter++) {
            const pc = commandEncoder.beginComputePass();
            pc.setBindGroup(0, this.computeBindGroup);
            pc.setPipeline(this.constrainPipeline);
            if (groups > 0) pc.dispatchWorkgroups(groups);
            pc.end();
          }
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

    // Render particles first - use appropriate pipeline for target format
    if (enableTrails > 0.0 && this.trailRenderPipeline) {
      // Create a bind group that samples from the "other" trail texture (not the current render target)
      const trailReadTexture =
        this.currentTrailTexture === "A"
          ? this.trailTextureViewB!
          : this.trailTextureViewA!;
      const trailRenderBindGroup = this.device.createBindGroup({
        layout: this.renderBindGroupLayout!,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.particleBuffer! },
          },
          {
            binding: 1,
            resource: { buffer: this.renderUniformBuffer! },
          },
          {
            binding: 2,
            resource: trailReadTexture, // Read from other texture
          },
          {
            binding: 3,
            resource: this.trailSampler!,
          },
        ],
      });

      // Render to current trail texture with additive blending
      const trailRenderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.getCurrentTrailTextureView(), // Write to current texture
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
            loadOp: "load", // Keep existing trail content for persistence
            storeOp: "store",
          },
        ],
      });

      trailRenderPass.setPipeline(this.trailRenderPipeline);
      trailRenderPass.setBindGroup(0, trailRenderBindGroup);
      trailRenderPass.draw(4, this.particleCount);
      trailRenderPass.end();

      // Swap textures after particle rendering
      this.swapTrailTextures();
    } else {
      // Render directly to canvas
      const canvasRenderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: DEFAULTS.clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      canvasRenderPass.setPipeline(this.renderPipeline);
      canvasRenderPass.setBindGroup(0, this.renderBindGroup);
      canvasRenderPass.draw(4, this.particleCount);
      canvasRenderPass.end();
    }

    // Process trails if enabled (after particle rendering)
    if (enableTrails > 0.0) {
      this.processTrails(commandEncoder);
    }

    // If trails are enabled, copy final trail texture to canvas, then render particles on top
    if (enableTrails > 0.0) {
      // 1) Copy decayed trail texture to canvas (clears first)
      this.copyTrailToCanvas(commandEncoder, textureView);

      // 2) Render particles on top at full brightness (unaffected by decay)
      const canvasRenderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: "load", // keep copied trails
            storeOp: "store",
          },
        ],
      });
      canvasRenderPass.setPipeline(this.renderPipeline);
      canvasRenderPass.setBindGroup(0, this.renderBindGroup!);
      canvasRenderPass.draw(4, this.particleCount);
      canvasRenderPass.end();
    }

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
