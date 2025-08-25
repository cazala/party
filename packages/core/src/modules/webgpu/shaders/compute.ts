export type ComputeModuleRole = "simulation" | "force";

export interface ComputeModuleDescriptor {
  name: string; // e.g., "gravity", "simulation"
  role: ComputeModuleRole;
  bindings?: string[]; // e.g., ["strength", "dirX", "dirY"] for force modules
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: string) => string;
  }) => string; // force effect body snippet
}

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

export function buildComputeProgram(
  modules: ComputeModuleDescriptor[]
): ComputeProgramBuild {
  const particleStruct = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}
`;

  const storageDecl = `@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;`;

  const sim = modules.find((m) => m.role === "simulation");
  if (!sim) {
    throw new Error("No simulation module provided");
  }

  const layouts: ModuleUniformLayout[] = [];
  const uniformDecls: string[] = [];

  modules.forEach((mod, idx) => {
    const bindingIndex = idx + 1; // 0 is particles
    const uniformsVar = `${mod.name}_uniforms`;
    const structName = `Uniforms_${capitalize(mod.name)}`;
    const ids =
      mod.role === "simulation" ? ["dt", "count"] : mod.bindings || [];
    const floatCount = ids.length;
    const vec4Count = Math.max(1, Math.ceil(floatCount / 4));
    const sizeBytes = vec4Count * 16;

    const mapping: Record<string, { flatIndex: number; expr: string }> = {};
    ids.forEach((id, i) => {
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
  modules.forEach((mod) => {
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
