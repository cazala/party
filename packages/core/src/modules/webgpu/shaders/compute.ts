export enum ModuleRole {
  Force = "force",
  System = "system",
  Render = "render",
}

// ---------------------------------------------------------------------------
// Role-based descriptor types (forward-compatible, optional for existing modules)
// ---------------------------------------------------------------------------

export interface BaseModuleDescriptor<Name extends string = string> {
  name: Name;
  role: ModuleRole;
  bindings?: readonly string[];
}

export interface SystemModuleDescriptor<Name extends string = string>
  extends BaseModuleDescriptor<Name> {
  role: ModuleRole.System; // support alias
  global?: (args: { getUniform: (id: string) => string }) => string;
  entrypoints?: () => string;
}

export interface ForceModuleDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = string
> extends BaseModuleDescriptor<Name> {
  role: ModuleRole.Force;
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: Keys) => string }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
  }) => string;
}

export enum RenderPassKind {
  Fullscreen = "fullscreen",
  Compute = "compute",
}

export type FullscreenRenderPass<Keys extends string = string> = {
  kind: RenderPassKind.Fullscreen;
  vertex?: (args: {
    getUniform: (id: Keys | "canvasWidth" | "canvasHeight") => string;
  }) => string;
  globals?: (args: { getUniform: (id: Keys) => string }) => string;
  fragment: (args: {
    getUniform: (
      id:
        | Keys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    sampleScene: (uvExpr: string) => string;
  }) => string;
  bindings: readonly Keys[];
  readsScene?: boolean;
  writesScene?: true;
  instanced?: boolean;
};

export type ComputeRenderPass<Keys extends string = string> = {
  kind: RenderPassKind.Compute;
  kernel: (args: {
    getUniform: (
      id:
        | Keys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    readScene: (coordsExpr: string) => string;
    writeScene: (coordsExpr: string, colorExpr: string) => string;
  }) => string;
  bindings: readonly Keys[];
  readsScene?: boolean;
  writesScene?: true;
  workgroupSize?: [number, number, number];
  globals?: (args: { getUniform: (id: Keys) => string }) => string;
};

export type RenderPass<Keys extends string = string> =
  | FullscreenRenderPass<Keys>
  | ComputeRenderPass<Keys>;

export interface RenderModuleDescriptor<
  Name extends string = string,
  Keys extends string = string
> extends BaseModuleDescriptor<Name> {
  role: ModuleRole.Render;
  passes: Array<RenderPass<Keys>>;
}

export type ModuleDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = never
> =
  | SystemModuleDescriptor<Name>
  | ForceModuleDescriptor<Name, Keys, StateKeys>
  | RenderModuleDescriptor<Name, Keys>;

type BindingKeysBase = "enabled" | string;

export abstract class Module<
  Name extends string,
  BindingKeys extends BindingKeysBase,
  StateKeys extends string = never
> {
  private _writer: ((values: Partial<Record<string, number>>) => void) | null =
    null;
  private _reader: (() => Partial<Record<string, number>>) | null = null;
  private _enabled: boolean = true;

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    this._writer = writer;
    writer({ enabled: this._enabled ? 1 : 0 });
  }

  attachUniformReader(reader: () => Partial<Record<string, number>>): void {
    this._reader = reader;
  }

  protected write(values: Partial<Record<BindingKeys, number>>): void {
    // Binding keys are narrowed by the generic; cast to the writer's accepted shape
    this._writer?.(values as unknown as Partial<Record<string, number>>);
  }

  protected read(): Partial<Record<BindingKeys, number>> {
    const vals = this._reader?.() as unknown as Partial<
      Record<BindingKeys, number>
    >;
    return vals || {};
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = !!enabled;
    // Propagate to GPU uniform if available
    if (this._writer) {
      this._writer({ enabled: this._enabled ? 1 : 0 });
    }
  }

  abstract descriptor(): ModuleDescriptor<Name, BindingKeys, StateKeys>;
}

// Deprecated: previously supported mixing descriptors and modules
// Now we only support ComputeModule instances across the codebase.

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

export interface ComputeProgramBuild {
  code: string;
  layouts: ModuleUniformLayout[];
  simStateStride: number;
  extraBindings: {
    grid?: { countsBinding: number; indicesBinding: number };
    simState?: { stateBinding: number };
    // Renamed from trailTexture -> sceneTexture to reflect broader use
    sceneTexture?: { textureBinding: number };
  };
}

function capitalize(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

// Note: all modules are instances of ComputeModule now

export function buildComputeProgram(
  modules: readonly Module<string, string, any>[]
): ComputeProgramBuild {
  // Normalize to descriptors (all are modules now)
  const descriptors = modules.map((m) => m.descriptor());
  const particleStruct = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
}
`;

  const storageDecl = `@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;`;

  const sim = descriptors.find((m) => m.name === "simulation");
  if (!sim) {
    throw new Error("No simulation module provided");
  }

  const layouts: ModuleUniformLayout[] = [];
  const uniformDecls: string[] = [];

  descriptors.forEach((mod, idx) => {
    const bindingIndex = idx + 1; // 0 is particles
    const uniformsVar = `${mod.name}_uniforms`;
    const structName = `Uniforms_${capitalize(mod.name)}`;
    const ids = [...(mod.bindings || []), "enabled"] as string[];
    const floatCount = ids.length;
    const vec4Count = Math.max(1, Math.ceil(floatCount / 4));
    const sizeBytes = vec4Count * 16;

    const mapping: Record<string, { flatIndex: number; expr: string }> = {};
    ids.forEach((id: string, i: number) => {
      const vecIndex = Math.floor(i / 4);
      const compIndex = i % 4; // 0:x,1:y,2:z,3:w
      const comp =
        compIndex === 0
          ? "x"
          : compIndex === 1
          ? "y"
          : compIndex === 2
          ? "z"
          : "w";
      const expr = `${uniformsVar}.v${vecIndex}.${comp}`;
      mapping[id] = { flatIndex: vecIndex * 4 + compIndex, expr };
    });

    const structFields = Array.from(
      { length: vec4Count },
      (_, i2) => `  v${i2}: vec4<f32>,`
    ).join("\n");
    const structWGSL = `struct ${structName} {\n${structFields}\n}`;
    const varDecl = `@group(0) @binding(${bindingIndex}) var<uniform> ${uniformsVar}: ${structName};`;

    layouts.push({
      moduleName: mod.name,
      moduleRole: mod.role,
      bindingIndex,
      uniformsVar,
      structName,
      sizeBytes,
      vec4Count,
      mapping,
    });
    uniformDecls.push(structWGSL, varDecl);
  });

  const dtExpr = layouts.find((l) => l.moduleName === sim.name)!.mapping["dt"]
    .expr;
  const countExpr = layouts.find((l) => l.moduleName === sim.name)!.mapping[
    "count"
  ].expr;
  // SIM_STATE dynamic layout: system fields + module-declared fields
  const systemStateFields = ["prevX", "prevY", "posIntX", "posIntY"] as const;
  const stateSlots: Record<string, number> = {};
  systemStateFields.forEach((f, i) => (stateSlots[f] = i));
  let nextStateSlot = systemStateFields.length;
  const moduleLocalSlot: Record<string, Record<string, number>> = {};
  descriptors.forEach((mod) => {
    moduleLocalSlot[mod.name] = {};
    if (
      mod.role === ModuleRole.Force &&
      (mod as ForceModuleDescriptor).states
    ) {
      ((mod as ForceModuleDescriptor).states as readonly string[]).forEach(
        (field: string) => {
          const globalKey = `${mod.name}.${field}`;
          if (stateSlots[globalKey] === undefined) {
            stateSlots[globalKey] = nextStateSlot++;
          }
          moduleLocalSlot[mod.name][field] = stateSlots[globalKey];
        }
      );
    }
  });
  const SIM_STATE_STRIDE_VAL = nextStateSlot;

  // Note: Grid is provided by a system module (name "grid"). Its uniforms are
  // generated above like any other module based on its descriptor.bindings.

  // Grid storage buffers and additional resources after all uniforms
  const lastUniformBinding = layouts.reduce(
    (max, l) => Math.max(max, l.bindingIndex),
    0
  );
  const gridCountsBinding = lastUniformBinding + 1;
  const gridIndicesBinding = lastUniformBinding + 2;
  const simStateBinding = lastUniformBinding + 3;
  const sceneTextureBinding = lastUniformBinding + 4;

  const gridDecls: string[] = [
    `@group(0) @binding(${gridCountsBinding}) var<storage, read_write> GRID_COUNTS: array<atomic<u32>>;`,
    `@group(0) @binding(${gridIndicesBinding}) var<storage, read_write> GRID_INDICES: array<u32>;`,
    `@group(0) @binding(${simStateBinding}) var<storage, read_write> SIM_STATE: array<f32>;`,
    `@group(0) @binding(${sceneTextureBinding}) var scene_texture: texture_2d<f32>;`,
  ];

  // Grid helpers and neighbor iteration are provided by the Grid system module.

  // Collect global functions from modules (system first to allow helpers like GRID_MINX to be used by others)
  const globalFunctions: string[] = [];
  const pushGlobal = (mod: ModuleDescriptor) => {
    if (mod.role === ModuleRole.Render) return;
    const maybeGlobal = (mod as any).global as
      | ((args: { getUniform: (id: string) => string }) => string)
      | undefined;
    if (!maybeGlobal) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const globalCode = maybeGlobal({ getUniform });
    if (globalCode && globalCode.trim().length > 0) {
      globalFunctions.push(`// Global functions for ${mod.name} module`);
      globalFunctions.push(globalCode.trim());
    }
  };
  // System module globals first
  descriptors
    .filter((m) => m.role === ModuleRole.System)
    .forEach((m) => pushGlobal(m as any));
  // Then the rest (skip render)
  descriptors
    .filter((m) => m.role !== ModuleRole.System && m.role !== ModuleRole.Render)
    .forEach((m) => pushGlobal(m as any));

  // Collect system entrypoints from system modules via entrypoints()
  const systemEntrypoints: string[] = [];
  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.System) return;
    const entryFn = (mod as any).entrypoints;
    const snippet = typeof entryFn === "function" ? entryFn() : "";
    if (snippet && snippet.trim().length) {
      systemEntrypoints.push(
        `// System entrypoints for ${mod.name}\n${snippet.trim()}`
      );
    }
  });

  // Generate module functions and collect function calls
  const moduleFunctions: string[] = [];
  const stateStatements: string[] = [];
  const applyStatements: string[] = [];
  const constrainStatements: string[] = [];

  // Helper function to create module function name
  const getModuleFunctionName = (passType: string, moduleName: string) =>
    `${passType}_${moduleName}`;

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !mod.state) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const getState = (name: string, pidVar: string = "index") => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "0.0";
      return `sim_state_read(u32(${pidVar}), ${slot}u)`;
    };
    const setState = (
      name: string,
      valueExpr: string,
      pidVar: string = "index"
    ) => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "";
      return `sim_state_write(u32(${pidVar}), ${slot}u, ${valueExpr})`;
    };
    const snippet = mod.state({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState,
      setState,
    });
    if (snippet && snippet.trim().length) {
      const enabledExpr = layout.mapping["enabled"].expr;
      const functionName = getModuleFunctionName("state", mod.name);

      // Generate module function
      moduleFunctions.push(`
fn ${functionName}(particle: ptr<function, Particle>, index: u32) {
  ${snippet.trim()}
}`);

      // Add function call to statements
      stateStatements.push(
        `if (${enabledExpr} != 0.0) { ${functionName}(&particle, index); }`
      );
    }
  });

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !mod.apply) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const getState = (name: string, pidVar: string = "index") => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "0.0";
      return `sim_state_read(u32(${pidVar}), ${slot}u)`;
    };
    const setState = (
      name: string,
      valueExpr: string,
      pidVar: string = "index"
    ) => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "";
      return `sim_state_write(u32(${pidVar}), ${slot}u, ${valueExpr})`;
    };
    const snippet = mod.apply({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState,
      setState,
    });
    if (snippet && snippet.trim().length) {
      const enabledExpr = layout.mapping["enabled"].expr;
      const functionName = getModuleFunctionName("apply", mod.name);

      // Generate module function
      moduleFunctions.push(`
fn ${functionName}(particle: ptr<function, Particle>, index: u32) {
  ${snippet.trim()}
}`);

      // Add function call to statements
      applyStatements.push(
        `if (${enabledExpr} != 0.0) { ${functionName}(&particle, index); }`
      );
    }
  });

  descriptors.forEach((mod) => {
    if (mod.role !== ModuleRole.Force || !mod.constrain) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const getState = (name: string, pidVar: string = "index") => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "0.0";
      return `sim_state_read(u32(${pidVar}), ${slot}u)`;
    };
    const setState = (
      name: string,
      valueExpr: string,
      pidVar: string = "index"
    ) => {
      const slot =
        stateSlots[name] !== undefined
          ? stateSlots[name]
          : moduleLocalSlot[mod.name]?.[name];
      if (slot === undefined) return "";
      return `sim_state_write(u32(${pidVar}), ${slot}u, ${valueExpr})`;
    };
    const snippet = mod.constrain({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
      getState,
      setState,
    });
    if (snippet && snippet.trim().length) {
      const enabledExpr = layout.mapping["enabled"].expr;
      const functionName = getModuleFunctionName("constrain", mod.name);

      // Generate module function
      moduleFunctions.push(`
fn ${functionName}(particle: ptr<function, Particle>, index: u32) {
  ${snippet.trim()}
}`);

      // Add function call to statements
      constrainStatements.push(
        `if (${enabledExpr} != 0.0) { ${functionName}(&particle, index); }`
      );
    }
  });

  // Grid passes are now contributed by system modules

  // Simulation module will expose SIM_STATE helpers via global(); no builder injection needed
  const stateHelpers = ``;

  const statePass = `
@compute @workgroup_size(64)
fn state_pass(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }

  var particle = particles[index];
  if (particle.mass == 0.0) { return; }

  {
  ${stateStatements.join("\n\n  ")}
  }
  particles[index] = particle;
}`;

  const applyPass = `
@compute @workgroup_size(64)
fn apply_pass(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }
  var particle = particles[index];
  if (particle.mass == 0.0) { return; }
  {
  ${applyStatements.join("\n\n  ")}
  }
  particles[index] = particle;
}`;

  const integratePass = `
@compute @workgroup_size(64)
fn integrate_pass(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }
  var particle = particles[index];
  if (particle.mass == 0.0) { return; }
  sim_state_write(index, ${stateSlots["prevX"]}u, particle.position.x);
  sim_state_write(index, ${stateSlots["prevY"]}u, particle.position.y);
  particle.velocity += particle.acceleration * ${dtExpr};
  particle.position += particle.velocity * ${dtExpr};
  sim_state_write(index, ${stateSlots["posIntX"]}u, particle.position.x);
  sim_state_write(index, ${stateSlots["posIntY"]}u, particle.position.y);
  particle.acceleration = vec2<f32>(0.0, 0.0);
  particles[index] = particle;
}`;

  const constrainPass = `
@compute @workgroup_size(64)
fn constrain_pass(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }
  var particle = particles[index];
  if (particle.mass == 0.0) { return; }
  {
  ${constrainStatements.join("\n\n  ")}
  }
  particles[index] = particle;
}`;

  const correctPass = `
@compute @workgroup_size(64)
fn correct_pass(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }
  var particle = particles[index];
  if (particle.mass == 0.0) { return; }
  let prevPos = vec2<f32>(sim_state_read(index, ${stateSlots["prevX"]}u), sim_state_read(index, ${stateSlots["prevY"]}u));
  let posAfterIntegration = vec2<f32>(sim_state_read(index, ${stateSlots["posIntX"]}u), sim_state_read(index, ${stateSlots["posIntY"]}u));
  let disp = particle.position - prevPos;
  let disp2 = dot(disp, disp);
  let corr = particle.position - posAfterIntegration;
  let corr2 = dot(corr, corr);
  if (corr2 > 0.0 && ${dtExpr} > 0.0) {
    let corrLenInv = inverseSqrt(corr2);
    let corrDir = corr * corrLenInv;
    let corrVel = corr / ${dtExpr};
    let corrVelAlong = dot(corrVel, corrDir);
    let vNBefore = dot(particle.velocity, corrDir);
    let vNAfterCandidate = vNBefore + corrVelAlong;
    let vNAfter = select(vNBefore, vNAfterCandidate, abs(vNAfterCandidate) < abs(vNBefore));
    particle.velocity = particle.velocity + corrDir * (vNAfter - vNBefore);
  }
  let v2_total = dot(particle.velocity, particle.velocity);
  if (disp2 < 1e-8 && v2_total < 0.5) {
    particle.velocity = vec2<f32>(0.0, 0.0);
  }
  particles[index] = particle;
}`;

  // Provide a no-op main entry to satisfy monolithic pipeline when present
  const mainPass = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) _gid: vec3<u32>) {
  // no-op
}`;

  const code = [
    particleStruct,
    storageDecl,
    ...uniformDecls,
    ...gridDecls,
    ...globalFunctions,
    ...systemEntrypoints,
    ...moduleFunctions,
    stateHelpers,
    statePass,
    applyPass,
    integratePass,
    // Only declare grid passes once; system can dispatch them multiple times
    constrainPass,
    correctPass,
    mainPass,
  ]
    .filter((s) => s && s.length)
    .join("\n\n");
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
