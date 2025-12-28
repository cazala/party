/**
 * GPUResources
 *
 * Low-level WebGPU resource manager. Responsible for:
 * - Adapter/device/context acquisition and canvas configuration
 * - Creation and caching of GPU buffers, textures, bind group layouts, and pipelines
 * - Managing ping-pong scene textures and a small shader cache keyed by WGSL hashes
 * - Building compute pipeline layouts from the generated Program and creating per-pass pipelines
 * - Providing helpers to write CPU data into GPU buffers and to create bind groups
 * - Cleaning up all GPU objects on dispose
 */
import { copyShaderWGSL } from "./shaders";
import type { Program, ModuleUniformLayout } from "./builders/program";
import { ViewSnapshot } from "../../view";

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

export interface SimulationPipelines {
  gridClear?: GPUComputePipeline;
  gridBuild?: GPUComputePipeline;
  state?: GPUComputePipeline;
  apply?: GPUComputePipeline;
  integrate?: GPUComputePipeline;
  constrain?: GPUComputePipeline;
  correct?: GPUComputePipeline;
  main?: GPUComputePipeline; // fallback main
}

export class GPUResources {
  private particleBuffer: GPUBuffer | null = null;
  private moduleUniformBuffers: ModuleUniformBuffer[] = [];
  private combinedArrayStorageBuffers: Map<string, GPUBuffer> = new Map(); // moduleName -> combined buffer
  private arrayStorageBuffers: Map<string, GPUBuffer> = new Map();
  private arrayLengthBuffers: Map<string, GPUBuffer> = new Map();
  private renderUniformBuffer: GPUBuffer | null = null;
  private renderBindGroupLayoutCache: Map<string, GPUBindGroupLayout> | null =
    null;
  private computeBindGroupLayout: GPUBindGroupLayout | null = null;
  private computePipelineLayout: GPUPipelineLayout | null = null;
  private simulationPipelines: SimulationPipelines = {};
  private gridCountsBuffer: GPUBuffer | null = null;
  private gridIndicesBuffer: GPUBuffer | null = null;
  private simStateBuffer: GPUBuffer | null = null;
  private scene: SceneTextures | null = null;
  private currentScene: "A" | "B" = "A";
  private sceneSize: { width: number; height: number } | null = null;
  private copyPipelines: Map<string, GPURenderPipeline> = new Map();
  private simUniformCache: Float32Array | null = null;
  private fullscreenPipelines: Map<string, GPURenderPipeline> = new Map();
  private imageComputePipelines: Map<string, GPUComputePipeline> = new Map();
  private hashWGSL(code: string): string {
    // djb2
    let h = 5381;
    for (let i = 0; i < code.length; i++)
      h = ((h << 5) + h) ^ code.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  public canvas: HTMLCanvasElement;
  public requiredFeatures: GPUFeatureName[] = [];
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public adapter: GPUAdapter | null = null;
  public format: GPUTextureFormat = "bgra8unorm";

  // Tracks an in-flight dispose so we can (a) avoid overlapping cleanups and
  // (b) wait for cleanup before re-initializing on rapid reloads.
  private disposePromise: Promise<void> | null = null;

  constructor(options: {
    canvas: HTMLCanvasElement;
    requiredFeatures?: GPUFeatureName[];
  }) {
    this.canvas = options.canvas;
    this.requiredFeatures = options.requiredFeatures || [];
  }

  async initialize(): Promise<void> {
    if (this.isInitialized()) return;
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    // If we're in the middle of disposing (common during rapid reloads / runtime toggles),
    // wait for it to finish before requesting a new adapter/device.
    if (this.disposePromise) {
      try {
        await this.disposePromise;
      } catch {
        // ignore
      }
    }

    // Safari workaround: Ensure canvas is visible and has dimensions before WebGPU initialization
    // Safari requires the canvas to be properly sized and in the DOM before getting WebGPU context
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      // Set minimum dimensions if canvas has no size
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
      } else {
        // Fallback to reasonable defaults
        this.canvas.width = 800;
        this.canvas.height = 600;
      }
    }

    // Helper function to add timeout to async operations
    const withTimeout = <T>(
      promise: Promise<T>,
      timeoutMs: number,
      operation: string
    ): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`WebGPU ${operation} timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
    };

    try {
      // Step 1: Request adapter with timeout
      this.adapter = await withTimeout(
        navigator.gpu.requestAdapter(),
        5000,
        "adapter request"
      );

      if (!this.adapter) {
        throw new Error("Failed to get WebGPU adapter");
      }

      // Step 2: Request device with timeout
      // Request the maximum buffer size limit to avoid buffer size errors
      const maxBufferSize = this.adapter.limits.maxBufferSize || this.adapter.limits.maxStorageBufferBindingSize;
      this.device = await withTimeout(
        this.adapter.requestDevice({
          requiredFeatures: this.requiredFeatures || [],
          requiredLimits: {
            maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
            maxBufferSize: maxBufferSize,
          },
        }),
        5000,
        "device request"
      );

      // Step 3: Get WebGPU context
      this.context = this.canvas.getContext("webgpu");
      if (!this.context) {
        throw new Error("Failed to get WebGPU context");
      }

      // Step 4: Get preferred format
      // Note: getPreferredCanvasFormat() is synchronous, so we can't timeout it
      // If it hangs, the browser is likely in a bad state
      try {
        this.format = navigator.gpu.getPreferredCanvasFormat();
      } catch (error) {
        // Safari fallback: use a default format if getPreferredCanvasFormat fails
        console.warn("[WebGPU] getPreferredCanvasFormat failed, using fallback format:", error);
        this.format = "bgra8unorm"; // Default format
      }

      // Step 5: Configure context
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied",
      });
    } catch (error) {
      console.error("[WebGPU] Initialization failed:", error);
      // Clean up any partial state
      this.adapter = null;
      this.device = null;
      this.context = null;
      throw error;
    }
  }

  /**
   * Starts disposal (idempotent) and returns a promise you can await *optionally*.
   * We keep the public destroy()/dispose() calls synchronous to avoid breaking runtime toggle,
   * but callers that care (like runtime toggle) can await this promise.
   */
  isInitialized(): boolean {
    return this.device !== null && this.context !== null;
  }

  getDevice(): GPUDevice {
    if (!this.device) throw new Error("Device not initialized");
    return this.device;
  }

  getContext(): GPUCanvasContext {
    if (!this.context) throw new Error("Context not initialized");
    return this.context;
  }

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
    this.particleBuffer = this.getDevice().createBuffer({
      size,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
  }

  writeParticleSlice(offsetFloats: number, data: Float32Array): void {
    if (!this.particleBuffer) return;
    this.getDevice().queue.writeBuffer(
      this.particleBuffer,
      offsetFloats * 4,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  writeParticleBuffer(data: Float32Array): void {
    if (!this.particleBuffer) return;
    this.getDevice().queue.writeBuffer(
      this.particleBuffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  /**
   * Reads particle data back from GPU to CPU
   */
  async readParticleBuffer(sizeFloats: number): Promise<Float32Array> {
    if (!this.particleBuffer) {
      throw new Error("Particle buffer not initialized");
    }

    const sizeBytes = sizeFloats * 4;

    // Create staging buffer for readback
    const stagingBuffer = this.getDevice().createBuffer({
      size: sizeBytes,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    try {
      // Copy from particle buffer to staging buffer
      const encoder = this.getDevice().createCommandEncoder();
      encoder.copyBufferToBuffer(
        this.particleBuffer,
        0,
        stagingBuffer,
        0,
        sizeBytes
      );

      // Submit commands and wait for completion
      this.getDevice().queue.submit([encoder.finish()]);
      await this.getDevice().queue.onSubmittedWorkDone();

      // Map and read the staging buffer
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const arrayBuffer = stagingBuffer.getMappedRange();
      const data = new Float32Array(arrayBuffer.slice(0));
      stagingBuffer.unmap();

      return data;
    } finally {
      stagingBuffer.destroy();
    }
  }

  createModuleUniformBuffers(layouts: ModuleUniformLayout[]): void {
    // Destroy old
    this.moduleUniformBuffers.forEach(({ buffer }) => buffer.destroy());
    this.moduleUniformBuffers = layouts.map((layout) => ({
      buffer: this.getDevice().createBuffer({
        size: layout.sizeBytes,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      layout: layout,
    }));
  }

  createRenderUniformBuffer(byteSize: number): void {
    this.renderUniformBuffer?.destroy();
    this.renderUniformBuffer = this.getDevice().createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  writeRenderUniforms(snapshot: ViewSnapshot): void {
    const data = new Float32Array([
      snapshot.width,
      snapshot.height,
      snapshot.cx,
      snapshot.cy,
      snapshot.zoom,
      0,
    ]);
    if (!this.renderUniformBuffer) return;
    this.getDevice().queue.writeBuffer(
      this.renderUniformBuffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  writeModuleUniform(index: number, data: ArrayBufferView, offset = 0): void {
    const muf = this.moduleUniformBuffers[index];
    if (!muf) return;
    this.getDevice().queue.writeBuffer(
      muf.buffer,
      offset,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }

  /**
   * Writes simulation uniforms (dt, count, simStride) into the internal
   * 'simulation' uniform buffer using the provided Program's layout.
   */
  writeSimulationUniform(
    program: Program,
    values: {
      dt?: number;
      count?: number;
      simStride?: number;
      maxSize?: number;
      iteration?: number;
      maxNeighbors?: number;
      maxParticles?: number;
    }
  ): void {
    const idx = program.layouts.findIndex((l) => l.moduleName === "simulation");
    if (idx === -1) return;
    const layout = program.layouts[idx];
    const map = layout.mapping as Record<string, { flatIndex: number }>;
    // Start from cache to preserve previously written fields across partial updates
    const data =
      this.simUniformCache?.length === layout.vec4Count * 4
        ? new Float32Array(this.simUniformCache)
        : new Float32Array(layout.vec4Count * 4);
    if (values.dt !== undefined && map.dt) data[map.dt.flatIndex] = values.dt;
    if (values.count !== undefined && map.count)
      data[map.count.flatIndex] = values.count;
    if (values.simStride !== undefined && map.simStride)
      data[map.simStride.flatIndex] = values.simStride;
    if (values.maxSize !== undefined && map.maxSize)
      data[map.maxSize.flatIndex] = values.maxSize;
    if (values.iteration !== undefined && map.iteration)
      data[map.iteration.flatIndex] = values.iteration;
    if (values.maxNeighbors !== undefined && map.maxNeighbors)
      data[map.maxNeighbors.flatIndex] = values.maxNeighbors;
    if (values.maxParticles !== undefined && map.maxParticles)
      data[map.maxParticles.flatIndex] = values.maxParticles;
    this.writeModuleUniform(idx, data);
    this.simUniformCache = data;
  }

  ensureSceneTextures(width: number, height: number): void {
    // Validate dimensions (must be within unsigned long range: 0 to 2^32-1)
    // Also clamp to reasonable maximum to avoid GPU memory issues
    const maxDimension = 16384; // Reasonable max texture size
    const validWidth = Math.max(1, Math.min(Math.floor(width), maxDimension));
    const validHeight = Math.max(1, Math.min(Math.floor(height), maxDimension));
    
    if (width !== validWidth || height !== validHeight) {
      console.warn(
        `[WebGPU] Texture dimensions clamped from ${width}x${height} to ${validWidth}x${validHeight}`
      );
    }

    const needInit = !this.scene;
    const changed =
      !this.sceneSize ||
      this.sceneSize.width !== validWidth ||
      this.sceneSize.height !== validHeight;
    if (!needInit && !changed) return;

    // Destroy old textures if present
    if (this.scene) {
      this.scene.a.destroy();
      this.scene.b.destroy();
    }

    const texDesc: GPUTextureDescriptor = {
      size: { width: validWidth, height: validHeight, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    };
    const a = this.getDevice().createTexture(texDesc);
    const b = this.getDevice().createTexture(texDesc);
    const viewA = a.createView();
    const viewB = b.createView();
    const sampler = this.getDevice().createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    this.scene = { a, b, viewA, viewB, sampler };
    this.sceneSize = { width: validWidth, height: validHeight };
    this.currentScene = "A";
  }

  createGridStorage(totalCells: number, maxPerCell: number): void {
    const countsSize = totalCells * 4;
    const indicesSize = totalCells * maxPerCell * 4;
    this.gridCountsBuffer?.destroy();
    this.gridIndicesBuffer?.destroy();
    this.gridCountsBuffer = this.getDevice().createBuffer({
      size: countsSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.gridIndicesBuffer = this.getDevice().createBuffer({
      size: indicesSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  createSimStateBuffer(maxParticles: number, strideFloats: number): void {
    const size = maxParticles * strideFloats * 4;
    this.simStateBuffer?.destroy();
    this.simStateBuffer = this.getDevice().createBuffer({
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

  getRenderBindGroupLayout(
    arrayInputs?: string[],
    fragmentParticleAccess?: boolean
  ): GPUBindGroupLayout {
    // Create a cache key based on array inputs and fragment access
    const cacheKey = arrayInputs
      ? `render_${arrayInputs.sort().join("_")}_frag_${
          fragmentParticleAccess || false
        }`
      : `render_basic_frag_${fragmentParticleAccess || false}`;

    // Check if we have a cached layout for this configuration
    if (!this.renderBindGroupLayoutCache) {
      this.renderBindGroupLayoutCache = new Map();
    }

    const cached = this.renderBindGroupLayoutCache.get(cacheKey);
    if (cached) return cached;

    const entries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: fragmentParticleAccess
          ? GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
          : GPUShaderStage.VERTEX,
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
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ];

    // Add single combined array storage buffer entry if module has arrays
    if (arrayInputs && arrayInputs.length > 0) {
      entries.push({
        binding: 5,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" },
      });
    }

    const layout = this.getDevice().createBindGroupLayout({ entries });
    this.renderBindGroupLayoutCache.set(cacheKey, layout);
    return layout;
  }

  buildComputeLayouts(compute: Program): void {
    const entries: GPUBindGroupLayoutEntry[] = [];
    entries.push({
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "storage" },
    });
    for (const layout of compute.layouts) {
      // Only include internal and force-module uniforms in compute bind group layout
      if (
        layout.moduleName === "simulation" ||
        layout.moduleName === "grid" ||
        layout.moduleRole === "force"
      ) {
        entries.push({
          binding: layout.bindingIndex,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        });
      }
    }
    // Add combined array storage buffer bindings (one per module)
    if (compute.extraBindings.arrays) {
      for (const [_moduleName, bindings] of Object.entries(
        compute.extraBindings.arrays
      )) {
        entries.push({
          binding: bindings.arrayBinding,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        });
        // Length is now stored in main uniform buffer, no separate binding needed
      }
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
    this.computeBindGroupLayout = this.getDevice().createBindGroupLayout({
      entries,
    });
    this.computePipelineLayout = this.getDevice().createPipelineLayout({
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
    const module = this.getDevice().createShaderModule({ code });
    const createComputePipelineForEntry = (
      entryPoint: string
    ): GPUComputePipeline =>
      this.getDevice().createComputePipeline({
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
    this.simulationPipelines = {
      main: safeCreateComputePipelineForEntry("main"),
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
    return this.simulationPipelines;
  }

  getCopyPipeline(format: GPUTextureFormat): GPURenderPipeline {
    const key = `copy:${format}`;
    const existing = this.copyPipelines.get(key);
    if (existing) return existing;
    const copyBindGroupLayout = this.getDevice().createBindGroupLayout({
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
    const layout = this.getDevice().createPipelineLayout({
      bindGroupLayouts: [copyBindGroupLayout],
    });
    const shaderModule = this.getDevice().createShaderModule({
      code: copyShaderWGSL,
    });
    const pipeline = this.getDevice().createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: "vs_main" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format,
            // No blending: present should overwrite canvas with scene texture
          },
        ],
      },
      primitive: { topology: "triangle-strip" },
    });
    this.copyPipelines.set(key, pipeline);
    return pipeline;
  }

  getOrCreateFullscreenRenderPipeline(
    shaderCode: string,
    arrayInputs?: string[],
    fragmentParticleAccess?: boolean
  ): GPURenderPipeline {
    const arrayKey = arrayInputs?.sort().join("_") || "";
    const key = `fs:${this.hashWGSL(shaderCode)}:${arrayKey}:frag_${
      fragmentParticleAccess || false
    }`;
    const cached = this.fullscreenPipelines.get(key);
    if (cached) return cached;
    const shaderModule = this.getDevice().createShaderModule({
      code: shaderCode,
    });
    const pipeline = this.getDevice().createRenderPipeline({
      layout: this.getDevice().createPipelineLayout({
        bindGroupLayouts: [
          this.getRenderBindGroupLayout(arrayInputs, fragmentParticleAccess),
        ],
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
    const shaderModule = this.getDevice().createShaderModule({
      code: shaderCode,
    });
    const pipeline = this.getDevice().createComputePipeline({
      layout: "auto",
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
    moduleUniformBuffer: GPUBuffer,
    moduleName: string,
    arrayInputs?: string[],
    fragmentParticleAccess?: boolean
  ): GPUBindGroup {
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: renderUniformBuffer } },
      { binding: 2, resource: readSceneView },
      { binding: 3, resource: sceneSampler },
      { binding: 4, resource: { buffer: moduleUniformBuffer } },
    ];

    // Add combined array storage buffer entry if module has arrays
    if (arrayInputs && arrayInputs.length > 0) {
      const combinedArrayBuffer =
        this.combinedArrayStorageBuffers.get(moduleName);
      if (combinedArrayBuffer) {
        entries.push({
          binding: 5,
          resource: { buffer: combinedArrayBuffer },
        });
      }
    }

    return this.getDevice().createBindGroup({
      layout: this.getRenderBindGroupLayout(
        arrayInputs,
        fragmentParticleAccess
      ),
      entries,
    });
  }

  createComputeBindGroup(compute: Program): GPUBindGroup {
    if (!this.computeBindGroupLayout) {
      throw new Error("Compute bind group layout not built");
    }
    if (!this.particleBuffer || this.moduleUniformBuffers.some((b) => !b)) {
      throw new Error("Buffers not ready");
    }
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.particleBuffer } },
      // Include only uniforms required by compute (internal + force modules)
      ...compute.layouts
        .filter(
          (l) =>
            l.moduleName === "simulation" ||
            l.moduleName === "grid" ||
            l.moduleRole === "force"
        )
        .map((layout) => {
          const muf = this.moduleUniformBuffers.find(
            (b) => b.layout.moduleName === layout.moduleName
          )!;
          return {
            binding: layout.bindingIndex,
            resource: { buffer: muf.buffer },
          };
        }),
    ];

    // Add combined array storage buffer bindings (one per module)
    if (compute.extraBindings.arrays) {
      for (const [moduleName, bindings] of Object.entries(
        compute.extraBindings.arrays
      )) {
        const combinedArrayBuffer =
          this.combinedArrayStorageBuffers.get(moduleName);

        if (combinedArrayBuffer) {
          entries.push({
            binding: bindings.arrayBinding,
            resource: { buffer: combinedArrayBuffer },
          });
          // Length is now stored in main uniform buffer, no separate binding needed
        }
      }
    }
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
    return this.getDevice().createBindGroup({
      layout: this.computeBindGroupLayout,
      entries,
    });
  }

  createImageComputeBindGroup(
    pipeline: GPUComputePipeline,
    readView: GPUTextureView,
    writeView: GPUTextureView,
    moduleUniformBuffer: GPUBuffer,
    moduleName: string,
    arrayInputs?: string[]
  ): GPUBindGroup {
    const layout = pipeline.getBindGroupLayout(0);
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: readView },
      { binding: 1, resource: writeView },
      { binding: 2, resource: { buffer: moduleUniformBuffer } },
    ];

    // Add combined array storage buffer entry if module has arrays
    if (arrayInputs && arrayInputs.length > 0) {
      const combinedArrayBuffer =
        this.combinedArrayStorageBuffers.get(moduleName);
      if (combinedArrayBuffer) {
        entries.push({
          binding: 3,
          resource: { buffer: combinedArrayBuffer },
        });
      }
    }

    return this.getDevice().createBindGroup({
      layout,
      entries,
    });
  }

  /**
   * Create combined array storage buffer for a module's array inputs
   */
  createCombinedArrayStorageBuffer(
    moduleName: string,
    arrayInputs: string[]
  ): void {
    // Clean up old combined buffer for this module
    const existingBuffer = this.combinedArrayStorageBuffers.get(moduleName);
    if (existingBuffer) {
      existingBuffer.destroy();
      this.combinedArrayStorageBuffers.delete(moduleName);
    }

    // Only create buffer if module has array inputs
    if (arrayInputs.length > 0) {
      // Create combined array storage buffer (initial size 2MB, will grow as needed)
      const combinedBuffer = this.getDevice().createBuffer({
        size: 2 * 1024 * 1024, // 2MB initial size
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.combinedArrayStorageBuffers.set(moduleName, combinedBuffer);
    }
  }

  /**
   * Create array storage buffers for a module's array inputs
   */
  createArrayStorageBuffers(moduleName: string, arrayInputs: string[]): void {
    // Clean up old buffers for this module
    this.arrayStorageBuffers.forEach((buffer, key) => {
      if (key.startsWith(`${moduleName}_`)) {
        buffer.destroy();
        this.arrayStorageBuffers.delete(key);
      }
    });
    this.arrayLengthBuffers.forEach((buffer, key) => {
      if (key.startsWith(`${moduleName}_`)) {
        buffer.destroy();
        this.arrayLengthBuffers.delete(key);
      }
    });

    // Create new buffers
    arrayInputs.forEach((arrayKey) => {
      const storageKey = `${moduleName}_${arrayKey}`;

      // Create array storage buffer (initial size 1MB, will grow as needed)
      const arrayBuffer = this.getDevice().createBuffer({
        size: 1024 * 1024, // 1MB initial size
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      // Length is now stored in main uniform buffer, no separate buffer needed
      this.arrayStorageBuffers.set(storageKey, arrayBuffer);
    });
  }

  /**
   * Write combined array data to storage buffer
   */
  writeCombinedArrayStorage(
    moduleName: string,
    arrayDataMap: Record<string, number[]>,
    arrayOffsets: Record<string, number>
  ): void {
    const combinedBuffer = this.combinedArrayStorageBuffers.get(moduleName);
    if (!combinedBuffer) {
      console.warn(`Combined array storage buffer not found for ${moduleName}`);
      return;
    }

    // Calculate total size needed
    let maxOffset = 0;
    for (const [arrayKey, data] of Object.entries(arrayDataMap)) {
      const offset = arrayOffsets[arrayKey] || 0;
      maxOffset = Math.max(maxOffset, offset + data.length);
    }

    const requiredSize = maxOffset * 4; // 4 bytes per float

    // Check if we need to resize the buffer
    if (requiredSize > combinedBuffer.size) {
      // Recreate with larger size
      combinedBuffer.destroy();
      const newSize = Math.max(requiredSize, combinedBuffer.size * 2);
      const newBuffer = this.getDevice().createBuffer({
        size: newSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.combinedArrayStorageBuffers.set(moduleName, newBuffer);

      // Write all array data to new buffer
      for (const [arrayKey, data] of Object.entries(arrayDataMap)) {
        const offset = arrayOffsets[arrayKey] || 0;
        const arrayData = new Float32Array(data);
        this.getDevice().queue.writeBuffer(
          newBuffer,
          offset * 4, // byte offset
          arrayData.buffer,
          arrayData.byteOffset,
          arrayData.byteLength
        );
      }
    } else {
      // Write array data to existing buffer
      for (const [arrayKey, data] of Object.entries(arrayDataMap)) {
        const offset = arrayOffsets[arrayKey] || 0;
        const arrayData = new Float32Array(data);
        this.getDevice().queue.writeBuffer(
          combinedBuffer,
          offset * 4, // byte offset
          arrayData.buffer,
          arrayData.byteOffset,
          arrayData.byteLength
        );
      }
    }
  }

  /**
   * Write array data to storage buffer
   */
  writeArrayStorage(
    moduleName: string,
    arrayKey: string,
    data: number[]
  ): void {
    const storageKey = `${moduleName}_${arrayKey}`;
    const arrayBuffer = this.arrayStorageBuffers.get(storageKey);

    if (!arrayBuffer) {
      console.warn(`Array storage buffer not found for ${storageKey}`);
      return;
    }

    // Check if we need to resize the buffer
    const requiredSize = data.length * 4;
    if (requiredSize > arrayBuffer.size) {
      // Recreate with larger size
      arrayBuffer.destroy();
      const newSize = Math.max(requiredSize, arrayBuffer.size * 2);
      const newBuffer = this.getDevice().createBuffer({
        size: newSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.arrayStorageBuffers.set(storageKey, newBuffer);

      // Write data to new buffer
      const arrayData = new Float32Array(data);
      this.getDevice().queue.writeBuffer(
        newBuffer,
        0,
        arrayData.buffer,
        arrayData.byteOffset,
        arrayData.byteLength
      );
    } else {
      // Write data to existing buffer
      const arrayData = new Float32Array(data);
      this.getDevice().queue.writeBuffer(
        arrayBuffer,
        0,
        arrayData.buffer,
        arrayData.byteOffset,
        arrayData.byteLength
      );
    }

    // Length is now written to the main uniform buffer by the module registry
  }

  /**
   * Get array storage buffer for a module's array input
   */
  getArrayStorageBuffer(
    moduleName: string,
    arrayKey: string
  ): GPUBuffer | undefined {
    return this.arrayStorageBuffers.get(`${moduleName}_${arrayKey}`);
  }

  /**
   * Get array length buffer for a module's array input
   */
  getArrayLengthBuffer(
    moduleName: string,
    arrayKey: string
  ): GPUBuffer | undefined {
    return this.arrayLengthBuffers.get(`${moduleName}_${arrayKey}_length`);
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposePromise = this.disposeAsync().finally(() => {
      this.disposePromise = null;
    });
    return this.disposePromise;
  }

  private async disposeAsync(): Promise<void> {
    // Basic cleanup - just destroy buffers and textures
    this.particleBuffer?.destroy();
    this.moduleUniformBuffers.forEach((muf) => muf.buffer.destroy());
    this.combinedArrayStorageBuffers.forEach((buffer) => buffer.destroy());
    this.arrayStorageBuffers.forEach((buffer) => buffer.destroy());
    this.arrayLengthBuffers.forEach((buffer) => buffer.destroy());
    this.renderUniformBuffer?.destroy();
    this.gridCountsBuffer?.destroy();
    this.gridIndicesBuffer?.destroy();
    this.simStateBuffer?.destroy();
    this.particleBuffer = null;
    this.moduleUniformBuffers = [];
    this.combinedArrayStorageBuffers.clear();
    this.arrayStorageBuffers.clear();
    this.arrayLengthBuffers.clear();
    this.renderUniformBuffer = null;
    this.renderBindGroupLayoutCache?.clear();
    this.renderBindGroupLayoutCache = null;
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
    this.computeBindGroupLayout = null;
    this.computePipelineLayout = null;

    // Key fix for reload perf degradation:
    // Wait briefly for any queued work to complete before tearing down the context/device.
    // This prevents Chrome GPU-process resource buildup from overlapping device lifetimes.
    if (this.device) {
      try {
        await Promise.race([
          this.device.queue.onSubmittedWorkDone(),
          new Promise((resolve) => setTimeout(resolve, 150)),
        ]);
      } catch {
        // ignore
      }
    }

    if (this.context) {
      try {
        this.context.unconfigure();
      } catch (error) {
        console.warn("[WebGPU] Error unconfiguring context:", error);
      }
    }

    // Give the browser a tick to process unconfigure before destroying the device.
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (this.device) {
      try {
        this.device.destroy();
      } catch (error) {
        console.warn("[WebGPU] Error destroying device:", error);
      }
    }

    this.context = null;
    this.device = null;
    this.adapter = null;
  }
}
