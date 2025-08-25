export type ComputeModuleRole = "simulation" | "force";

export interface ComputeModuleDescriptor<
  Name extends string,
  BindingKeys extends string
> {
  name: Name;
  role: ComputeModuleRole;
  bindings?: readonly BindingKeys[];
  apply?: (args: {
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

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    this._writer = writer;
  }

  protected write(values: Partial<Record<BindingKeys, number>>): void {
    // Binding keys are narrowed by the generic; cast to the writer's accepted shape
    this._writer?.(values as unknown as Partial<Record<string, number>>);
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
      mod.role === "simulation" ? ["dt", "count"] : mod.bindings || [];
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

  const forceStatements: string[] = [];
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
      forceStatements.push(snippet.trim());
    }
  });

  const mainFn = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(${countExpr});
  if (index >= count) { return; }

  var particle = particles[index];

  ${forceStatements.join("\n\n  ")}

  // Integrate position using delta time
  particle.position += particle.velocity * ${dtExpr};
  particles[index] = particle;
}`;

  const code = [particleStruct, storageDecl, ...uniformDecls, mainFn].join(
    "\n\n"
  );
  return { code, layouts };
}
