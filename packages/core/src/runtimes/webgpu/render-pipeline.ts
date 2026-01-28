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
  Module,
  ModuleRole,
  ComputeRenderPass,
  RenderPassKind,
  DataType,
  type FullscreenRenderPass,
  type WebGPURenderDescriptor,
  type WebGPUGridDescriptor,
  type GridSpec,
} from "../../module";
import {
  buildComputeImagePassWGSL,
  buildFullscreenPassWGSL,
} from "./builders/render-pass";

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

  clearTargets(
    resources: GPUResources,
    color: { r: number; g: number; b: number; a: number } = {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    }
  ): void {
    try {
      const encoder = resources.getDevice().createCommandEncoder();
      const passA = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: resources.getCurrentSceneTextureView(),
            clearValue: { r: color.r, g: color.g, b: color.b, a: 0 },
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
            clearValue: { r: color.r, g: color.g, b: color.b, a: 0 },
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
    modules: Module[],
    program: Program,
    resources: GPUResources,
    viewSize: { width: number; height: number },
    particleCount: number,
    clearColor: { r: number; g: number; b: number; a: number },
    gridBuffers?: Map<string, GPUBuffer>
  ): GPUTextureView {
    let currentView = resources.getCurrentSceneTextureView();
    let otherView = resources.getOtherSceneTextureView();
    let lastWritten: GPUTextureView | null = null;
    let anyWrites = false;

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      const descriptor =
        module.role === ModuleRole.Grid
          ? (module.webgpu() as WebGPUGridDescriptor).render
          : (module.webgpu() as WebGPURenderDescriptor);
      if (!descriptor || !descriptor.passes || descriptor.passes.length === 0)
        continue;
      for (const pass of descriptor.passes) {
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
            pass as FullscreenRenderPass,
            views,
            resources,
            particleCount,
            clearColor,
            gridBuffers
          );
          wrote = pass.writesScene ? "current" : null;
        }
        if (pass.kind === RenderPassKind.Compute) {
          // Compute image pass. Writes into other view; if it writes the scene we ping-pong swap
          this.runComputePass(
            encoder,
            module,
            layout,
            pass as ComputeRenderPass,
            views,
            resources,
            viewSize,
            clearColor,
            gridBuffers
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
    // If no render pass wrote to the scene this frame, explicitly clear the current view
    if (!anyWrites) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentView,
            clearValue: clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.end();
      lastWritten = currentView;
    }

    // Return the last written (or cleared) view
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
    module: Module,
    layout: ModuleUniformLayout,
    pass: FullscreenRenderPass,
    views: {
      currentView: GPUTextureView;
      otherView: GPUTextureView;
      anyWrites: boolean;
    },
    resources: GPUResources,
    particleCount: number,
    clearColor: { r: number; g: number; b: number; a: number },
    gridBuffers?: Map<string, GPUBuffer>
  ): void {
    // Generate WGSL for the fullscreen pass
    const isGridModule = module.role === ModuleRole.Grid;
    const gridSpec = isGridModule
      ? (module as unknown as { gridSpec?: GridSpec }).gridSpec
      : undefined;
    const wgsl = buildFullscreenPassWGSL(
      pass as FullscreenRenderPass,
      module.name,
      layout,
      module.inputs,
      clearColor,
      gridSpec
        ? { spec: gridSpec, bindingIndex: this.getGridBindingIndex(module, module.inputs, true) }
        : undefined
    );

    // Get array inputs for this module
    const arrayInputs = Object.entries(module.inputs)
      .filter(([_, type]) => type === DataType.ARRAY)
      .map(([key, _]) => key);

    const gridBindingIndex = gridSpec
      ? this.getGridBindingIndex(module, module.inputs, true)
      : undefined;
    const gridBuffer = gridSpec ? gridBuffers?.get(module.name) : undefined;

    // Check if this is a non-instanced pass that needs fragment particle access
    const fragmentParticleAccess = pass.instanced === false;

    // Acquire or create a cached render pipeline for the generated WGSL
    const pipeline = resources.getOrCreateFullscreenRenderPipeline(
      wgsl,
      arrayInputs,
      fragmentParticleAccess,
      gridBindingIndex
    );

    // Create bind group with particle data, global render uniforms, scene sampler/texture, and module uniforms
    const bindGroup = resources.createFullscreenBindGroup(
      resources.getParticleBuffer()!,
      resources.getRenderUniformBuffer()!,
      views.otherView,
      resources.getSceneSampler(),
      resources
        .getModuleUniformBuffers()
        .find((muf) => muf.layout.moduleName === module.name)!.buffer,
      module.name,
      arrayInputs,
      fragmentParticleAccess,
      gridBuffer,
      gridBindingIndex
    );

    // Begin render pass targeting the current view. Clear only on the very first write
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: views.currentView,
          clearValue: clearColor,
          loadOp: views.anyWrites ? "load" : "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    const instanced = pass.instanced ?? true;
    // Support instanceFrom to drive instance count from an array input length
    let instanceCount = particleCount;
    if (pass.instanceFrom) {
      const inputs = module.read();
      const arr = (inputs[pass.instanceFrom] as number[]) || [];
      instanceCount = arr.length >>> 0;
    }
    // Draw
    if (instanced && instanceCount > 0) {
      renderPass.draw(4, instanceCount);
    } else if (!instanced) {
      renderPass.draw(4, 1);
    }

    renderPass.end();
  }

  private runComputePass(
    encoder: GPUCommandEncoder,
    module: Module,
    layout: ModuleUniformLayout,
    pass: ComputeRenderPass,
    views: {
      currentView: GPUTextureView;
      otherView: GPUTextureView;
      anyWrites: boolean;
    },
    resources: GPUResources,
    size: { width: number; height: number },
    clearColor: { r: number; g: number; b: number; a: number },
    gridBuffers?: Map<string, GPUBuffer>
  ): void {
    // Generate WGSL for the compute pass
    const isGridModule = module.role === ModuleRole.Grid;
    const gridSpec = isGridModule
      ? (module as unknown as { gridSpec?: GridSpec }).gridSpec
      : undefined;
    const wgsl = buildComputeImagePassWGSL(
      pass as ComputeRenderPass,
      module.name,
      layout,
      module.inputs,
      clearColor,
      pass.workgroupSize ?? [8, 8, 1],
      gridSpec
        ? { spec: gridSpec, bindingIndex: this.getGridBindingIndex(module, module.inputs, false) }
        : undefined
    );

    // Get array inputs for this module
    const arrayInputs = Object.entries(module.inputs)
      .filter(([_, type]) => type === DataType.ARRAY)
      .map(([key, _]) => key);
    const gridBindingIndex = gridSpec
      ? this.getGridBindingIndex(module, module.inputs, false)
      : undefined;
    const gridBuffer = gridSpec ? gridBuffers?.get(module.name) : undefined;

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
      muf.buffer,
      module.name,
      arrayInputs,
      gridBuffer,
      gridBindingIndex
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

  private getGridBindingIndex(
    _module: Module,
    inputs: Record<string, DataType>,
    fullscreen: boolean
  ): number {
    const arrayInputs = Object.entries(inputs)
      .filter(([_, type]) => type === DataType.ARRAY)
      .map(([key, _]) => key);
    if (fullscreen) {
      return arrayInputs.length > 0 ? 6 : 5;
    }
    return arrayInputs.length > 0 ? 4 : 3;
  }
}
