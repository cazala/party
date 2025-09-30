/**
 * Module Builder (Program generator)
 *
 * Builds a single WGSL Program from a list of `Module` instances by:
 * - Creating a packed uniform layout per module and mapping named fields to `vec4` slots
 * - Emitting internal global helpers (simulation/grid) and optional force module globals
 * - Generating optional state/apply/constrain/correct functions for force modules
 * - Defining simulation entrypoints and grid entrypoints (inlined internally)
 * - Assigning extra bind group bindings (grid, sim state, scene texture)
 *
 * Output:
 * - `Program.code`: complete WGSL source for all compute passes
 * - `Program.layouts`: uniform layout/offset metadata for writing uniforms from CPU
 * - `Program.simStateStride`: size of the shared SIM_STATE row per particle
 * - `Program.extraBindings`: indices for additional buffers/textures bound by pipelines
 */
import {
  Module,
  ModuleRole,
  DataType,
  type WebGPUDescriptor,
} from "../../../module";

export const PARTICLE_STRUCT = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
}`;

export const STORAGE_DECL = `@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;`;

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export interface ModuleUniformLayout {
  moduleName: string;
  moduleRole: ModuleRole;
  bindingIndex: number;
  uniformsVar: string;
  structName: string;
  sizeBytes: number;
  vec4Count: number;
  mapping: Record<string, { flatIndex: number; expr: string }>;
}

export interface Program {
  code: string;
  layouts: ModuleUniformLayout[];
  simStateStride: number;
  extraBindings: {
    grid?: { countsBinding: number; indicesBinding: number };
    simState?: { stateBinding: number };
    sceneTexture?: { textureBinding: number };
    arrays?: Record<string, { arrayBinding: number; lengthBinding: number }>; // moduleName_arrayKey -> bindings
  };
}

export function buildProgram(modules: readonly Module[]): Program {
  const descriptors = modules.map((m) => m.webgpu());

  const layouts: ModuleUniformLayout[] = [];
  const uniformDecls: string[] = [];
  // 1) Internal simulation uniforms at binding(1)
  const pushUniformLayout = (
    name: string,
    fieldIds: readonly string[],
    bindingIndex: number
  ) => {
    const uniformsVar = `${name}_uniforms`;
    const structName = `Uniforms_${cap(name)}`;
    const idsLocal = [...fieldIds] as string[];
    const vec4Count = Math.max(1, Math.ceil(idsLocal.length / 4));
    const mapping: Record<string, { flatIndex: number; expr: string }> = {};
    idsLocal.forEach((id, i) => {
      const v = Math.floor(i / 4),
        c = i % 4;
      const comp = c === 0 ? "x" : c === 1 ? "y" : c === 2 ? "z" : "w";
      mapping[id] = {
        flatIndex: v * 4 + c,
        expr: `${uniformsVar}.v${v}.${comp}`,
      };
    });
    const structWGSL = `struct ${structName} {\n${Array.from(
      { length: vec4Count },
      (_, i) => `  v${i}: vec4<f32>,`
    ).join("\n")}\n}`;
    const varDecl = `@group(0) @binding(${bindingIndex}) var<uniform> ${uniformsVar}: ${structName};`;
    layouts.push({
      moduleName: name,
      moduleRole: ModuleRole.Force as ModuleRole, // internal; role unused for gating
      bindingIndex,
      uniformsVar,
      structName,
      sizeBytes: vec4Count * 16,
      vec4Count,
      mapping,
    });
    uniformDecls.push(structWGSL, varDecl);
  };

  // Internal: simulation + grid
  pushUniformLayout(
    "simulation",
    ["dt", "count", "simStride", "maxSize"] as const,
    1
  );
  pushUniformLayout(
    "grid",
    [
      "minX",
      "minY",
      "maxX",
      "maxY",
      "cols",
      "rows",
      "cellSize",
      "maxPerCell",
    ] as const,
    2
  );

  // 2) User module uniforms start at binding(3)
  let nextBindingIndex = 3;
  const arrayDecls: string[] = [];
  const arrayBindings: Record<
    string,
    { arrayBinding: number; lengthBinding: number; lengthExpr?: string }
  > = {};

  modules.forEach((module) => {
    const uniformsVar = `${module.name}_uniforms`;
    const structName = `Uniforms_${cap(module.name)}`;

    // Separate number inputs (including enabled) from array inputs
    const numberInputs = Object.entries(module.inputs)
      .filter(([_, type]) => type === DataType.NUMBER)
      .map(([key, _]) => key);
    const arrayInputs = Object.entries(module.inputs)
      .filter(([_, type]) => type === DataType.ARRAY)
      .map(([key, _]) => key);

    // Add enabled and array lengths as number inputs
    const arrayLengthInputs = arrayInputs.map((key) => `${key}_length`);
    const allNumberInputs = [...numberInputs, "enabled", ...arrayLengthInputs];

    // Create uniform buffer for number inputs
    const bindingIndex = nextBindingIndex++;
    const vec4Count = Math.max(1, Math.ceil(allNumberInputs.length / 4));
    const mapping: Record<string, { flatIndex: number; expr: string }> = {};

    allNumberInputs.forEach((id, i) => {
      const v = Math.floor(i / 4),
        c = i % 4;
      const comp = c === 0 ? "x" : c === 1 ? "y" : c === 2 ? "z" : "w";
      mapping[id] = {
        flatIndex: v * 4 + c,
        expr: `${uniformsVar}.v${v}.${comp}`,
      };
    });

    const structWGSL = `struct ${structName} {\n${Array.from(
      { length: vec4Count },
      (_, i) => `  v${i}: vec4<f32>,`
    ).join("\n")}\n}`;
    const varDecl = `@group(0) @binding(${bindingIndex}) var<uniform> ${uniformsVar}: ${structName};`;

    layouts.push({
      moduleName: module.name,
      moduleRole: module.role,
      bindingIndex,
      uniformsVar,
      structName,
      sizeBytes: vec4Count * 16,
      vec4Count,
      mapping,
    });
    uniformDecls.push(structWGSL, varDecl);

    // Create storage buffers for array inputs
    // Only expose array storage buffers for force modules in the compute Program
    if (module.role !== ModuleRole.Force) {
      return;
    }
    arrayInputs.forEach((arrayKey) => {
      const arrayBinding = nextBindingIndex++;
      const arrayVar = `${module.name}_${arrayKey}_array`;

      // Add array storage buffer declaration
      arrayDecls.push(
        `@group(0) @binding(${arrayBinding}) var<storage, read> ${arrayVar}: array<f32>;`
      );

      // Length is now stored in the main uniform buffer, find its expression
      const lengthKey = `${arrayKey}_length`;
      const lengthMapping = mapping[lengthKey];
      const lengthExpr = lengthMapping ? lengthMapping.expr : "0u";

      // Track array bindings
      arrayBindings[`${module.name}_${arrayKey}`] = {
        arrayBinding,
        lengthBinding: -1, // No separate binding, using main uniform
        lengthExpr,
      };

      // Add array mappings to the module's mapping for getUniform access
      mapping[arrayKey] = {
        flatIndex: -1, // Not in uniform buffer
        expr: arrayVar, // Direct array reference
      };
      // Don't overwrite the length mapping if it already exists with a proper flatIndex
      if (
        !mapping[`${arrayKey}_length`] ||
        mapping[`${arrayKey}_length`].flatIndex === -1
      ) {
        mapping[`${arrayKey}_length`] = {
          flatIndex: -1,
          expr: lengthExpr,
        };
      }
    });
  });

  const dtExpr = layouts.find((l) => l.moduleName === "simulation")!.mapping.dt
    .expr;
  const countExpr = layouts.find((l) => l.moduleName === "simulation")!.mapping
    .count.expr;
  const maxSizeExpr = layouts.find((l) => l.moduleName === "simulation")!
    .mapping.maxSize.expr;

  const baseState = ["prevX", "prevY", "posIntX", "posIntY"] as const;
  const stateSlots: Record<string, number> = {};
  baseState.forEach((k, i) => (stateSlots[k] = i));
  let nextSlot = baseState.length;
  const localSlots: Record<string, Record<string, number>> = {};
  modules.forEach((module, idx) => {
    const descriptor = descriptors[idx];
    localSlots[module.name] = {};
    if (module.role === ModuleRole.Force && (descriptor as any).states) {
      ((descriptor as any).states as readonly string[]).forEach((field) => {
        const key = `${module.name}.${field}`;
        if (stateSlots[key] === undefined) stateSlots[key] = nextSlot++;
        localSlots[module.name][field] = stateSlots[key];
      });
    }
  });
  const SIM_STATE_STRIDE_VAL = nextSlot;

  // Grid and system bindings come after all module bindings (including arrays)
  const gridCountsBinding = nextBindingIndex++;
  const gridIndicesBinding = nextBindingIndex++;
  const simStateBinding = nextBindingIndex++;
  const sceneTextureBinding = nextBindingIndex++;
  const gridDecls = [
    `@group(0) @binding(${gridCountsBinding}) var<storage, read_write> GRID_COUNTS: array<atomic<u32>>;`,
    `@group(0) @binding(${gridIndicesBinding}) var<storage, read_write> GRID_INDICES: array<u32>;`,
    `@group(0) @binding(${simStateBinding}) var<storage, read_write> SIM_STATE: array<f32>;`,
    `@group(0) @binding(${sceneTextureBinding}) var scene_texture: texture_2d<f32>;`,
    ...arrayDecls,
  ];

  const makeGetUniformAndLength = (module: Module) => {
    const layout = layouts.find((l) => l.moduleName === module.name)!;
    const getUniform = (id: string, index?: number | string) => {
      const mapping = layout.mapping[id];
      if (!mapping) return "0.0";

      // Check if this is an array input
      if (module.inputs[id] === DataType.ARRAY) {
        if (index !== undefined) {
          return `${mapping.expr}[${index}]`;
        } else {
          // Return the array variable name itself for direct access
          return mapping.expr;
        }
      } else {
        // Regular number input
        return mapping.expr;
      }
    };
    const getLength = (id: string) => {
      if (module.inputs[id] === DataType.ARRAY) {
        const lengthMapping = layout.mapping[`${id}_length`];
        return `u32(${lengthMapping?.expr ?? "0.0"})`;
      }
      return "0u";
    };
    return { getUniform, getLength };
  };

  const globals: string[] = [];
  // Internal simulation helpers
  const simLayout = layouts.find((l) => l.moduleName === "simulation")!;
  const gridLayout = layouts.find((l) => l.moduleName === "grid")!;
  globals.push(`// Internal simulation helpers`);
  globals.push(
    `fn SIM_STATE_STRIDE() -> u32 { return u32(${simLayout.mapping.simStride.expr}); }
fn SIM_COUNT() -> u32 { return u32(${simLayout.mapping.count.expr}); }
fn sim_state_index(pid: u32, slot: u32) -> u32 { return pid * SIM_STATE_STRIDE() + slot; }
fn sim_state_read(pid: u32, slot: u32) -> f32 { return SIM_STATE[sim_state_index(pid, slot)]; }
fn sim_state_write(pid: u32, slot: u32, value: f32) { SIM_STATE[sim_state_index(pid, slot)] = value; }`
  );
  // Internal grid helpers
  globals.push(`// Internal grid helpers`);
  globals.push(
    `const NEIGHBOR_NONE: u32 = 0xffffffffu;
fn GRID_COLS() -> u32 { return u32(${gridLayout.mapping.cols.expr}); }
fn GRID_ROWS() -> u32 { return u32(${gridLayout.mapping.rows.expr}); }
fn GRID_MINX() -> f32 { return ${gridLayout.mapping.minX.expr}; }
fn GRID_MINY() -> f32 { return ${gridLayout.mapping.minY.expr}; }
fn GRID_MAXX() -> f32 { return ${gridLayout.mapping.maxX.expr}; }
fn GRID_MAXY() -> f32 { return ${gridLayout.mapping.maxY.expr}; }
fn GRID_CELL_SIZE() -> f32 { return ${gridLayout.mapping.cellSize.expr}; }
fn GRID_MAX_PER_CELL() -> u32 { return u32(${gridLayout.mapping.maxPerCell.expr}); }
fn grid_cell_index(pos: vec2<f32>) -> u32 { let col = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let row = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let c = max(0, min(col, i32(GRID_COLS()) - 1)); let r = max(0, min(row, i32(GRID_ROWS()) - 1)); return u32(r) * GRID_COLS() + u32(c); }
fn grid_cell_index_from_rc(r: i32, c: i32) -> u32 { let rr = max(0, min(r, i32(GRID_ROWS()) - 1)); let cc = max(0, min(c, i32(GRID_COLS()) - 1)); return u32(rr) * GRID_COLS() + u32(cc); }
struct NeighborIter { cx: i32, cy: i32, r: i32, c: i32, k: u32, reach: i32, maxK: u32, base: u32 }
fn neighbor_iter_init(pos: vec2<f32>, radius: f32) -> NeighborIter { let cx = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let cy = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let reach = max(1, i32(ceil(radius / GRID_CELL_SIZE()))); var it: NeighborIter; it.cx = cx; it.cy = cy; it.reach = reach; it.r = cy - reach; it.c = cx - reach; let firstCell = grid_cell_index_from_rc(it.r, it.c); let cnt = atomicLoad(&GRID_COUNTS[firstCell]); it.maxK = min(cnt, GRID_MAX_PER_CELL()); it.base = firstCell * GRID_MAX_PER_CELL(); it.k = 0u; return it; }
fn neighbor_iter_next(it: ptr<function, NeighborIter>, selfIndex: u32) -> u32 { loop { if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } if ((*it).k < (*it).maxK) { let id = GRID_INDICES[(*it).base + (*it).k]; (*it).k = (*it).k + 1u; if (id != selfIndex) { return id; } else { continue; } } (*it).c = (*it).c + 1; if ((*it).c > (*it).cx + (*it).reach) { (*it).c = (*it).cx - (*it).reach; (*it).r = (*it).r + 1; } if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } let cell = grid_cell_index_from_rc((*it).r, (*it).c); let cnt = atomicLoad(&GRID_COUNTS[cell]); (*it).maxK = min(cnt, GRID_MAX_PER_CELL()); (*it).base = cell * GRID_MAX_PER_CELL(); (*it).k = 0u; } }`
  );

  // Optional: allow force modules to inject globals
  const addGlobal = (module: Module, descriptor: WebGPUDescriptor) => {
    if (module.role !== ModuleRole.Force) return;
    const g = (descriptor as any).global as
      | undefined
      | ((a: {
          getUniform: (id: string, index?: number) => string;
          getLength: (id: string) => string;
        }) => string);
    if (!g) return;
    const { getUniform, getLength } = makeGetUniformAndLength(module);
    const code = g({ getUniform, getLength });
    if (code && code.trim()) {
      globals.push(`// Global for ${module.name}`);
      globals.push(code.trim());
    }
  };
  modules
    .filter((m) => m.role === ModuleRole.Force)
    .forEach((m, idx) => addGlobal(m, descriptors[idx]));

  const systemEntrypoints: string[] = [];
  systemEntrypoints.push(`@compute @workgroup_size(64)
fn grid_clear(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let total = GRID_COLS() * GRID_ROWS();
  if (idx < total) {
    atomicStore(&GRID_COUNTS[idx], 0u);
  }
}`);
  systemEntrypoints.push(`@compute @workgroup_size(64)
fn grid_build(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let count = SIM_COUNT();
  if (i >= count) { return; }
  let p = particles[i];
  if (p.mass == 0.0) { return; }
  let minX = GRID_MINX();
  let maxX = GRID_MAXX();
  let minY = GRID_MINY();
  let maxY = GRID_MAXY();
  let pad = GRID_CELL_SIZE() * 2.0;
  if (p.position.x + p.size < minX - pad || p.position.x - p.size > maxX + pad || p.position.y + p.size < minY - pad || p.position.y - p.size > maxY + pad) {
    return;
  }
  let cell = grid_cell_index(p.position);
  let offset = atomicAdd(&GRID_COUNTS[cell], 1u);
  if (offset < GRID_MAX_PER_CELL()) {
    let base = cell * GRID_MAX_PER_CELL();
    GRID_INDICES[base + offset] = i;
  }
}`);

  const moduleFns: string[] = [];
  const stateStmts: string[] = [];
  const applyStmts: string[] = [];
  const constrainStmts: string[] = [];
  const correctStmts: string[] = [];
  const fn = (kind: string, name: string) => `${kind}_${name}`;
  const makeGetSet = (modName: string) => {
    const get = (name: string, pidVar = "index") => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : localSlots[modName]?.[name];
      return slot === undefined
        ? "0.0"
        : `sim_state_read(u32(${pidVar}), ${slot}u)`;
    };
    const set = (name: string, val: string, pidVar = "index") => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : localSlots[modName]?.[name];
      return slot === undefined
        ? ""
        : `sim_state_write(u32(${pidVar}), ${slot}u, ${val})`;
    };
    return { get, set };
  };

  modules.forEach((module, idx) => {
    const descriptor = descriptors[idx];
    if (module.role !== ModuleRole.Force || !(descriptor as any).state) return;
    const layout = layouts.find((l) => l.moduleName === module.name)!;
    const { set } = makeGetSet(module.name);
    const { getUniform, getLength } = makeGetUniformAndLength(module);
    const body = (descriptor as any).state?.({
      particleVar: "particle",
      dtVar: dtExpr,
      maxSizeVar: maxSizeExpr,
      getUniform,
      getLength,
      setState: set,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("state", module.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      stateStmts.push(`if (${enabled} != 0.0) { ${name}(&particle, index); }`);
    }
  });

  modules.forEach((module, idx) => {
    const descriptor = descriptors[idx];
    if (module.role !== ModuleRole.Force || !(descriptor as any).apply) return;
    const layout = layouts.find((l) => l.moduleName === module.name)!;
    const { get } = makeGetSet(module.name);
    const { getUniform, getLength } = makeGetUniformAndLength(module);
    const body = (descriptor as any).apply?.({
      particleVar: "particle",
      dtVar: dtExpr,
      maxSizeVar: maxSizeExpr,
      getUniform,
      getLength,
      getState: get,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("apply", module.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      applyStmts.push(`if (${enabled} != 0.0) { ${name}(&particle, index); }`);
    }
  });

  modules.forEach((module, idx) => {
    const descriptor = descriptors[idx];
    if (module.role !== ModuleRole.Force || !(descriptor as any).constrain)
      return;
    const layout = layouts.find((l) => l.moduleName === module.name)!;
    const { get } = makeGetSet(module.name);
    const { getUniform, getLength } = makeGetUniformAndLength(module);
    const body = (descriptor as any).constrain?.({
      particleVar: "particle",
      dtVar: dtExpr,
      maxSizeVar: maxSizeExpr,
      getUniform,
      getLength,
      getState: get,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("constrain", module.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      constrainStmts.push(
        `if (${enabled} != 0.0) { ${name}(&particle, index); }`
      );
    }
  });

  modules.forEach((module, idx) => {
    const descriptor = descriptors[idx];
    if (module.role !== ModuleRole.Force || !(descriptor as any).correct)
      return;
    const layout = layouts.find((l) => l.moduleName === module.name)!;
    const { get } = makeGetSet(module.name);
    const { getUniform, getLength } = makeGetUniformAndLength(module);
    const body = (descriptor as any).correct?.({
      particleVar: "particle",
      dtVar: dtExpr,
      maxSizeVar: maxSizeExpr,
      prevPosVar: "prevPos",
      postPosVar: "postPos",
      getUniform,
      getLength,
      getState: get,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("correct", module.name);
      const functionCode = `fn ${name}(particle: ptr<function, Particle>, index: u32, prevPos: vec2<f32>, postPos: vec2<f32>) {\n  ${body.trim()}\n}`;
      const callStatement = `if (${enabled} != 0.0) { ${name}(&particle, index, prevPos, postPos); }`;

      moduleFns.push(functionCode);
      correctStmts.push(callStatement);
    }
  });

  const statePass = `@compute @workgroup_size(64)\nfn state_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass <= 0.0) { return; }\n  ${stateStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const applyPass = `@compute @workgroup_size(64)\nfn apply_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass <= 0.0) { return; }\n  ${applyStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const integratePass = `@compute @workgroup_size(64)\nfn integrate_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass <= 0.0) { return; }\n  sim_state_write(index, 0u, particle.position.x);\n  sim_state_write(index, 1u, particle.position.y);\n  particle.velocity += particle.acceleration * ${dtExpr};\n  particle.position += particle.velocity * ${dtExpr};\n  sim_state_write(index, 2u, particle.position.x);\n  sim_state_write(index, 3u, particle.position.y);\n  particle.acceleration = vec2<f32>(0.0, 0.0);\n  particles[index] = particle;\n}`;
  const constrainPass = `@compute @workgroup_size(64)\nfn constrain_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass <= 0.0) { return; }\n  ${constrainStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const correctPass = `@compute @workgroup_size(64)\nfn correct_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass <= 0.0) { return; }\n  \n  // Compute position variables from integration state\n  let prevPos = vec2<f32>(sim_state_read(index, 0u), sim_state_read(index, 1u));\n  let postPos = vec2<f32>(sim_state_read(index, 2u), sim_state_read(index, 3u));\n  \n  ${correctStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const mainPass = `@compute @workgroup_size(64)\nfn main(@builtin(global_invocation_id) _gid: vec3<u32>) {}`;

  const code = [
    PARTICLE_STRUCT,
    STORAGE_DECL,
    ...uniformDecls,
    ...gridDecls,
    ...globals,
    ...systemEntrypoints,
    ...moduleFns,
    statePass,
    applyPass,
    integratePass,
    constrainPass,
    correctPass,
    mainPass,
  ].join("\n\n");

  return {
    code,
    layouts,
    simStateStride: SIM_STATE_STRIDE_VAL,
    extraBindings: {
      grid: {
        countsBinding: gridCountsBinding,
        indicesBinding: gridIndicesBinding,
      },
      simState: { stateBinding: simStateBinding },
      sceneTexture: { textureBinding: sceneTextureBinding },
      arrays: Object.keys(arrayBindings).length > 0 ? arrayBindings : undefined,
    },
  };
}
