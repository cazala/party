import { copyShaderWGSL } from "../shaders/copy";
import type {
  ComputeProgramBuild,
  ModuleUniformLayout,
} from "../shaders/builder/compute-builder";
import type { SimulationPipelines } from "./simulation-runner";

export interface SceneTextures {
  a: GPUTexture;
  b: GPUTexture;
  viewA: GPUTextureView;
  viewB: GPUTextureView;
  sampler: GPUSampler;
}

export type ModuleUniformBuffer = {
  buffer: GPUBuffer;
  layout: ModuleUniformLayout;
};

export class GPUResources {
  private particleBuffer: GPUBuffer | null = null;
  private moduleUniformBuffers: ModuleUniformBuffer[] = [];
  private renderUniformBuffer: GPUBuffer | null = null;
  private renderBindGroupLayout: GPUBindGroupLayout | null = null;
  private computeBindGroupLayout: GPUBindGroupLayout | null = null;
  private computePipelineLayout: GPUPipelineLayout | null = null;
  private simPipelines: SimulationPipelines = {};
  private gridCountsBuffer: GPUBuffer | null = null;
  private gridIndicesBuffer: GPUBuffer | null = null;
  private simStateBuffer: GPUBuffer | null = null;
  private scene: SceneTextures | null = null;
  private currentScene: "A" | "B" = "A";
  private sceneSize: { width: number; height: number } | null = null;
  private copyPipelines: Map<string, GPURenderPipeline> = new Map();
  private fullscreenPipelines: Map<string, GPURenderPipeline> = new Map();
  private imageComputePipelines: Map<string, GPUComputePipeline> = new Map();
  private hashWGSL(code: string): string {
    // djb2
    let h = 5381;
    for (let i = 0; i < code.length; i++)
      h = ((h << 5) + h) ^ code.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  constructor(private readonly device: GPUDevice) {}

  getParticleBuffer(): GPUBuffer | null {
    return this.particleBuffer;
  }

  getModuleUniformBuffers(): ModuleUniformBuffer[] {
    return this.moduleUniformBuffers;
  }

  getRenderUniformBuffer(): GPUBuffer | null {
    return this.renderUniformBuffer;
  }

  getGridCountsBuffer(): GPUBuffer | null {
    return this.gridCountsBuffer;
  }

  getGridIndicesBuffer(): GPUBuffer | null {
    return this.gridIndicesBuffer;
  }

  getSimStateBuffer(): GPUBuffer | null {
    return this.simStateBuffer;
  }

  createParticleBuffer(maxParticles: number, floatsPerParticle: number): void {
    const size = maxParticles * floatsPerParticle * 4;
    this.particleBuffer?.destroy();
    this.particleBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  writeParticleSlice(offsetFloats: number, data: Float32Array): void {
    if (!this.particleBuffer) return;
    this.device.queue.writeBuffer(
      this.particleBuffer,
      offsetFloats * 4,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  writeParticleBuffer(data: Float32Array): void {
    if (!this.particleBuffer) return;
    this.device.queue.writeBuffer(
      this.particleBuffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  createModuleUniformBuffers(layouts: ModuleUniformLayout[]): void {
    // Destroy old
    this.moduleUniformBuffers.forEach(({ buffer }) => buffer.destroy());
    this.moduleUniformBuffers = layouts.map((layout) => ({
      buffer: this.device.createBuffer({
        size: layout.sizeBytes,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      layout: layout,
    }));
  }

  createRenderUniformBuffer(byteSize: number): void {
    this.renderUniformBuffer?.destroy();
    this.renderUniformBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  writeRenderUniforms(data: ArrayBufferView, offset = 0): void {
    if (!this.renderUniformBuffer) return;
    this.device.queue.writeBuffer(
      this.renderUniformBuffer,
      offset,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  writeModuleUniform(index: number, data: ArrayBufferView, offset = 0): void {
    const muf = this.moduleUniformBuffers[index];
    if (!muf) return;
    this.device.queue.writeBuffer(
      muf.buffer,
      offset,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  ensureSceneTextures(width: number, height: number): void {
    const needInit = !this.scene;
    const changed =
      !this.sceneSize ||
      this.sceneSize.width !== width ||
      this.sceneSize.height !== height;
    if (!needInit && !changed) return;

    // Destroy old textures if present
    if (this.scene) {
      this.scene.a.destroy();
      this.scene.b.destroy();
    }

    const texDesc: GPUTextureDescriptor = {
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    };
    const a = this.device.createTexture(texDesc);
    const b = this.device.createTexture(texDesc);
    const viewA = a.createView();
    const viewB = b.createView();
    const sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    this.scene = { a, b, viewA, viewB, sampler };
    this.sceneSize = { width, height };
    this.currentScene = "A";
  }

  createGridStorage(totalCells: number, maxPerCell: number): void {
    const countsSize = totalCells * 4;
    const indicesSize = totalCells * maxPerCell * 4;
    this.gridCountsBuffer?.destroy();
    this.gridIndicesBuffer?.destroy();
    this.gridCountsBuffer = this.device.createBuffer({
      size: countsSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.gridIndicesBuffer = this.device.createBuffer({
      size: indicesSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  createSimStateBuffer(maxParticles: number, strideFloats: number): void {
    const size = maxParticles * strideFloats * 4;
    this.simStateBuffer?.destroy();
    this.simStateBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  getCurrentSceneTextureView(): GPUTextureView {
    if (!this.scene) throw new Error("Scene textures not initialized");
    return this.currentScene === "A" ? this.scene.viewA : this.scene.viewB;
  }

  getOtherSceneTextureView(): GPUTextureView {
    if (!this.scene) throw new Error("Scene textures not initialized");
    return this.currentScene === "A" ? this.scene.viewB : this.scene.viewA;
  }

  getSceneSampler(): GPUSampler {
    if (!this.scene) throw new Error("Scene textures not initialized");
    return this.scene.sampler;
  }

  swapSceneTextures(): void {
    this.currentScene = this.currentScene === "A" ? "B" : "A";
  }

  getRenderBindGroupLayout(): GPUBindGroupLayout {
    if (this.renderBindGroupLayout) return this.renderBindGroupLayout;
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
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    return this.renderBindGroupLayout;
  }

  buildComputeLayouts(compute: ComputeProgramBuild): void {
    const entries: GPUBindGroupLayoutEntry[] = [];
    entries.push({
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    });
    for (const layout of compute.layouts) {
      entries.push({
        binding: layout.bindingIndex,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      });
    }
    if (compute.extraBindings.grid) {
      entries.push({
        binding: compute.extraBindings.grid.countsBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
      entries.push({
        binding: compute.extraBindings.grid.indicesBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
    }
    if (compute.extraBindings.simState) {
      entries.push({
        binding: compute.extraBindings.simState.stateBinding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      });
    }
    if (compute.extraBindings.sceneTexture) {
      entries.push({
        binding: compute.extraBindings.sceneTexture.textureBinding,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "float" },
      });
    }
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries,
    });
    this.computePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.computeBindGroupLayout],
    });
  }

  getComputeBindGroupLayout(): GPUBindGroupLayout {
    if (!this.computeBindGroupLayout)
      throw new Error("Compute bind group layout not built");
    return this.computeBindGroupLayout;
  }

  buildComputePipelines(code: string): void {
    if (!this.computeBindGroupLayout || !this.computePipelineLayout) return;
    const module = this.device.createShaderModule({ code });
    const createComputePipelineForEntry = (
      entryPoint: string
    ): GPUComputePipeline =>
      this.device.createComputePipeline({
        layout: this.computePipelineLayout!,
        compute: { module, entryPoint },
      });
    const safeCreateComputePipelineForEntry = (
      entryPoint: string
    ): GPUComputePipeline | undefined => {
      try {
        return createComputePipelineForEntry(entryPoint);
      } catch {
        return undefined;
      }
    };
    this.simPipelines = {
      monolithic: safeCreateComputePipelineForEntry("main"),
      gridClear: safeCreateComputePipelineForEntry("grid_clear"),
      gridBuild: safeCreateComputePipelineForEntry("grid_build"),
      state: safeCreateComputePipelineForEntry("state_pass"),
      apply: safeCreateComputePipelineForEntry("apply_pass"),
      integrate: safeCreateComputePipelineForEntry("integrate_pass"),
      constrain: safeCreateComputePipelineForEntry("constrain_pass"),
      correct: safeCreateComputePipelineForEntry("correct_pass"),
    };
  }

  getSimulationPipelines(): SimulationPipelines {
    return this.simPipelines;
  }

  getCopyPipeline(format: GPUTextureFormat): GPURenderPipeline {
    const key = `copy:${format}`;
    const existing = this.copyPipelines.get(key);
    if (existing) return existing;
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
    const layout = this.device.createPipelineLayout({
      bindGroupLayouts: [copyBindGroupLayout],
    });
    const shaderModule = this.device.createShaderModule({
      code: copyShaderWGSL,
    });
    const pipeline = this.device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: "vs_main" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-strip" },
    });
    this.copyPipelines.set(key, pipeline);
    return pipeline;
  }

  getOrCreateFullscreenRenderPipeline(shaderCode: string): GPURenderPipeline {
    const key = `fs:${this.hashWGSL(shaderCode)}`;
    const cached = this.fullscreenPipelines.get(key);
    if (cached) return cached;
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.getRenderBindGroupLayout()],
      }),
      vertex: { module: shaderModule, entryPoint: "vs_main" },
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
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-strip" },
    });
    this.fullscreenPipelines.set(key, pipeline);
    return pipeline;
  }

  getOrCreateImageComputePipeline(shaderCode: string): GPUComputePipeline {
    const key = `imgc:${this.hashWGSL(shaderCode)}`;
    const cached = this.imageComputePipelines.get(key);
    if (cached) return cached;
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      layout: "auto" as any,
      compute: { module: shaderModule, entryPoint: "cs_main" },
    });
    this.imageComputePipelines.set(key, pipeline);
    return pipeline;
  }

  createFullscreenBindGroup(
    particleBuffer: GPUBuffer,
    renderUniformBuffer: GPUBuffer,
    readSceneView: GPUTextureView,
    sceneSampler: GPUSampler,
    moduleUniformBuffer: GPUBuffer
  ): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.getRenderBindGroupLayout(),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: renderUniformBuffer } },
        { binding: 2, resource: readSceneView },
        { binding: 3, resource: sceneSampler },
        { binding: 4, resource: { buffer: moduleUniformBuffer } },
      ],
    });
  }

  createComputeBindGroup(compute: ComputeProgramBuild): GPUBindGroup {
    if (!this.computeBindGroupLayout) {
      throw new Error("Compute bind group layout not built");
    }
    if (!this.particleBuffer || this.moduleUniformBuffers.some((b) => !b)) {
      throw new Error("Buffers not ready");
    }
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.particleBuffer } },
      ...this.moduleUniformBuffers.map((muf, i) => ({
        binding: i + 1,
        resource: { buffer: muf.buffer },
      })),
    ];
    if (
      compute.extraBindings.grid &&
      this.gridCountsBuffer &&
      this.gridIndicesBuffer
    ) {
      entries.push(
        {
          binding: compute.extraBindings.grid.countsBinding,
          resource: { buffer: this.gridCountsBuffer },
        },
        {
          binding: compute.extraBindings.grid.indicesBinding,
          resource: { buffer: this.gridIndicesBuffer },
        }
      );
    }
    if (compute.extraBindings.simState && this.simStateBuffer) {
      entries.push({
        binding: compute.extraBindings.simState.stateBinding,
        resource: { buffer: this.simStateBuffer },
      });
    }
    if (compute.extraBindings.sceneTexture) {
      entries.push({
        binding: compute.extraBindings.sceneTexture.textureBinding,
        resource: this.getCurrentSceneTextureView(),
      });
    }
    return this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries,
    });
  }

  createImageComputeBindGroup(
    pipeline: GPUComputePipeline,
    readView: GPUTextureView,
    writeView: GPUTextureView,
    moduleUniformBuffer: GPUBuffer
  ): GPUBindGroup {
    const layout = pipeline.getBindGroupLayout(0);
    return this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: readView },
        { binding: 1, resource: writeView },
        { binding: 2, resource: { buffer: moduleUniformBuffer } },
      ],
    });
  }

  dispose(): void {
    this.particleBuffer?.destroy();
    this.moduleUniformBuffers.forEach((muf) => muf.buffer.destroy());
    this.renderUniformBuffer?.destroy();
    this.gridCountsBuffer?.destroy();
    this.gridIndicesBuffer?.destroy();
    this.simStateBuffer?.destroy();
    this.particleBuffer = null;
    this.moduleUniformBuffers = [];
    this.renderUniformBuffer = null;
    this.gridCountsBuffer = null;
    this.gridIndicesBuffer = null;
    this.simStateBuffer = null;
    if (this.scene) {
      this.scene.a.destroy();
      this.scene.b.destroy();
      this.scene = null;
    }
    this.sceneSize = null;
    this.copyPipelines.clear();
    this.fullscreenPipelines.clear();
    this.imageComputePipelines.clear();
    this.renderBindGroupLayout = null;
    this.computeBindGroupLayout = null;
    this.computePipelineLayout = null;
  }
}
