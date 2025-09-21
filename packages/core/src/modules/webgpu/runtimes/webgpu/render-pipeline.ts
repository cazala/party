/**
 * RenderPipeline
 *
 * Manages scene render targets (ping-pong textures) and executes a sequence of
 * render module passes. Two pass types are supported:
 * - Fullscreen (raster) passes: draw a screen-aligned quad, optionally instanced per particle
 * - Compute image passes: read from a scene texture and write to the other scene texture
 *
 * The pipeline resolves each module's uniform layout, binds particle/render uniforms
 * and module uniforms, and handles ping-pong view swapping when a pass writes the scene.
 * Finally, it presents the last written scene view to the canvas using a cached copy pipeline.
 */
import type { ModuleUniformLayout, Program } from "./builders/program";
import type { GPUResources } from "./gpu-resources";
import {
  ComputeRenderPass,
  RenderPassKind,
  type FullscreenRenderPass,
  type WebGPURenderDescriptor,
} from "../../module";
import {
  buildComputeImagePassWGSL,
  buildFullscreenPassWGSL,
} from "./builders/render-pass";
import { DEFAULTS } from "./config";

/**
 * Run a fullscreen rasterization pass that draws a screen-aligned quad.
 *
 * Builds WGSL program via the render DSL, acquires (or creates) a cached
 * pipeline, binds particle + render uniforms + module uniforms, and draws.
 */

/**
 * Run a compute image pass that reads from `currentView` and writes into `otherView`.
 *
 * This uses a compute pipeline generated from the DSL. If the pass is marked
 * as writing the scene, the caller will swap the views afterwards.
 */

export class RenderPipeline {
  ensureTargets(resources: GPUResources, width: number, height: number): void {
    resources.ensureSceneTextures(width, height);
  }

  clearTargets(resources: GPUResources): void {
    try {
      const encoder = resources.getDevice().createCommandEncoder();
      const passA = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: resources.getCurrentSceneTextureView(),
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
            view: resources.getOtherSceneTextureView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      passB.end();
      resources.getDevice().queue.submit([encoder.finish()]);
    } catch (_) {
      // ignore if textures not ready
    }
  }

  runPasses(
    encoder: GPUCommandEncoder,
    descriptors: WebGPURenderDescriptor<string, string>[],
    program: Program,
    resources: GPUResources,
    viewSize: { width: number; height: number },
    particleCount: number
  ): GPUTextureView {
    let currentView = resources.getCurrentSceneTextureView();
    let otherView = resources.getOtherSceneTextureView();
    let lastWritten: GPUTextureView | null = null;
    let anyWrites = false;

    for (let i = 0; i < descriptors.length; i++) {
      const module = descriptors[i];
      if (!module.passes || module.passes.length === 0) continue;
      for (const pass of module.passes) {
        // Resolve the uniform layout for this module
        const layout = program.layouts.find(
          (l) => l.moduleName === module.name
        )!;
        // Snapshot the views state for this pass
        const views = { currentView, otherView, anyWrites };
        let wrote: "current" | "other" | null = null;
        if (pass.kind === RenderPassKind.Fullscreen) {
          // Fullscreen raster pass (quad). Can write the scene directly to current view
          this.runFullscreenPass(
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
          this.runComputePass(
            encoder,
            module,
            layout,
            pass,
            views,
            resources,
            viewSize
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

  present(
    encoder: GPUCommandEncoder,
    resources: GPUResources,
    sourceView?: GPUTextureView
  ): void {
    const pipeline = resources.getCopyPipeline(resources.format);
    const bindGroup = resources.getDevice().createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: sourceView ?? resources.getCurrentSceneTextureView(),
        },
        { binding: 1, resource: resources.getSceneSampler() },
      ],
    });
    const canvasView = resources.getContext().getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4, 1);
    pass.end();
  }

  private runFullscreenPass(
    encoder: GPUCommandEncoder,
    module: WebGPURenderDescriptor,
    layout: ModuleUniformLayout,
    pass: FullscreenRenderPass,
    views: {
      currentView: GPUTextureView;
      otherView: GPUTextureView;
      anyWrites: boolean;
    },
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
    const instanced = pass.instanced ?? true;
    renderPass.draw(4, instanced ? particleCount : 1);
    renderPass.end();
  }

  private runComputePass(
    encoder: GPUCommandEncoder,
    module: WebGPURenderDescriptor,
    layout: ModuleUniformLayout,
    pass: ComputeRenderPass,
    views: {
      currentView: GPUTextureView;
      otherView: GPUTextureView;
      anyWrites: boolean;
    },
    resources: GPUResources,
    size: { width: number; height: number }
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
    const canvasSize = size;
    // Compute dispatch size (assuming 8x8 threadgroups)
    const workgroupsX = Math.ceil(canvasSize.width / 8);
    const workgroupsY = Math.ceil(canvasSize.height / 8);
    const cp = encoder.beginComputePass();
    cp.setPipeline(pipeline);
    cp.setBindGroup(0, bindGroup);
    cp.dispatchWorkgroups(workgroupsX, workgroupsY);
    cp.end();
  }
}
