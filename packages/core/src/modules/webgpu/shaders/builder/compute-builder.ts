import { Module } from "../compute";
import { ModuleRole } from "../descriptors";
import type { ModuleDescriptor } from "../descriptors";

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
  const descriptors = modules.map((m) => m.descriptor());
  const sim = descriptors.find((m) => m.name === "simulation");
  if (!sim) throw new Error("No simulation module provided");

  const layouts: ModuleUniformLayout[] = [];
  const uniformDecls: string[] = [];
  descriptors.forEach((mod, idx) => {
    const bindingIndex = idx + 1;
    const uniformsVar = `${mod.name}_uniforms`;
    const structName = `Uniforms_${cap(mod.name)}`;
    const ids = [...(mod.bindings || []), "enabled"] as string[];
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

  const dtExpr = layouts.find((l) => l.moduleName === sim.name)!.mapping.dt
    .expr;
  const countExpr = layouts.find((l) => l.moduleName === sim.name)!.mapping
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
  const addGlobal = (mod: ModuleDescriptor) => {
    if (mod.role === ModuleRole.Render) return;
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
    .filter((d) => d.role === ModuleRole.System)
    .forEach((m) => addGlobal(m as any));
  descriptors
    .filter((d) => d.role !== ModuleRole.System && d.role !== ModuleRole.Render)
    .forEach((m) => addGlobal(m as any));

  const systemEntrypoints: string[] = [];
  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.System) return;
    const f = (mod as any).entrypoints;
    const s = typeof f === "function" ? f() : "";
    if (s && s.trim())
      systemEntrypoints.push(
        `// System entrypoints for ${mod.name}\n${s.trim()}`
      );
  });

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
    const { get, set } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = (mod as any).state({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState: get,
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
    const { get, set } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = (mod as any).apply({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState: get,
      setState: set,
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
    const { get, set } = makeGetSet(mod.name);
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const body = (mod as any).constrain({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState: get,
      setState: set,
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
