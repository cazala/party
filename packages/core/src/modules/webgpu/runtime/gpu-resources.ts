export interface SceneTextures {
  a: GPUTexture;
  b: GPUTexture;
  viewA: GPUTextureView;
  viewB: GPUTextureView;
  sampler: GPUSampler;
}

export class GPUResources {
  private particleBuffer: GPUBuffer | null = null;
  private moduleUniformBuffers: (GPUBuffer | null)[] = [];
  private renderUniformBuffer: GPUBuffer | null = null;
  private renderBindGroupLayout: GPUBindGroupLayout | null = null;
  private gridCountsBuffer: GPUBuffer | null = null;
  private gridIndicesBuffer: GPUBuffer | null = null;
  private simStateBuffer: GPUBuffer | null = null;
  private scene: SceneTextures | null = null;
  private currentScene: "A" | "B" = "A";
  private sceneSize: { width: number; height: number } | null = null;

  constructor(private readonly device: GPUDevice) {}

  getParticleBuffer(): GPUBuffer | null {
    return this.particleBuffer;
  }

  getModuleUniformBuffers(): (GPUBuffer | null)[] {
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

  createModuleUniformBuffers(layouts: Array<{ sizeBytes: number }>): void {
    // Destroy old
    this.moduleUniformBuffers.forEach((b) => b?.destroy());
    this.moduleUniformBuffers = layouts.map((l) =>
      this.device.createBuffer({
        size: l.sizeBytes,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
    );
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
    const buf = this.moduleUniformBuffers[index];
    if (!buf) return;
    this.device.queue.writeBuffer(
      buf,
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
}
