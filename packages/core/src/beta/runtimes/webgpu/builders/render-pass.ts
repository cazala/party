/**
 * Render Pass Builder
 *
 * Translates `RenderModuleDescriptor` passes into standalone WGSL programs:
 * - Fullscreen (raster) pass: draws a screen-aligned quad; optionally instanced per particle
 * - Compute image pass: reads from an input scene texture and writes to an output scene texture
 *
 * Provides helpers to resolve module uniforms (`getUniform`), sample/read/write scene
 * textures, and injects default vertex logic for instanced vs non-instanced fullscreen draws.
 */
import type { FullscreenRenderPass, ComputeRenderPass } from "../../../module";
import { DataType } from "../../../module";
import { ModuleUniformLayout } from "./program";

// --- Internal helpers to reduce duplication ---
function buildModuleUniformStruct(
  moduleName: string,
  layout: ModuleUniformLayout
): string {
  const vec4Count = layout.vec4Count;
  const structFields = Array.from(
    { length: vec4Count },
    (_, k) => `  v${k}: vec4<f32>,`
  ).join("\n");
  return `struct Uniforms_${moduleName} {\n${structFields}\n}`;
}

function makeGetUniformExpr(
  layout: ModuleUniformLayout,
  moduleName: string,
  moduleInputs: Record<string, DataType>
): (id: string, index?: number | string) => string {
  return (id: string, index?: number | string) => {
    const mapping = layout.mapping[id];
    if (!mapping) return "0.0";

    // Replace the uniform variable name for render passes
    const expr = mapping.expr.replace(
      `${moduleName}_uniforms`,
      `module_uniforms`
    );

    // Check if this is an array input
    if (moduleInputs[id] === DataType.ARRAY) {
      if (index !== undefined) {
        return `${expr}[${index}]`;
      } else {
        // Return the array variable name itself for direct access
        return expr;
      }
    } else {
      // Regular number input
      return expr;
    }
  };
}

function makeGetLengthExpr(
  layout: ModuleUniformLayout,
  moduleName: string,
  moduleInputs: Record<string, DataType>
): (id: string) => string {
  return (id: string) => {
    if (moduleInputs[id] === DataType.ARRAY) {
      const lengthMapping = layout.mapping[`${id}_length`];
      if (lengthMapping) {
        const expr = lengthMapping.expr.replace(
          `${moduleName}_uniforms`,
          `module_uniforms`
        );
        return `u32(${expr})`;
      }
    }
    return "0u";
  };
}

function getUniformForFullscreen(
  lookupExpr: (id: string, index?: number | string) => string,
  clearColor: { r: number; g: number; b: number; a: number }
): (id: string, index?: number | string) => string {
  const toFloatLiteral = (n: number) =>
    Number.isInteger(n) ? `${n}.0` : `${n}`;
  const cr = toFloatLiteral(clearColor.r);
  const cg = toFloatLiteral(clearColor.g);
  const cb = toFloatLiteral(clearColor.b);
  return (id: string, index?: number | string) =>
    id === "canvasWidth"
      ? "render_uniforms.canvas_size.x"
      : id === "canvasHeight"
      ? "render_uniforms.canvas_size.y"
      : id === "clearColorR"
      ? cr
      : id === "clearColorG"
      ? cg
      : id === "clearColorB"
      ? cb
      : lookupExpr(id, index);
}

function getUniformForCompute(
  lookupExpr: (id: string) => string,
  clearColor: { r: number; g: number; b: number; a: number }
): (id: string) => string {
  const toFloatLiteral = (n: number) =>
    Number.isInteger(n) ? `${n}.0` : `${n}`;
  const cr = toFloatLiteral(clearColor.r);
  const cg = toFloatLiteral(clearColor.g);
  const cb = toFloatLiteral(clearColor.b);
  return (id: string) =>
    id === "canvasWidth"
      ? "f32(textureDimensions(input_texture).x)"
      : id === "canvasHeight"
      ? "f32(textureDimensions(input_texture).y)"
      : id === "clearColorR"
      ? cr
      : id === "clearColorG"
      ? cg
      : id === "clearColorB"
      ? cb
      : lookupExpr(id);
}

function moduleUniformBindingDecl(
  moduleName: string,
  bindingIndex: number
): string {
  return `@group(0) @binding(${bindingIndex}) var<uniform> module_uniforms: Uniforms_${moduleName};`;
}

export function buildFullscreenPassWGSL<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
>(
  pass: FullscreenRenderPass<Inputs>,
  moduleName: string,
  layout: ModuleUniformLayout,
  moduleInputs: Record<string, DataType>,
  clearColor: { r: number; g: number; b: number; a: number }
): string {
  // build WGSL
  const struct = buildModuleUniformStruct(moduleName, layout);
  const uniformExpr = makeGetUniformExpr(layout, moduleName, moduleInputs);
  const lengthExpr = makeGetLengthExpr(layout, moduleName, moduleInputs);

  const instanced = pass.instanced ?? true;

  const fragment = pass.fragment({
    getUniform: getUniformForFullscreen(uniformExpr, clearColor) as any,
    getLength: lengthExpr as any,
    sampleScene: (uvExpr: string) =>
      `textureSampleLevel(scene_texture, scene_sampler, ${uvExpr}, 0.0)`,
  });

  // Vertex hook and defaults
  const vertexBodyHook = pass.vertex
    ? pass.vertex({
        getUniform: getUniformForFullscreen(uniformExpr, clearColor) as any,
        getLength: lengthExpr as any,
      } as any)
    : null;

  // Default vertex bodies for instanced and non-instanced modes
  const defaultVertexBodyInstanced = `
  li = i & 3u;
  let qp = qpos[li];
  // World position relative to camera, scaled by zoom
  let wp = (particle.position - render_uniforms.camera_position) * render_uniforms.zoom;
  // Convert to NDC
  let ndc = vec2<f32>(
    wp.x * 2.0 / render_uniforms.canvas_size.x,
    -wp.y * 2.0 / render_uniforms.canvas_size.y
  );
  // Quad size in NDC units
  let s = vec2<f32>(
    qp.x * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.x,
    -qp.y * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.y
  );
  out.position = vec4<f32>(ndc + s, 0.0, 1.0);
`;

  const defaultVertexBodyNonInstanced = `
  li = i & 3u;
  out.position = vec4<f32>(qpos[li], 0.0, 1.0);
`;

  const vertexBody =
    vertexBodyHook ??
    (instanced ? defaultVertexBodyInstanced : defaultVertexBodyNonInstanced);

  // Generate array storage buffer declarations for array inputs
  const arrayInputs = Object.entries(moduleInputs)
    .filter(([_, type]) => type === DataType.ARRAY)
    .map(([key, _]) => key);

  const arrayDeclarations = arrayInputs
    .map((arrayKey, index) => {
      const bindingIndex = 5 + index; // Start after fixed bindings (0-4)
      return `@group(0) @binding(${bindingIndex}) var<storage, read> ${moduleName}_${arrayKey}_array: array<f32>;`;
    })
    .join("\n");

  const code = `
struct Particle {
  position: vec2<f32>, velocity: vec2<f32>, acceleration: vec2<f32>,
  size: f32, mass: f32, color: vec4<f32>,
}
struct RenderUniforms { canvas_size: vec2<f32>, camera_position: vec2<f32>, zoom: f32, _pad: f32 }
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) color: vec4<f32>, @location(2) @interpolate(flat) index: u32, @location(3) @interpolate(flat) mass: f32 }
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;
@group(0) @binding(2) var scene_texture: texture_2d<f32>;
@group(0) @binding(3) var scene_sampler: sampler;
@vertex fn vs_main(@builtin(vertex_index) i: u32, @builtin(instance_index) inst: u32) -> VertexOutput {
  var out: VertexOutput;
  let qpos = array<vec2<f32>,4>(vec2<f32>(-1,-1),vec2<f32>(1,-1),vec2<f32>(-1,1),vec2<f32>(1,1));
  let quv  = array<vec2<f32>,4>(vec2<f32>(0,0),vec2<f32>(1,0),vec2<f32>(0,1),vec2<f32>(1,1));
  // Provide common inputs for hook body
  let instance_index = inst;
  var particle: Particle = ${
    instanced
      ? `particles[inst]`
      : `Particle(vec2<f32>(0.0), vec2<f32>(0.0), vec2<f32>(0.0), 0.0, 0.0, vec4<f32>(0.0))`
  };
  ${
    instanced
      ? `if (particle.mass == 0.0) { out.position = vec4<f32>(2,2,1,1); out.uv = vec2<f32>(0,0); out.color = vec4<f32>(0); return out; }`
      : ``
  }
  // Sensible defaults; hook or defaults may overwrite
  var li: u32 = i & 3u;
  out.uv = quv[li];
  out.index = instance_index;
  out.color = ${instanced ? `particle.color` : `vec4<f32>(1.0)`};
  // Pass pinned flag to fragment (1 if mass < 0)
  ${instanced ? `out.mass = particle.mass;` : `out.mass = 0.0;`}
${vertexBody}
  return out;
}
@fragment fn fs_main(@location(0) uv: vec2<f32>, @location(1) color: vec4<f32>, @location(2) @interpolate(flat) index: u32, @location(3) @interpolate(flat) mass: f32, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> ${fragment}`;

  return `${struct}\n${moduleUniformBindingDecl(
    moduleName,
    4
  )}\n${arrayDeclarations}\n${code}`;
}

export function buildComputeImagePassWGSL<
  Keys extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
>(
  pass: ComputeRenderPass<Keys>,
  moduleName: string,
  layout: ModuleUniformLayout,
  moduleInputs: Record<string, DataType>,
  clearColor: { r: number; g: number; b: number; a: number },
  workgroup: [number, number, number] = [8, 8, 1]
): string {
  // struct and uniform lookup
  const struct = buildModuleUniformStruct(moduleName, layout);
  const uniformExpr = makeGetUniformExpr(layout, moduleName, moduleInputs);
  const lengthExpr = makeGetLengthExpr(layout, moduleName, moduleInputs);

  // Generate array storage buffer declarations for array inputs
  const arrayInputs = Object.entries(moduleInputs)
    .filter(([_, type]) => type === DataType.ARRAY)
    .map(([key, _]) => key);

  const arrayDeclarations = arrayInputs
    .map((arrayKey, index) => {
      const bindingIndex = 3 + index; // Start after fixed bindings (0-2 for compute)
      return `@group(0) @binding(${bindingIndex}) var<storage, read> ${moduleName}_${arrayKey}_array: array<f32>;`;
    })
    .join("\n");

  // kernel
  const kernelBody = pass.kernel({
    getUniform: getUniformForCompute(uniformExpr, clearColor) as any,
    getLength: lengthExpr as any,
    readScene: (coordsExpr: string) =>
      `textureLoad(input_texture, ${coordsExpr}, 0)`,
    writeScene: (coordsExpr: string, colorExpr: string) =>
      `textureStore(output_texture, ${coordsExpr}, ${colorExpr})`,
  } as any);

  // code
  const code = `
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@compute @workgroup_size(${workgroup[0]}, ${workgroup[1]}, ${workgroup[2]})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let dims = textureDimensions(input_texture);
  if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) { return; }
  ${kernelBody}
}`;

  return `${struct}\n${moduleUniformBindingDecl(
    moduleName,
    2
  )}\n${arrayDeclarations}\n${code}`;
}
