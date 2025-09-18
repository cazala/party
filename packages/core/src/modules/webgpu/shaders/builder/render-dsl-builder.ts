import type { FullscreenRenderPass, ComputeRenderPass } from "../descriptors";

export interface ModuleUniformLookup {
  getUniformExpr: (id: string) => string; // returns WGSL expression to read module uniform
}

export function buildFullscreenPassWGSL<Keys extends string = string>(
  pass: FullscreenRenderPass<Keys>,
  moduleName: string,
  lookup: ModuleUniformLookup
): string {
  const fragmentBody = pass.fragment({
    getUniform: (id: any) =>
      id === "canvasWidth"
        ? "render_uniforms.canvas_size.x"
        : id === "canvasHeight"
        ? "render_uniforms.canvas_size.y"
        : id === "clearColorR"
        ? "0.0" // caller should string-substitute clear color if needed
        : id === "clearColorG"
        ? "0.0"
        : id === "clearColorB"
        ? "0.0"
        : lookup.getUniformExpr(id as string),
    sampleScene: (uvExpr: string) =>
      `textureSampleLevel(scene_texture, scene_sampler, ${uvExpr}, 0.0)`,
  } as any);

  return `
struct Particle {
  position: vec2<f32>, velocity: vec2<f32>, acceleration: vec2<f32>,
  size: f32, mass: f32, color: vec4<f32>,
}
struct RenderUniforms { canvas_size: vec2<f32>, camera_position: vec2<f32>, zoom: f32, _pad: f32 }
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) color: vec4<f32> }
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;
@group(0) @binding(2) var scene_texture: texture_2d<f32>;
@group(0) @binding(3) var scene_sampler: sampler;
@vertex fn vs_main(@builtin(vertex_index) i: u32, @builtin(instance_index) inst: u32) -> VertexOutput {
  var out: VertexOutput;
  let qpos = array<vec2<f32>,4>(vec2<f32>(-1,-1),vec2<f32>(1,-1),vec2<f32>(-1,1),vec2<f32>(1,1));
  let quv  = array<vec2<f32>,4>(vec2<f32>(0,0),vec2<f32>(1,0),vec2<f32>(0,1),vec2<f32>(1,1));
  let p = particles[inst];
  if (p.mass == 0.0) { out.position = vec4<f32>(2,2,1,1); out.uv = vec2<f32>(0,0); out.color = vec4<f32>(0); return out; }
  let li = i & 3u; let qp = qpos[li];
  let wp = (p.position - render_uniforms.camera_position) * render_uniforms.zoom;
  let ndc = vec2<f32>(wp.x*2.0/render_uniforms.canvas_size.x, -wp.y*2.0/render_uniforms.canvas_size.y);
  let s = vec2<f32>(
    qp.x * p.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.x,
    -qp.y * p.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.y
  );
  out.position = vec4<f32>(ndc + s, 0.0, 1.0);
  out.uv = quv[li];
  out.color = p.color;
  return out;
}
@fragment fn fs_main(@location(0) uv: vec2<f32>, @location(1) color: vec4<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> ${fragmentBody}`;
}

export function buildComputeImagePassWGSL<Keys extends string = string>(
  pass: ComputeRenderPass<Keys>,
  moduleName: string,
  lookup: ModuleUniformLookup,
  workgroup: [number, number, number] = [8, 8, 1]
): string {
  const kernelBody = pass.kernel({
    getUniform: (id: any) =>
      id === "canvasWidth"
        ? "f32(textureDimensions(input_texture).x)"
        : id === "canvasHeight"
        ? "f32(textureDimensions(input_texture).y)"
        : id === "clearColorR"
        ? "0.0"
        : id === "clearColorG"
        ? "0.0"
        : id === "clearColorB"
        ? "0.0"
        : lookup.getUniformExpr(id as string),
    readScene: (coordsExpr: string) =>
      `textureLoad(input_texture, ${coordsExpr}, 0)`,
    writeScene: (coordsExpr: string, colorExpr: string) =>
      `textureStore(output_texture, ${coordsExpr}, ${colorExpr})`,
  } as any);

  return `
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rgba8unorm, write>;
@compute @workgroup_size(${workgroup[0]}, ${workgroup[1]}, ${workgroup[2]})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let dims = textureDimensions(input_texture);
  if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) { return; }
  ${kernelBody}
}`;
}
