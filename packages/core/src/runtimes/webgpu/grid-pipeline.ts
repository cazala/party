import type { Module, GridSpec, WebGPUGridDescriptor } from "../../module";
import type { GPUResources } from "./gpu-resources";
import type { ModuleRegistry } from "./module-registry";
import { getGridChannelCount } from "../../grid/store";

type GridPipelineEntry = {
  layout: GPUBindGroupLayout;
  init?: GPUComputePipeline;
  step: GPUComputePipeline;
  post?: GPUComputePipeline;
  workgroupSize: [number, number, number];
  width: number;
  height: number;
};

export class GridPipeline {
  private pipelines: Map<string, GridPipelineEntry> = new Map();
  private initialized: Set<string> = new Set();

  initialize(
    resources: GPUResources,
    registry: ModuleRegistry,
    gridModules: readonly Module[],
    gridSpecs: Map<string, GridSpec>
  ): void {
    const program = registry.getProgram();
    const device = resources.getDevice();
    this.pipelines.clear();
    this.initialized.clear();

    for (const module of gridModules) {
      const spec = gridSpecs.get(module.name);
      if (!spec) continue;
      const descriptor = module.webgpu() as WebGPUGridDescriptor;
      if (!descriptor || !descriptor.step) continue;

      const layout = program.layouts.find((l) => l.moduleName === module.name);
      if (!layout) continue;

      const channels = getGridChannelCount(spec);
      const workgroupSize: [number, number, number] = [8, 8, 1];

      const uniformStruct = `struct ${layout.structName} {\n${Array.from(
        { length: layout.vec4Count },
        (_, i) => `  v${i}: vec4<f32>,`
      ).join("\n")}\n}`;
      const uniformDecl = `@group(0) @binding(0) var<uniform> ${layout.uniformsVar}: ${layout.structName};`;

      const gridDecls = [
        `@group(0) @binding(1) var<storage, read> GRID_READ: array<f32>;`,
        `@group(0) @binding(2) var<storage, read_write> GRID_WRITE: array<f32>;`,
      ];

      const wrapMode = spec.wrap ?? "clamp";
      const wrapFn =
        wrapMode === "repeat"
          ? `fn grid_wrap(v: i32, maxv: i32) -> i32 { let m = ((v % maxv) + maxv) % maxv; return m; }`
          : wrapMode === "mirror"
            ? `fn grid_wrap(v: i32, maxv: i32) -> i32 { let period = maxv * 2; let m = ((v % period) + period) % period; return select(m, period - 1 - m, m >= maxv); }`
            : `fn grid_wrap(v: i32, maxv: i32) -> i32 { return max(0, min(v, maxv - 1)); }`;

      const helpers = `
const GRID_WIDTH: u32 = ${spec.width}u;
const GRID_HEIGHT: u32 = ${spec.height}u;
const GRID_CHANNELS: u32 = ${channels}u;

${wrapFn}

fn grid_index(x: i32, y: i32, c: u32) -> u32 {
  let xx = grid_wrap(x, i32(GRID_WIDTH));
  let yy = grid_wrap(y, i32(GRID_HEIGHT));
  return (u32(yy) * GRID_WIDTH + u32(xx)) * GRID_CHANNELS + c;
}

fn grid_read(x: i32, y: i32, c: u32) -> f32 {
  return GRID_READ[grid_index(x, y, c)];
}

fn grid_write(x: i32, y: i32, c: u32, v: f32) {
  GRID_WRITE[grid_index(x, y, c)] = v;
}
`;

      const getUniform = (id: string, index?: number | string) => {
        const key = String(id);
        const map = layout.mapping as Record<string, { expr: string }>;
        if (index !== undefined) {
          return map[`${key}_offset`]
            ? `(${map[`${key}_offset`].expr} + ${index})`
            : "0.0";
        }
        return map[key]?.expr ?? "0.0";
      };
      const getLength = (id: string) => {
        const map = layout.mapping as Record<string, { expr: string }>;
        return map[`${id}_length`]?.expr ?? "0.0";
      };

      const makeEntry = (name: "init" | "step" | "post", body: string) => `
@compute @workgroup_size(${workgroupSize[0]}, ${workgroupSize[1]}, ${workgroupSize[2]})
fn ${name}_${module.name}(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= GRID_WIDTH || gid.y >= GRID_HEIGHT) { return; }
  let cellCoord = vec2<u32>(gid.x, gid.y);
  let cellIndex = (gid.y * GRID_WIDTH + gid.x) * GRID_CHANNELS;
  ${body}
}
`;

      const globals = descriptor.globals
        ? descriptor.globals({ getUniform: (id, index) => getUniform(String(id), index), getLength: (id) => getLength(String(id)) })
        : "";
      const initBody = descriptor.init
        ? descriptor.init({
            getUniform: (id, index) => getUniform(String(id), index),
            getLength: (id) => getLength(String(id)),
            gridRead: "GRID_READ",
            gridWrite: "GRID_WRITE",
            cellIndexVar: "cellIndex",
            cellCoordVar: "cellCoord",
            widthVar: "GRID_WIDTH",
            heightVar: "GRID_HEIGHT",
          })
        : "";
      const stepBody = descriptor.step({
        getUniform: (id, index) => getUniform(String(id), index),
        getLength: (id) => getLength(String(id)),
        gridRead: "GRID_READ",
        gridWrite: "GRID_WRITE",
        cellIndexVar: "cellIndex",
        cellCoordVar: "cellCoord",
        widthVar: "GRID_WIDTH",
        heightVar: "GRID_HEIGHT",
      });
      const postBody = descriptor.post
        ? descriptor.post({
            getUniform: (id, index) => getUniform(String(id), index),
            getLength: (id) => getLength(String(id)),
            gridRead: "GRID_READ",
            gridWrite: "GRID_WRITE",
            cellIndexVar: "cellIndex",
            cellCoordVar: "cellCoord",
            widthVar: "GRID_WIDTH",
            heightVar: "GRID_HEIGHT",
          })
        : "";

      const code = [
        uniformStruct,
        uniformDecl,
        ...gridDecls,
        helpers,
        globals,
        initBody ? makeEntry("init", initBody) : "",
        makeEntry("step", stepBody),
        postBody ? makeEntry("post", postBody) : "",
      ].join("\n");

      const shaderModule = device.createShaderModule({ code });
      const layoutEntries: GPUBindGroupLayoutEntry[] = [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      ];
      const bindGroupLayout = device.createBindGroupLayout({
        entries: layoutEntries,
      });
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      const makePipeline = (entryPoint: string) =>
        device.createComputePipeline({
          layout: pipelineLayout,
          compute: { module: shaderModule, entryPoint },
        });

      const entry: GridPipelineEntry = {
        layout: bindGroupLayout,
        init: initBody ? makePipeline(`init_${module.name}`) : undefined,
        step: makePipeline(`step_${module.name}`),
        post: postBody ? makePipeline(`post_${module.name}`) : undefined,
        workgroupSize,
        width: spec.width,
        height: spec.height,
      };

    this.pipelines.set(module.name, entry);
    }
  }

  markInitialized(moduleName: string): void {
    this.initialized.add(moduleName);
  }

  isInitialized(moduleName: string): boolean {
    return this.initialized.has(moduleName);
  }

  run(
    encoder: GPUCommandEncoder,
    resources: GPUResources,
    registry: ModuleRegistry,
    gridModules: readonly Module[],
    gridStores: Map<string, { read: GPUBuffer; write: GPUBuffer }>
  ): void {
    if (this.pipelines.size === 0) return;
    const device = resources.getDevice();
    const uniformBuffers = resources.getModuleUniformBuffers();
    const program = registry.getProgram();

    for (const module of gridModules) {
      if (!module.isEnabled()) continue;
      const entry = this.pipelines.get(module.name);
      if (!entry) continue;
      const buffers = gridStores.get(module.name);
      if (!buffers) continue;

      const layout = program.layouts.find((l) => l.moduleName === module.name);
      if (!layout) continue;
      const uniformIdx = program.layouts.indexOf(layout);
      const uniformBuffer = uniformBuffers[uniformIdx]?.buffer;
      if (!uniformBuffer) continue;

      const dispatchX = Math.ceil(entry.width / entry.workgroupSize[0]);
      const dispatchY = Math.ceil(entry.height / entry.workgroupSize[1]);

      const makeBindGroup = (read: GPUBuffer, write: GPUBuffer) =>
        device.createBindGroup({
          layout: entry.layout,
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: read } },
            { binding: 2, resource: { buffer: write } },
          ],
        });

      const runPass = (pipeline: GPUComputePipeline) => {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, makeBindGroup(buffers.read, buffers.write));
        pass.dispatchWorkgroups(dispatchX, dispatchY, 1);
        pass.end();
      };

      if (!this.initialized.has(module.name) && entry.init) {
        runPass(entry.init);
        const tmp = buffers.read;
        buffers.read = buffers.write;
        buffers.write = tmp;
        this.initialized.add(module.name);
      }

      runPass(entry.step);
      {
        const tmp = buffers.read;
        buffers.read = buffers.write;
        buffers.write = tmp;
      }
      if (entry.post) {
        runPass(entry.post);
        const tmp = buffers.read;
        buffers.read = buffers.write;
        buffers.write = tmp;
      }
    }

  }

  reset(): void {
    this.initialized.clear();
  }
}
