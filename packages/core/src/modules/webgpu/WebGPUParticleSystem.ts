import type { WebGPURenderer } from "./WebGPURenderer";
import {
  buildComputeProgram,
  type ComputeProgramBuild,
  Module,
  type ModuleDescriptor,
} from "./shaders/compute";
import { copyShaderWGSL } from "./shaders/copy";
import { DEFAULTS } from "./config";

export interface WebGPUParticle {
  position: [number, number];
  velocity: [number, number];
  size: number;
  mass: number;
  color: [number, number, number, number];
}

// Module-specific uniform interfaces are kept internal; uniforms are written dynamically.

export interface RenderUniforms {
  canvasSize: [number, number];
  cameraPosition: [number, number];
  zoom: number;
}

export class WebGPUParticleSystem {
  private device: GPUDevice;
  private context: GPUCanvasContext;

  private particleBuffer: GPUBuffer | null = null;
  private moduleUniformBuffers: (GPUBuffer | null)[] = [];
  private moduleUniformState: Record<string, number>[] = [];
  private renderUniformBuffer: GPUBuffer | null = null;

  private renderBindGroupLayout: GPUBindGroupLayout | null = null;
  private computeBindGroup: GPUBindGroup | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;

  private computePipeline: GPUComputePipeline | null = null;
  private gridClearPipeline: GPUComputePipeline | null = null;
  private gridBuildPipeline: GPUComputePipeline | null = null;
  private statePipeline: GPUComputePipeline | null = null;
  private applyPipeline: GPUComputePipeline | null = null;
  private integratePipeline: GPUComputePipeline | null = null;
  private correctPipeline: GPUComputePipeline | null = null;
  private constrainPipeline: GPUComputePipeline | null = null;

  private copyPipeline: GPURenderPipeline | null = null;
  private copyBindGroup: GPUBindGroup | null = null;
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

  // Scene textures (ping-pong)
  private sceneTextureA: GPUTexture | null = null;
  private sceneTextureB: GPUTexture | null = null;
  private sceneTextureViewA: GPUTextureView | null = null;
  private sceneTextureViewB: GPUTextureView | null = null;
  private currentSceneTexture: "A" | "B" = "A";
  private sceneSampler: GPUSampler | null = null;

  // Scene helpers
  private getCurrentSceneTextureView(): GPUTextureView {
    return this.currentSceneTexture === "A"
      ? this.sceneTextureViewA!
      : this.sceneTextureViewB!;
  }
  private swapSceneTextures(): void {
    this.currentSceneTexture = this.currentSceneTexture === "A" ? "B" : "A";
  }

  // Cache for render graph
  // Reserve for future caching (unused until render modules are implemented)
  // private renderComputePipelines: Map<string, GPUComputePipeline> = new Map();
  // private renderGraphicsPipelines: Map<string, GPURenderPipeline> = new Map();
  private sceneTexSize: { width: number; height: number } | null = null;

  private ensureSceneTexturesSized(): void {
    const size = this.renderer.getSize();
    const needInit = !this.sceneTextureA || !this.sceneTextureB;
    const changed =
      !this.sceneTexSize ||
      this.sceneTexSize.width !== size.width ||
      this.sceneTexSize.height !== size.height;
    if (needInit || changed) {
      // Recreate scene textures
      this.createTrailTextures();
      this.sceneTexSize = { width: size.width, height: size.height };
    }
  }

  private runRenderGraph(commandEncoder: GPUCommandEncoder): void {
    // Render graph runner: ensure scene textures sized, then execute render-role modules
    // Resize scene textures if needed
    this.ensureSceneTexturesSized();

    // Execute render modules in registration order, pass order
    let lastWrittenView: GPUTextureView | null = null;
    let anyWrites = false;
    for (let i = 0; i < this.modules.length; i++) {
      const mod = this.modules[i] as Module<string, string, any>;
      const desc = WebGPUParticleSystem.toDescriptor(mod) as any;
      if (desc.role !== "render" || !(mod as any).isEnabled?.()) continue;
      const passes = (desc.passes || []) as Array<any>;
      for (let p = 0; p < passes.length; p++) {
        const pass = passes[p];
        if (pass.kind === "fullscreen") {
          // Build WGSL from DSL hooks (fragment required, vertex optional)
          const defaultVertex = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
}
struct RenderUniforms {
  canvas_size: vec2<f32>,
  camera_position: vec2<f32>,
  zoom: f32,
  _pad: f32,
}
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
}
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;
@group(0) @binding(2) var scene_texture: texture_2d<f32>;
@group(0) @binding(3) var scene_sampler: sampler;
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
  if (particle.mass == 0.0) {
    out.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    out.uv = vec2<f32>(0.0, 0.0);
    out.color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return out;
  }
  let local_index = vertex_index & 3u;
  let quad_pos = quad_positions[local_index];
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
  out.color = particle.color;
  return out;
}`;
          const layouts = this.computeBuild!.layouts;
          const layoutForMod = layouts.find((l) => l.moduleName === desc.name)!;
          const getUniformForMod = (id: string) =>
            layoutForMod.mapping[id]?.expr ?? "0.0";
          const fragmentBody = pass.fragment({
            getUniform: (id: string) =>
              id === "canvasWidth"
                ? "render_uniforms.canvas_size.x"
                : id === "canvasHeight"
                ? "render_uniforms.canvas_size.y"
                : id === "clearColorR"
                ? String(DEFAULTS.clearColor.r)
                : id === "clearColorG"
                ? String(DEFAULTS.clearColor.g)
                : id === "clearColorB"
                ? String(DEFAULTS.clearColor.b)
                : getUniformForMod(id),
            sampleScene: (uvExpr: string) =>
              `textureSampleLevel(scene_texture, scene_sampler, ${uvExpr}, 0.0)`,
          });
          const codeFS = `${defaultVertex}
@fragment
fn fs_main(
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @builtin(position) frag_coord: vec4<f32>
) -> @location(0) vec4<f32> ${fragmentBody}`;
          const shaderModule = this.device.createShaderModule({ code: codeFS });
          const pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
              bindGroupLayouts: [this.renderBindGroupLayout!],
            }),
            vertex: {
              module: shaderModule,
              entryPoint: "vs_main",
            },
            fragment: {
              module: shaderModule,
              entryPoint: "fs_main",
              targets: [
                {
                  format: "rgba8unorm",
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
            primitive: { topology: "triangle-strip" },
          });

          // Build bind group for expected bindings
          const readSceneView =
            this.currentSceneTexture === "A"
              ? this.sceneTextureViewB!
              : this.sceneTextureViewA!;
          const entries: GPUBindGroupEntry[] = [];
          // Binding 0: particle buffer
          entries.push({
            binding: 0,
            resource: { buffer: this.particleBuffer! },
          });
          // Binding 1: render uniforms
          entries.push({
            binding: 1,
            resource: { buffer: this.renderUniformBuffer! },
          });
          // Binding 2: scene texture sample (if pass readsScene)
          entries.push({ binding: 2, resource: readSceneView });
          // Binding 3: scene sampler
          entries.push({ binding: 3, resource: this.sceneSampler! });
          const bindGroup = this.device.createBindGroup({
            layout: this.renderBindGroupLayout!,
            entries,
          });

          // Target: scene texture out
          const targetView = this.getCurrentSceneTextureView();
          const rp = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: targetView,
                clearValue: DEFAULTS.clearColor,
                loadOp: anyWrites ? "load" : "clear",
                storeOp: "store",
              },
            ],
          });
          rp.setPipeline(pipeline);
          rp.setBindGroup(0, bindGroup);
          // Draw instanced quads: 4 verts per instance
          rp.draw(4, this.particleCount);
          rp.end();

          // Do not swap after fullscreen writes; keep current pointing to latest
          if (pass.writesScene) {
            lastWrittenView = targetView;
            anyWrites = true;
          }
        } else if (pass.kind === "compute") {
          // Compute image op (DSL): read current, write other, bind module uniforms
          const layouts = this.computeBuild!.layouts;
          const layoutForMod = layouts.find((l) => l.moduleName === desc.name)!;
          const vec4Count = layoutForMod.vec4Count;
          const structFields = Array.from(
            { length: vec4Count },
            (_, k) => `  v${k}: vec4<f32>,`
          ).join("\n");
          const structWGSL = `struct Uniforms_${desc.name} {\n${structFields}\n}`;
          const getUniformExpr = (id: string) =>
            layoutForMod.mapping[id]?.expr ?? "0.0";
          const getUniform = (id: string) =>
            id === "canvasWidth"
              ? "f32(textureDimensions(input_texture).x)"
              : id === "canvasHeight"
              ? "f32(textureDimensions(input_texture).y)"
              : id === "clearColorR"
              ? String(DEFAULTS.clearColor.r)
              : id === "clearColorG"
              ? String(DEFAULTS.clearColor.g)
              : id === "clearColorB"
              ? String(DEFAULTS.clearColor.b)
              : getUniformExpr(id).replace(
                  `${desc.name}_uniforms`,
                  `module_uniforms`
                );
          const kernelBody = pass.kernel({
            getUniform,
            readScene: (coordsExpr: string) =>
              `textureLoad(input_texture, ${coordsExpr}, 0)`,
            writeScene: (coordsExpr: string, colorExpr: string) =>
              `textureStore(output_texture, ${coordsExpr}, ${colorExpr})`,
          });
          const wg = pass.workgroupSize || [8, 8, 1];
          const codeCS = `${structWGSL}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> module_uniforms: Uniforms_${desc.name};
@compute @workgroup_size(${wg[0]}, ${wg[1]}, ${wg[2]})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let dims = textureDimensions(input_texture);
  if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) { return; }
  ${kernelBody}
}`;
          const shaderModule = this.device.createShaderModule({ code: codeCS });
          const bindGroupLayout = this.device.createBindGroupLayout({
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
          const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
          });
          const pipeline = this.device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
              module: shaderModule,
              entryPoint: "cs_main",
            },
          });

          // Bind scene read/write: read from current, write to the other
          const readSceneView = this.getCurrentSceneTextureView();
          const writeSceneView =
            this.currentSceneTexture === "A"
              ? this.sceneTextureViewB!
              : this.sceneTextureViewA!;

          // Bind the module's uniform buffer (same one used for compute program)
          const modIndex = (
            this.modules as readonly Module<string, string, any>[]
          ).findIndex(
            (m) => WebGPUParticleSystem.toDescriptor(m).name === desc.name
          );
          const moduleUniformBuf = this.moduleUniformBuffers[modIndex]!;

          const bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
              { binding: 0, resource: readSceneView },
              { binding: 1, resource: writeSceneView },
              { binding: 2, resource: { buffer: moduleUniformBuf } },
            ],
          });

          // Dispatch
          const canvasSize = this.renderer.getSize();
          const workgroupsX = Math.ceil(canvasSize.width / 8);
          const workgroupsY = Math.ceil(canvasSize.height / 8);
          const cp = commandEncoder.beginComputePass();
          cp.setPipeline(pipeline);
          cp.setBindGroup(0, bindGroup);
          cp.dispatchWorkgroups(workgroupsX, workgroupsY);
          cp.end();

          if (pass.writesScene) {
            lastWrittenView = writeSceneView;
            anyWrites = true;
            // After writing to the other, swap so current points to latest
            this.swapSceneTextures();
          }
        }
      }
    }

    // Copy final scene to canvas (use the last texture we wrote if any, otherwise current)
    const canvasView = this.context.getCurrentTexture().createView();
    const sourceView = anyWrites
      ? lastWrittenView!
      : this.getCurrentSceneTextureView();
    this.copyTrailToCanvas(commandEncoder, canvasView, sourceView);
  }

  constructor(
    private renderer: WebGPURenderer,
    private modules: readonly Module<string, string, any>[]
  ) {
    const webgpuDevice = renderer.getWebGPUDevice();
    if (!webgpuDevice.device || !webgpuDevice.context) {
      throw new Error("WebGPU device not initialized");
    }
    this.device = webgpuDevice.device;
    this.context = webgpuDevice.context;
  }

  private static toDescriptor(
    m: Module<string, string, any>
  ): ModuleDescriptor<string, string, any> {
    return m.descriptor();
  }

  getModule<Name extends string>(
    name: Name
  ): Module<string, string, any> | undefined {
    const found = (this.modules as readonly Module<string, string, any>[]).find(
      (m) => {
        const d = WebGPUParticleSystem.toDescriptor(m);
        return d.name === name;
      }
    );
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
    (this.modules as readonly Module<string, string>[]).forEach((mod) => {
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
    });
  }

  private async createBuffers(): Promise<void> {
    // Create storage buffer for particle data (pos2, vel2, accel2, size, mass, color4)
    const particleDataSize = this.maxParticles * 12 * 4; // 12 floats per particle * 4 bytes per float
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

    // Seed simulation stride uniform for SIM_STATE helpers
    const simLayoutIdx = this.computeBuild.layouts.findIndex(
      (l) => l.moduleName === "simulation"
    );
    if (simLayoutIdx !== -1) {
      const simLayout = this.computeBuild.layouts[simLayoutIdx];
      if (simLayout.mapping["simStride"]) {
        this.moduleUniformState[simLayoutIdx]["simStride"] =
          this.computeBuild.simStateStride;
      }
    }

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

    this.sceneTextureA = this.device.createTexture(textureDescriptor);
    this.sceneTextureB = this.device.createTexture(textureDescriptor);

    this.sceneTextureViewA = this.sceneTextureA.createView();
    this.sceneTextureViewB = this.sceneTextureB.createView();

    // Create sampler for texture reads
    this.sceneSampler = this.device.createSampler({
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
          view: this.sceneTextureViewA!,
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
          view: this.sceneTextureViewB!,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    passB.end();

    this.device.queue.submit([commandEncoder.finish()]);
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
    const computeShaderCode = this.computeBuild?.code || "";

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

    // (No static particle canvas pipeline; render modules handle scene writes)

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
          resource: this.getCurrentSceneTextureView(),
        },
        {
          binding: 1,
          resource: this.sceneSampler!,
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
    if (this.computeBuild.extraBindings.sceneTexture) {
      bglEntries.push({
        binding: this.computeBuild.extraBindings.sceneTexture.textureBinding,
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
  }

  private createBindGroups(): void {
    if (
      !this.particleBuffer ||
      this.moduleUniformBuffers.some((b) => !b) ||
      !this.renderUniformBuffer
    ) {
      throw new Error("Pipeline or buffers not created");
    }

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
    if (this.computeBuild?.extraBindings.sceneTexture) {
      entries.push({
        binding: this.computeBuild.extraBindings.sceneTexture.textureBinding,
        resource: this.getCurrentSceneTextureView(),
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

  addParticle(particle: WebGPUParticle): void {
    if (!this.particleBuffer) return;
    if (this.particleCount >= this.maxParticles) return;

    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const offsetFloats = this.particleCount * STRIDE;
    const data = new Float32Array(STRIDE);
    data[0] = particle.position[0];
    data[1] = particle.position[1];
    data[2] = particle.velocity?.[0] ?? 0;
    data[3] = particle.velocity?.[1] ?? 0;
    data[4] = 0; // ax
    data[5] = 0; // ay
    data[6] = particle.size ?? 5;
    data[7] = particle.mass ?? 1;
    const c = particle.color ?? [1, 1, 1, 1];
    data[8] = c[0];
    data[9] = c[1];
    data[10] = c[2];
    data[11] = c[3];

    // Write only the slice for the new particle
    this.device.queue.writeBuffer(this.particleBuffer, offsetFloats * 4, data);
    this.particleCount = this.particleCount + 1;
  }

  private updateParticleBuffer(particles: WebGPUParticle[]): void {
    if (!this.particleBuffer) return;

    const STRIDE = 12; // pos2, vel2, accel2, size, mass, color4
    const data = new Float32Array(particles.length * STRIDE);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const offset = i * STRIDE;
      data[offset] = particle.position[0];
      data[offset + 1] = particle.position[1];
      data[offset + 2] = particle.velocity[0];
      data[offset + 3] = particle.velocity[1];
      // acceleration starts at zero
      data[offset + 4] = 0;
      data[offset + 5] = 0;
      data[offset + 6] = particle.size;
      data[offset + 7] = particle.mass;
      const c = particle.color ?? [1, 1, 1, 1];
      data[offset + 8] = c[0];
      data[offset + 9] = c[1];
      data[offset + 10] = c[2];
      data[offset + 11] = c[3];
    }

    // Write to storage buffer
    this.device.queue.writeBuffer(this.particleBuffer, 0, data);
  }

  private getModuleIndex(name: string): number {
    return (this.modules as readonly Module<string, string, any>[]).findIndex(
      (m) => {
        const d = WebGPUParticleSystem.toDescriptor(m);
        return d.name === name;
      }
    );
  }

  // removed old trail helpers

  private copyTrailToCanvas(
    commandEncoder: GPUCommandEncoder,
    canvasView: GPUTextureView,
    sourceView?: GPUTextureView
  ): void {
    if (!this.copyPipeline || !this.copyBindGroup) return;

    // Update copy bind group with current trail texture
    const updatedCopyBindGroup = this.device.createBindGroup({
      layout: this.copyPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: sourceView ?? this.getCurrentSceneTextureView(),
        },
        {
          binding: 1,
          resource: this.sceneSampler!,
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

  // removed scene clear helper; render modules own scene lifecycle

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
      0, // padding
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
    // Proceed even with 0 particles to ensure canvas clears and scene stays in sync

    this.updateRender({ canvasSize, cameraPosition, zoom });

    // Create command encoder for rendering
    const commandEncoder = this.device.createCommandEncoder();

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
          this.modules as readonly Module<string, string, any>[]
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

    // Always run the render graph; render modules draw into scene textures and we copy to canvas
    this.runRenderGraph(commandEncoder);

    // Submit render commands
    this.device.queue.submit([commandEncoder.finish()]);
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  clear(): void {
    // Remove all particles
    this.particleCount = 0;

    // Clear scene textures so sensors and the next frame don't see stale data
    try {
      const encoder = this.device.createCommandEncoder();
      const passA = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.sceneTextureViewA!,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passA.end();
      const passB = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.sceneTextureViewB!,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passB.end();
      this.device.queue.submit([encoder.finish()]);
    } catch (_) {
      // no-op if textures not ready
    }

    // Proactively clear the canvas once so last frame isn't left onscreen
    try {
      const commandEncoder = this.device.createCommandEncoder();
      const canvasView = this.context.getCurrentTexture().createView();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasView,
            clearValue: DEFAULTS.clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.end();
      this.device.queue.submit([commandEncoder.finish()]);
    } catch (_) {
      // ignore if context not available yet
    }
  }

  destroy(): void {
    this.particleBuffer?.destroy();
    this.moduleUniformBuffers.forEach((b) => b?.destroy());
    this.renderUniformBuffer?.destroy();

    this.particleBuffer = null;
    this.moduleUniformBuffers = [];
    this.renderUniformBuffer = null;
    this.renderBindGroupLayout = null;
    this.pipelineLayout = null;
  }
}
