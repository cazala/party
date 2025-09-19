/**
 * Render runner
 *
 * Coordinates execution of a sequence of render modules and their passes.
 * Supports a ping-pong scheme between two scene textures: `currentView` is the
 * active render target and `otherView` is the previously written texture that
 * passes may read from. Compute image passes write into the "other" view and
 * then swap, whereas fullscreen raster passes write directly into the current
 * view. The function returns the view that has the most up-to-date scene at
 * the end of the chain.
 */

import {
  type RenderModuleDescriptor,
  type FullscreenRenderPass,
  RenderPassKind,
  ComputeRenderPass,
} from "../shaders/descriptors";
import type {
  Program,
  ModuleUniformLayout,
} from "../shaders/builder/compute-builder";
import {
  buildFullscreenPassWGSL,
  buildComputeImagePassWGSL,
} from "../shaders/builder/render-builder";
import { GPUResources } from "./gpu-resources";
import { WebGPURenderer } from "../WebGPURenderer";
import { DEFAULTS } from "../config";

export interface RenderExecutorViews {
  currentView: GPUTextureView;
  otherView: GPUTextureView;
  anyWrites: boolean;
}

/**
 * Execute all render passes declared by the provided render modules.
 *
 * - Fullscreen passes draw a quad into `currentView` (optionally writing scene)
 * - Compute image passes write into `otherView` and then swap the views if they write the scene
 * - Maintains `anyWrites` to decide whether to clear or load the current target
 *
 * Returns the texture view that contains the final scene after all passes.
 */
export function runRenderPasses(
  encoder: GPUCommandEncoder,
  modules: RenderModuleDescriptor[],
  currentView: GPUTextureView,
  otherView: GPUTextureView,
  computeBuild: Program,
  resources: GPUResources,
  renderer: WebGPURenderer,
  particleCount: number
): GPUTextureView {
  // Tracks which view last received writes and whether anything has been rendered yet
  let lastWritten: GPUTextureView | null = null;
  let anyWrites = false;
  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];
    if (!module.passes || module.passes.length === 0) continue;
    for (const pass of module.passes) {
      // Resolve the uniform layout for this module
      const layout = computeBuild.layouts.find(
        (l) => l.moduleName === module.name
      )!;
      // Snapshot the views state for this pass
      const views = { currentView, otherView, anyWrites };
      let wrote: "current" | "other" | null = null;
      if (pass.kind === RenderPassKind.Fullscreen) {
        // Fullscreen raster pass (quad). Can write the scene directly to current view
        runFullscreenPass(
          encoder,
          module,
          layout,
          pass,
          views,
          resources,
          particleCount
        );
        wrote = pass.writesScene ? "current" : null;
      }
      if (pass.kind === RenderPassKind.Compute) {
        // Compute image pass. Writes into other view; if it writes the scene we ping-pong swap
        runComputePass(
          encoder,
          module,
          layout,
          pass,
          views,
          resources,
          renderer
        );
        wrote = pass.writesScene ? "other" : null;
      }

      // Update ping-pong state based on where this pass wrote the scene
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
  // return last written view
  return lastWritten ?? currentView;
}

/**
 * Run a fullscreen rasterization pass that draws a screen-aligned quad.
 *
 * Builds WGSL program via the render DSL, acquires (or creates) a cached
 * pipeline, binds particle + render uniforms + module uniforms, and draws.
 */
function runFullscreenPass(
  encoder: GPUCommandEncoder,
  module: RenderModuleDescriptor,
  layout: ModuleUniformLayout,
  pass: FullscreenRenderPass,
  views: RenderExecutorViews,
  resources: GPUResources,
  particleCount: number
): void {
  // Generate WGSL for the fullscreen pass
  const wgsl = buildFullscreenPassWGSL(pass, module.name, layout);

  // Acquire or create a cached render pipeline for the generated WGSL
  const pipeline = resources.getOrCreateFullscreenRenderPipeline(wgsl);

  // Create bind group with particle data, global render uniforms, scene sampler/texture, and module uniforms
  const bindGroup = resources.createFullscreenBindGroup(
    resources.getParticleBuffer()!,
    resources.getRenderUniformBuffer()!,
    views.otherView,
    resources.getSceneSampler(),
    resources
      .getModuleUniformBuffers()
      .find((muf) => muf.layout.moduleName === module.name)!.buffer
  );

  // Begin render pass targeting the current view. Clear only on the very first write
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: views.currentView,
        clearValue: DEFAULTS.clearColor,
        loadOp: views.anyWrites ? "load" : "clear",
        storeOp: "store",
      },
    ],
  });
  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(4, particleCount);
  renderPass.end();
}

/**
 * Run a compute image pass that reads from `currentView` and writes into `otherView`.
 *
 * This uses a compute pipeline generated from the DSL. If the pass is marked
 * as writing the scene, the caller will swap the views afterwards.
 */
function runComputePass(
  encoder: GPUCommandEncoder,
  module: RenderModuleDescriptor,
  layout: ModuleUniformLayout,
  pass: ComputeRenderPass,
  views: RenderExecutorViews,
  resources: GPUResources,
  renderer: WebGPURenderer
): void {
  // Generate WGSL for the compute pass
  const wgsl = buildComputeImagePassWGSL(pass, module.name, layout);
  // Acquire or create a cached compute pipeline
  const pipeline = resources.getOrCreateImageComputePipeline(wgsl);
  const muf = resources
    .getModuleUniformBuffers()
    .find((muf) => muf.layout.moduleName === module.name)!;
  // Bind current/other scene views and module uniforms
  const bindGroup = resources.createImageComputeBindGroup(
    pipeline,
    views.currentView,
    views.otherView,
    muf.buffer
  );
  const canvasSize = renderer.getSize();
  // Compute dispatch size (assuming 8x8 threadgroups)
  const workgroupsX = Math.ceil(canvasSize.width / 8);
  const workgroupsY = Math.ceil(canvasSize.height / 8);
  const cp = encoder.beginComputePass();
  cp.setPipeline(pipeline);
  cp.setBindGroup(0, bindGroup);
  cp.dispatchWorkgroups(workgroupsX, workgroupsY);
  cp.end();
}
