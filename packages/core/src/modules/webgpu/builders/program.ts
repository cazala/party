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
  type WebGPUDescriptor,
} from "../module-descriptors";

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
  };
}

export function buildProgram(
  modules: readonly Module<string, string, any>[]
): Program {
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
  pushUniformLayout("simulation", ["dt", "count", "simStride"] as const, 1);
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
  descriptors.forEach((mod, idx) => {
    const bindingIndex = idx + 3;
    const uniformsVar = `${mod.name}_uniforms`;
    const structName = `Uniforms_${cap(mod.name)}`;
    const ids = [...(mod.keys || []), "enabled"] as string[];
    const vec4Count = Math.max(1, Math.ceil(ids.length / 4));
    const mapping: Record<string, { flatIndex: number; expr: string }> = {};
    ids.forEach((id, i) => {
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
      moduleName: mod.name,
      moduleRole: mod.role as ModuleRole,
      bindingIndex,
      uniformsVar,
      structName,
      sizeBytes: vec4Count * 16,
      vec4Count,
      mapping,
    });
    uniformDecls.push(structWGSL, varDecl);
  });

  const dtExpr = layouts.find((l) => l.moduleName === "simulation")!.mapping.dt
    .expr;
  const countExpr = layouts.find((l) => l.moduleName === "simulation")!.mapping
    .count.expr;

  const baseState = ["prevX", "prevY", "posIntX", "posIntY"] as const;
  const stateSlots: Record<string, number> = {};
  baseState.forEach((k, i) => (stateSlots[k] = i));
  let nextSlot = baseState.length;
  const localSlots: Record<string, Record<string, number>> = {};
  descriptors.forEach((mod) => {
    localSlots[mod.name] = {};
    if (mod.role === ModuleRole.Force && (mod as any).states) {
      ((mod as any).states as readonly string[]).forEach((field) => {
        const key = `${mod.name}.${field}`;
        if (stateSlots[key] === undefined) stateSlots[key] = nextSlot++;
        localSlots[mod.name][field] = stateSlots[key];
      });
    }
  });
  const SIM_STATE_STRIDE_VAL = nextSlot;

  const lastUB = layouts.reduce((m, l) => Math.max(m, l.bindingIndex), 0);
  const gridCountsBinding = lastUB + 1;
  const gridIndicesBinding = lastUB + 2;
  const simStateBinding = lastUB + 3;
  const sceneTextureBinding = lastUB + 4;
  const gridDecls = [
    `@group(0) @binding(${gridCountsBinding}) var<storage, read_write> GRID_COUNTS: array<atomic<u32>>;`,
    `@group(0) @binding(${gridIndicesBinding}) var<storage, read_write> GRID_INDICES: array<u32>;`,
    `@group(0) @binding(${simStateBinding}) var<storage, read_write> SIM_STATE: array<f32>;`,
    `@group(0) @binding(${sceneTextureBinding}) var scene_texture: texture_2d<f32>;`,
  ];

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
  const addGlobal = (mod: WebGPUDescriptor) => {
    if (mod.role !== ModuleRole.Force) return;
    const g = (mod as any).global as
      | undefined
      | ((a: { getUniform: (id: string) => string }) => string);
    if (!g) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const code = g({ getUniform });
    if (code && code.trim()) {
      globals.push(`// Global for ${mod.name}`);
      globals.push(code.trim());
    }
  };
  descriptors
    .filter((d) => d.role === ModuleRole.Force)
    .forEach((m) => addGlobal(m as any));

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

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !(mod as any).state) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const { set } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = mod.state?.({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      setState: set,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("state", mod.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      stateStmts.push(`if (${enabled} != 0.0) { ${name}(&particle, index); }`);
    }
  });

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !(mod as any).apply) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const { get } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = mod.apply?.({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState: get,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("apply", mod.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      applyStmts.push(`if (${enabled} != 0.0) { ${name}(&particle, index); }`);
    }
  });

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !(mod as any).constrain) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const { get } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = mod.constrain?.({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState: get,
    });
    if (body && body.trim()) {
      const enabled = layout.mapping.enabled.expr;
      const name = fn("constrain", mod.name);
      moduleFns.push(
        `fn ${name}(particle: ptr<function, Particle>, index: u32) {\n  ${body.trim()}\n}`
      );
      constrainStmts.push(
        `if (${enabled} != 0.0) { ${name}(&particle, index); }`
      );
    }
  });

  const statePass = `@compute @workgroup_size(64)\nfn state_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass == 0.0) { return; }\n  ${stateStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const applyPass = `@compute @workgroup_size(64)\nfn apply_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass == 0.0) { return; }\n  ${applyStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const integratePass = `@compute @workgroup_size(64)\nfn integrate_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass == 0.0) { return; }\n  sim_state_write(index, 0u, particle.position.x);\n  sim_state_write(index, 1u, particle.position.y);\n  particle.velocity += particle.acceleration * ${dtExpr};\n  particle.position += particle.velocity * ${dtExpr};\n  sim_state_write(index, 2u, particle.position.x);\n  sim_state_write(index, 3u, particle.position.y);\n  particle.acceleration = vec2<f32>(0.0, 0.0);\n  particles[index] = particle;\n}`;
  const constrainPass = `@compute @workgroup_size(64)\nfn constrain_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass == 0.0) { return; }\n  ${constrainStmts.join(
    "\n  "
  )}\n  particles[index] = particle;\n}`;
  const correctPass = `@compute @workgroup_size(64)\nfn correct_pass(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let index = gid.x;\n  let count = u32(${countExpr});\n  if (index >= count) { return; }\n  var particle = particles[index];\n  if (particle.mass == 0.0) { return; }\n  let prevPos = vec2<f32>(sim_state_read(index, 0u), sim_state_read(index, 1u));\n  let posAfterIntegration = vec2<f32>(sim_state_read(index, 2u), sim_state_read(index, 3u));\n  let disp = particle.position - prevPos;\n  let disp2 = dot(disp, disp);\n  let corr = particle.position - posAfterIntegration;\n  let corr2 = dot(corr, corr);\n  if (corr2 > 0.0 && ${dtExpr} > 0.0) {\n    let corrLenInv = inverseSqrt(corr2);\n    let corrDir = corr * corrLenInv;\n    let corrVel = corr / ${dtExpr};\n    let corrVelAlong = dot(corrVel, corrDir);\n    let vNBefore = dot(particle.velocity, corrDir);\n    let vNAfterCandidate = vNBefore + corrVelAlong;\n    let vNAfter = select(vNBefore, vNAfterCandidate, abs(vNAfterCandidate) < abs(vNBefore));\n    particle.velocity = particle.velocity + corrDir * (vNAfter - vNBefore);\n  }\n  let v2_total = dot(particle.velocity, particle.velocity);\n  if (disp2 < 1e-8 && v2_total < 0.5) {\n    particle.velocity = vec2<f32>(0.0, 0.0);\n  }\n  particles[index] = particle;\n}`;
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
    },
  };
}
