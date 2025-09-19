import { GPUResources } from "../runtime/gpu-resources";
import { buildProgram } from "../shaders/builder/compute-builder";
import type { Program } from "../shaders/builder/compute-builder";
import { Module } from "../shaders/compute";

export interface EngineInitConfig {
  maxParticles: number;
}

export class WebGPUEngine {
  private readonly device: GPUDevice;
  private readonly resources: GPUResources;
  private readonly modules: readonly Module<string, string, any>[];
  private computeBuild: Program | null = null;
  private maxParticles: number;

  constructor(
    device: GPUDevice,
    modules: readonly Module<string, string, any>[],
    config: EngineInitConfig
  ) {
    this.device = device;
    this.modules = modules;
    this.resources = new GPUResources(device);
    this.maxParticles = Math.max(1, config.maxParticles);
  }

  getResources(): GPUResources {
    return this.resources;
  }

  getComputeBuild(): Program | null {
    return this.computeBuild;
  }

  initialize(canvasWidth: number, canvasHeight: number): void {
    // Build compute program and allocate core resources
    this.computeBuild = buildProgram(this.modules);
    this.resources.createParticleBuffer(this.maxParticles, 12);
    this.resources.createModuleUniformBuffers(this.computeBuild.layouts);
    this.resources.createRenderUniformBuffer(24);
    if (this.computeBuild.extraBindings.simState) {
      this.resources.createSimStateBuffer(this.maxParticles, 4);
    }
    // Build compute bind group layout once
    this.resources.buildComputeLayouts(this.computeBuild);
    // Build simulation pipelines once
    this.resources.buildComputePipelines(this.computeBuild.code);
    this.resources.ensureSceneTextures(canvasWidth, canvasHeight);
  }

  resize(canvasWidth: number, canvasHeight: number): void {
    this.resources.ensureSceneTextures(canvasWidth, canvasHeight);
  }

  dispose(): void {
    this.resources.dispose();
  }
}
