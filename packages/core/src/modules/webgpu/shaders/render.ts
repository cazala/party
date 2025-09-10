export const renderShaderWGSL = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
}

struct RenderUniforms {
  canvas_size: vec2<f32>,
  camera_position: vec2<f32>,
  zoom: f32,
  enable_trails: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;
@group(0) @binding(2) var trail_texture: texture_2d<f32>;
@group(0) @binding(3) var trail_sampler: sampler;

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  var out: VertexOutput;
  
  let quad_positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );
  
  let quad_uvs = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );
  
  let particle = particles[instance_index];
  if (particle.mass == 0.0) {
    // Cull by sending outside clip space
    out.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
    out.uv = vec2<f32>(0.0, 0.0);
    return out;
  }
  // For instanced triangle-strip without a vertex buffer, vertex_index increments across instances.
  // Use local index per instance to select the quad corner.
  let local_index = vertex_index & 3u; // vertex_index % 4
  let quad_pos = quad_positions[local_index];
  
  // Transform to NDC with Y flipped to make positive Y go down in world space
  let world_pos = (particle.position - render_uniforms.camera_position) * render_uniforms.zoom;
  let ndc_pos = vec2<f32>(
    world_pos.x * 2.0 / render_uniforms.canvas_size.x,
    -world_pos.y * 2.0 / render_uniforms.canvas_size.y
  );
  let scaled_quad = vec2<f32>(
    quad_pos.x * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.x,
    -quad_pos.y * particle.size * render_uniforms.zoom * 2.0 / render_uniforms.canvas_size.y
  );
  
  out.position = vec4<f32>(ndc_pos + scaled_quad, 0.0, 1.0);
  out.uv = quad_uvs[local_index];
  return out;
}

@fragment
fn fs_main(
  @location(0) uv: vec2<f32>,
  @builtin(position) frag_coord: vec4<f32>
) -> @location(0) vec4<f32> {
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let radius = 0.5;
  let alpha = 1.0 - smoothstep(radius - 0.05, radius, dist);
  
  // Just output particle color - let GPU blending handle trail accumulation
  return vec4<f32>(1.0, 1.0, 1.0, alpha);
}`;
