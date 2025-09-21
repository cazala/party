/**
 * ModuleRegistry
 *
 * Central registry for modules. It builds the combined WGSL Program and manages
 * per-module uniform state on the CPU, mirroring it into GPU uniform buffers.
 *
 * Key behaviors:
 * - Builds `Program` via the builders (uniform layouts + generated WGSL code)
 * - Allocates module uniform buffers and seeds default CPU-side uniform values
 * - Attaches uniform writers/readers to each Module instance
 * - Exposes helpers to get enabled render descriptors for the render pipeline
 * - Flushes uniform state to GPU upon writes and on initialization
 */
import type { GPUResources } from "./gpu-resources";
import { buildProgram, type Program } from "./builders/program";
import {
  Module,
  ModuleRole,
  type RenderModuleDescriptor,
} from "./module-descriptors";

/**
 * Manages module enablement/state, builds the Program, and exposes uniform writers/readers.
 */
export class ModuleRegistry {
  private readonly modules: readonly Module<string, string, any>[];
  private program: Program | null = null;
  private moduleUniformState: Record<string, number>[] = [];
  private nameToIndex: Map<string, number> = new Map();
  private resources: GPUResources | null = null;

  constructor(modules: readonly Module<string, string, any>[]) {
    this.modules = modules;
  }

  /**
   * Build WGSL program and allocate per-module uniform buffers.
   * Also seeds CPU-side uniform state and attaches writers/readers to modules.
   */
  initialize(resources: GPUResources): void {
    this.resources = resources;
    this.program = buildProgram(this.modules);
    // Rebuild name -> layout index map using Program layouts (includes internal first)
    this.nameToIndex = new Map();
    this.program.layouts.forEach((layout, i) =>
      this.nameToIndex.set(layout.moduleName, i)
    );
    resources.createModuleUniformBuffers(this.program.layouts);

    // Initialize CPU-side uniform state for each module
    this.moduleUniformState = this.program.layouts.map((layout) => {
      const state: Record<string, number> = {};
      for (const key of Object.keys(layout.mapping)) state[key] = 0;
      if (layout.moduleName !== "simulation" && "enabled" in layout.mapping) {
        state["enabled"] = 1;
      }
      return state;
    });

    // Seed simStride if present on the simulation layout
    const simIdx = this.program.layouts.findIndex(
      (l) => l.moduleName === "simulation"
    );
    if (simIdx !== -1 && this.program.layouts[simIdx].mapping["simStride"]) {
      this.moduleUniformState[simIdx]["simStride"] =
        this.program.simStateStride;
    }

    // Attach per-module uniform writers/readers
    this.modules.forEach((mod) => {
      const name = mod.descriptor().name;
      mod.attachUniformWriter((values) =>
        this.writeModuleUniform(name, values)
      );
      mod.attachUniformReader(() => this.readModuleUniform(name));
    });
  }

  getProgram(): Program {
    if (!this.program) throw new Error("Program not initialized");
    return this.program;
  }

  /** Returns a writer for the given module name. */
  getUniformWriter(
    name: string
  ): (values: Partial<Record<string, number>>) => void {
    return (values) => this.writeModuleUniform(name, values);
  }

  /** Returns a reader for the given module name. */
  getUniformReader(name: string): () => Record<string, number> {
    return () => this.readModuleUniform(name);
  }

  /** Filter enabled render module descriptors for the render pipeline. */
  getEnabledRenderDescriptors(): RenderModuleDescriptor<string, string>[] {
    return this.modules
      .map((m) => m.descriptor())
      .filter(
        (
          descriptor,
          idx
        ): descriptor is RenderModuleDescriptor<string, string> =>
          descriptor.role === ModuleRole.Render && this.modules[idx].isEnabled()
      );
  }

  /** Write the current CPU state for all module uniforms to GPU buffers. */
  writeAllModuleUniforms(): void {
    if (!this.resources || !this.program) return;
    for (let i = 0; i < this.program.layouts.length; i++) {
      const name = this.program.layouts[i].moduleName;
      if (name === "simulation" || name === "grid") continue; // internal uniforms are managed elsewhere
      this.flushModuleUniform(i);
    }
  }

  // Internal helpers
  private readModuleUniform(name: string): Record<string, number> {
    const idx = this.getModuleIndex(name);
    return { ...(this.moduleUniformState[idx] || {}) };
  }

  private writeModuleUniform(
    name: string,
    values: Partial<Record<string, number>>
  ): void {
    if (!this.program) return;
    const idx = this.getModuleIndex(name);
    const state = this.moduleUniformState[idx];
    for (const [key, value] of Object.entries(values)) {
      state[key] = value as number;
    }
    this.flushModuleUniform(idx);
  }

  private flushModuleUniform(index: number): void {
    if (!this.resources || !this.program) return;
    const layout = this.program.layouts[index];
    const state = this.moduleUniformState[index];
    const data = new Float32Array(layout.vec4Count * 4);
    for (const [key, map] of Object.entries(layout.mapping)) {
      data[(map as { flatIndex: number }).flatIndex] = state[key] ?? 0;
    }
    this.resources.writeModuleUniform(index, data);
  }

  private getModuleIndex(name: string): number {
    const idx = this.nameToIndex.get(name);
    if (idx === undefined) throw new Error(`Unknown module: ${name}`);
    return idx;
  }
}
