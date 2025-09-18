import {
  type RenderModuleDescriptor,
  type RenderPass,
  RenderPassKind,
} from "../shaders/descriptors";

export interface RenderPipelines {
  fullscreen?: Array<{
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
    clearsOnFirstUse?: boolean;
  }>;
  compute?: Array<{
    pipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;
    writesScene: boolean;
  }>;
}

export interface RenderRunConfig {
  modules: Array<RenderModuleDescriptor<any, any>>;
  currentSceneView: GPUTextureView;
  otherSceneView: GPUTextureView;
  pipelinesByModule: RenderPipelines[];
}

export function runRenderGraph(
  encoder: GPUCommandEncoder,
  cfg: RenderRunConfig
): GPUTextureView {
  let lastWritten: GPUTextureView | null = null;
  let anyWrites = false;

  for (let i = 0; i < cfg.modules.length; i++) {
    const mod = cfg.modules[i];
    if (!mod.passes || mod.passes.length === 0) continue;
    const pipelines = cfg.pipelinesByModule[i];
    for (let p = 0; p < mod.passes.length; p++) {
      const pass = mod.passes[p] as RenderPass<any>;
      if (pass.kind === RenderPassKind.Fullscreen) {
        const entry = pipelines.fullscreen?.[p];
        if (!entry) continue;
        const shouldClear = !anyWrites;
        const rpass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: cfg.currentSceneView,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: shouldClear ? "clear" : "load",
              storeOp: "store",
            },
          ],
        });
        rpass.setPipeline(entry.pipeline);
        rpass.setBindGroup(0, entry.bindGroup);
        rpass.draw(4, 1, 0, 0);
        rpass.end();
        anyWrites = true;
        lastWritten = cfg.currentSceneView;
      } else if (pass.kind === RenderPassKind.Compute) {
        const entry = pipelines.compute?.[p];
        if (!entry) continue;
        const cpass = encoder.beginComputePass();
        cpass.setPipeline(entry.pipeline);
        cpass.setBindGroup(0, entry.bindGroup);
        cpass.dispatchWorkgroups(Math.ceil(1024 / 8), Math.ceil(1024 / 8), 1);
        cpass.end();
        anyWrites = true;
        lastWritten = cfg.otherSceneView;
      }
    }
  }

  return lastWritten ?? cfg.currentSceneView;
}

export interface RenderExecutorViews {
  currentView: GPUTextureView;
  otherView: GPUTextureView;
  anyWrites: boolean;
}

export type RenderExecutor = (
  module: RenderModuleDescriptor<any, any>,
  pass: RenderPass<any>,
  views: RenderExecutorViews,
  encoder: GPUCommandEncoder
) => "current" | "other" | null;

export function runRenderGraphWithExecutor(
  encoder: GPUCommandEncoder,
  modules: Array<RenderModuleDescriptor<any, any>>,
  currentView: GPUTextureView,
  otherView: GPUTextureView,
  exec: RenderExecutor
): GPUTextureView {
  let lastWritten: GPUTextureView | null = null;
  let anyWrites = false;
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    if (!mod.passes || mod.passes.length === 0) continue;
    for (let p = 0; p < mod.passes.length; p++) {
      const pass = mod.passes[p] as RenderPass<any>;
      const wrote = exec(
        mod,
        pass,
        { currentView, otherView, anyWrites },
        encoder
      );
      if (wrote === "current") {
        lastWritten = currentView;
        anyWrites = true;
      } else if (wrote === "other") {
        lastWritten = otherView;
        anyWrites = true;
        const tmp = currentView;
        currentView = otherView;
        otherView = tmp;
      }
    }
  }
  return lastWritten ?? currentView;
}
