export type ComputeModuleRole = "simulation" | "force";

export interface ComputeModuleDescriptor<
  Name extends string,
  BindingKeys extends string
> {
  name: Name;
  role: ComputeModuleRole;
  bindings?: readonly BindingKeys[];
  state?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: BindingKeys) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: BindingKeys) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: BindingKeys) => string;
  }) => string;
}

export abstract class ComputeModule<
  Name extends string,
  BindingKeys extends string
> {
  private _writer: ((values: Partial<Record<string, number>>) => void) | null =
    null;
  private _reader: (() => Partial<Record<string, number>>) | null = null;

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    this._writer = writer;
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

  abstract descriptor(): ComputeModuleDescriptor<Name, BindingKeys>;
}

// Deprecated: previously supported mixing descriptors and modules
// Now we only support ComputeModule instances across the codebase.

export interface ModuleUniformLayout {
  moduleName: string;
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
  extraBindings: {
    grid?: { countsBinding: number; indicesBinding: number };
  };
}

function capitalize(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

// Note: all modules are instances of ComputeModule now

export function buildComputeProgram(
  modules: readonly ComputeModule<string, string>[]
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
}
`;

  const storageDecl = `@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;`;

  const sim = descriptors.find((m) => m.role === "simulation");
  if (!sim) {
    throw new Error("No simulation module provided");
  }

  const layouts: ModuleUniformLayout[] = [];
  const uniformDecls: string[] = [];

  descriptors.forEach((mod, idx) => {
    const bindingIndex = idx + 1; // 0 is particles
    const uniformsVar = `${mod.name}_uniforms`;
    const structName = `Uniforms_${capitalize(mod.name)}`;
    const ids =
      mod.role === "simulation"
        ? ["dt", "count", "minCorrection", "maxCorrection", "restThreshold"]
        : mod.bindings || [];
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
  const minCorrectionExpr = layouts.find((l) => l.moduleName === sim.name)!
    .mapping["minCorrection"].expr;
  const maxCorrectionExpr = layouts.find((l) => l.moduleName === sim.name)!
    .mapping["maxCorrection"].expr;
  const restThresholdExpr = layouts.find((l) => l.moduleName === sim.name)!
    .mapping["restThreshold"].expr;

  // Built-in spatial grid uniforms (available to all modules)
  const gridUniformsVar = `grid_uniforms`;
  const gridStructName = `Uniforms_Grid`;
  const gridIds = [
    "minX",
    "minY",
    "maxX",
    "maxY",
    "cols",
    "rows",
    "cellSize",
    "maxPerCell",
  ];
  const lastBeforeGrid = layouts.reduce(
    (max, l) => Math.max(max, l.bindingIndex),
    0
  );
  const gridFloatCount = gridIds.length;
  const gridVec4Count = Math.max(1, Math.ceil(gridFloatCount / 4));
  const gridSizeBytes = gridVec4Count * 16;
  const gridMapping: Record<string, { flatIndex: number; expr: string }> = {};
  gridIds.forEach((id: string, i: number) => {
    const vecIndex = Math.floor(i / 4);
    const compIndex = i % 4;
    const comp =
      compIndex === 0
        ? "x"
        : compIndex === 1
        ? "y"
        : compIndex === 2
        ? "z"
        : "w";
    const expr = `${gridUniformsVar}.v${vecIndex}.${comp}`;
    gridMapping[id] = { flatIndex: vecIndex * 4 + compIndex, expr };
  });
  const gridStructFields = Array.from(
    { length: gridVec4Count },
    (_, i2) => `  v${i2}: vec4<f32>,`
  ).join("\n");
  const gridStructWGSL = `struct ${gridStructName} {\n${gridStructFields}\n}`;
  const gridBindingIndex = lastBeforeGrid + 1;
  const gridVarDecl = `@group(0) @binding(${gridBindingIndex}) var<uniform> ${gridUniformsVar}: ${gridStructName};`;
  layouts.push({
    moduleName: "grid",
    bindingIndex: gridBindingIndex,
    uniformsVar: gridUniformsVar,
    structName: gridStructName,
    sizeBytes: gridSizeBytes,
    vec4Count: gridVec4Count,
    mapping: gridMapping,
  });
  uniformDecls.push(gridStructWGSL, gridVarDecl);

  // Grid storage buffers after all uniforms
  const lastUniformBinding = layouts.reduce(
    (max, l) => Math.max(max, l.bindingIndex),
    0
  );
  const gridCountsBinding = lastUniformBinding + 1;
  const gridIndicesBinding = lastUniformBinding + 2;

  const gridDecls: string[] = [
    `@group(0) @binding(${gridCountsBinding}) var<storage, read_write> GRID_COUNTS: array<atomic<u32>>;`,
    `@group(0) @binding(${gridIndicesBinding}) var<storage, read_write> GRID_INDICES: array<u32>;`,
  ];

  // Grid helpers and neighbor iteration
  const getGrid = (k: string) => gridMapping[k]?.expr ?? "0.0";
  const gridHelpers: string[] = [
    `const NEIGHBOR_NONE: u32 = 0xffffffffu;`,
    `fn GRID_COLS() -> u32 { return u32(${getGrid("cols")}); }`,
    `fn GRID_ROWS() -> u32 { return u32(${getGrid("rows")}); }`,
    `fn GRID_MINX() -> f32 { return ${getGrid("minX")}; }`,
    `fn GRID_MINY() -> f32 { return ${getGrid("minY")}; }`,
    `fn GRID_MAXX() -> f32 { return ${getGrid("maxX")}; }`,
    `fn GRID_MAXY() -> f32 { return ${getGrid("maxY")}; }`,
    `fn GRID_CELL_SIZE() -> f32 { return ${getGrid("cellSize")}; }`,
    `fn GRID_MAX_PER_CELL() -> u32 { return u32(${getGrid("maxPerCell")}); }`,
    `fn grid_cell_index(pos: vec2<f32>) -> u32 { let col = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let row = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let c = max(0, min(col, i32(GRID_COLS()) - 1)); let r = max(0, min(row, i32(GRID_ROWS()) - 1)); return u32(r) * GRID_COLS() + u32(c); }`,
    `fn grid_cell_index_from_rc(r: i32, c: i32) -> u32 { let rr = max(0, min(r, i32(GRID_ROWS()) - 1)); let cc = max(0, min(c, i32(GRID_COLS()) - 1)); return u32(rr) * GRID_COLS() + u32(cc); }`,
    `struct NeighborIter { cx: i32, cy: i32, r: i32, c: i32, k: u32, reach: i32, maxK: u32, base: u32 }`,
    `fn neighbor_iter_init(pos: vec2<f32>, radius: f32) -> NeighborIter { let cx = i32(floor((pos.x - GRID_MINX()) / GRID_CELL_SIZE())); let cy = i32(floor((pos.y - GRID_MINY()) / GRID_CELL_SIZE())); let reach = max(1, i32(ceil(radius / GRID_CELL_SIZE()))); var it: NeighborIter; it.cx = cx; it.cy = cy; it.reach = reach; it.r = cy - reach; it.c = cx - reach; let firstCell = grid_cell_index_from_rc(it.r, it.c); let cnt = atomicLoad(&GRID_COUNTS[firstCell]); it.maxK = min(cnt, GRID_MAX_PER_CELL()); it.base = firstCell * GRID_MAX_PER_CELL(); it.k = 0u; return it; }`,
    `fn neighbor_iter_next(it: ptr<function, NeighborIter>, selfIndex: u32) -> u32 { loop { if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } if ((*it).k < (*it).maxK) { let id = GRID_INDICES[(*it).base + (*it).k]; (*it).k = (*it).k + 1u; if (id != selfIndex) { return id; } else { continue; } } (*it).c = (*it).c + 1; if ((*it).c > (*it).cx + (*it).reach) { (*it).c = (*it).cx - (*it).reach; (*it).r = (*it).r + 1; } if ((*it).r > (*it).cy + (*it).reach) { return NEIGHBOR_NONE; } let cell = grid_cell_index_from_rc((*it).r, (*it).c); let cnt = atomicLoad(&GRID_COUNTS[cell]); (*it).maxK = min(cnt, GRID_MAX_PER_CELL()); (*it).base = cell * GRID_MAX_PER_CELL(); (*it).k = 0u; } }`,
  ];

  const stateStatements: string[] = [];
  const applyStatements: string[] = [];
  const constrainStatements: string[] = [];
  descriptors.forEach((mod) => {
    if (mod.role !== "force" || !mod.state) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const snippet = mod.state({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
    });
    if (snippet && snippet.trim().length) {
      stateStatements.push(snippet.trim());
    }
  });
  descriptors.forEach((mod) => {
    if (mod.role !== "force" || !mod.apply) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const snippet = mod.apply({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
    });
    if (snippet && snippet.trim().length) {
      applyStatements.push(snippet.trim());
    }
  });
  descriptors.forEach((mod) => {
    if (mod.role !== "force" || !mod.constrain) return;
    const layout = layouts.find((l) => l.moduleName === mod.name)!;
    const getUniform = (id: string) => layout.mapping[id]?.expr ?? "0.0";
    const snippet = mod.constrain({
      particleVar: "particle",
      dtVar: dtExpr,
      getUniform,
    });
    if (snippet && snippet.trim().length) {
      constrainStatements.push(snippet.trim());
    }
  });

  const gridPasses = `
@compute @workgroup_size(64)
fn grid_clear(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let total = GRID_COLS() * GRID_ROWS();
  if (idx < total) {
    atomicStore(&GRID_COUNTS[idx], 0u);
  }
}

@compute @workgroup_size(64)
fn grid_build(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let count = u32(${countExpr});
  if (i >= count) { return; }
  let p = particles[i];
  if (p.mass == 0.0) { return; }
  let cell = grid_cell_index(p.position);
  let offset = atomicAdd(&GRID_COUNTS[cell], 1u);
  if (offset < GRID_MAX_PER_CELL()) {
    let base = cell * GRID_MAX_PER_CELL();
    GRID_INDICES[base + offset] = i;
  }
}`;

  const mainFn = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }

  var particle = particles[index];
  if (particle.mass == 0.0) { return; }

  // State stage
  ${stateStatements.join("\n\n  ")}

  // Apply stage
  ${applyStatements.join("\n\n  ")}

  // Integrate position using delta time
  // Apply acceleration to velocity, then velocity to position
  let prevPos = particle.position;
  particle.velocity += particle.acceleration * ${dtExpr};
  particle.position += particle.velocity * ${dtExpr};
  let posAfterIntegration = particle.position;

  // Constrain stage
  ${constrainStatements.join("\n\n  ")}

  // Correct velocity using post-constraint displacement if constraints changed position
  let disp = particle.position - prevPos;
  let disp2 = dot(disp, disp);
  let corr = particle.position - posAfterIntegration;
  let corr2 = dot(corr, corr);
  let minCorrection = ${minCorrectionExpr};
  let minCorrection2 = minCorrection * minCorrection;
  if (corr2 > minCorrection2 && ${dtExpr} > 0.0) {
    // Apply only the correction component along the correction direction
    let corrLenInv = inverseSqrt(corr2);
    let corrDir = corr * corrLenInv;
    let corrVel = corr / ${dtExpr};
    let corrVelAlong = dot(corrVel, corrDir);
    // Clamp only the along-axis correction to avoid explosions
    let maxCorr = ${maxCorrectionExpr};
    let corrVelAlongClamped = clamp(corrVelAlong, -maxCorr, maxCorr);
    // Only allow correction to reduce the magnitude of the normal component, not increase it
    let vNBefore = dot(particle.velocity, corrDir);
    let vNAfterCandidate = vNBefore + corrVelAlongClamped;
    let vNAfter = select(vNBefore, vNAfterCandidate, abs(vNAfterCandidate) < abs(vNBefore));
    particle.velocity = particle.velocity + corrDir * (vNAfter - vNBefore);

    // If normal velocity is very small after correction, zero it to let particles rest
    let vN = dot(particle.velocity, corrDir);
    let restThreshold = ${restThresholdExpr};
    if (abs(vN) < restThreshold) {
      particle.velocity = particle.velocity - vN * corrDir;
    }
  }
  // If net displacement is tiny and velocity is tiny, zero out to rest
  let v2_total = dot(particle.velocity, particle.velocity);
  if (disp2 < 1e-8 && v2_total < 0.5) {
    particle.velocity = vec2<f32>(0.0, 0.0);
  }

  // Reset acceleration to zero for next frame
  particle.acceleration = vec2<f32>(0.0, 0.0);
  particles[index] = particle;
}`;

  const code = [
    particleStruct,
    storageDecl,
    ...uniformDecls,
    ...gridDecls,
    ...gridHelpers,
    gridPasses,
    mainFn,
  ]
    .filter((s) => s && s.length)
    .join("\n\n");
  return {
    code,
    layouts,
    extraBindings: {
      grid: {
        countsBinding: gridCountsBinding,
        indicesBinding: gridIndicesBinding,
      },
    },
  };
}
