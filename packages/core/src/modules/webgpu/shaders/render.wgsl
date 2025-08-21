struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

struct RenderUniforms {
  canvas_size: vec2<f32>,
  camera_position: vec2<f32>,
  zoom: f32,
  _padding: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> render_uniforms: RenderUniforms;

// Vertex shader for instanced rendering
@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VertexOutput {
  var out: VertexOutput;
  
  // Generate quad vertices (0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right)
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
  let quad_pos = quad_positions[vertex_index];
  
  // Transform particle position to screen space
  let world_pos = (particle.position - render_uniforms.camera_position) * render_uniforms.zoom;
  let screen_pos = (world_pos / render_uniforms.canvas_size) * 2.0 - 1.0;
  
  // Scale quad by particle size
  let scaled_quad = quad_pos * particle.size * render_uniforms.zoom / render_uniforms.canvas_size;
  
  out.position = vec4<f32>(screen_pos + scaled_quad, 0.0, 1.0);
  out.uv = quad_uvs[vertex_index];
  
  return out;
}

// Fragment shader
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Calculate distance from center of quad
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  
  // Create circular shape with anti-aliasing
  let radius = 0.5;
  let alpha = 1.0 - smoothstep(radius - 0.05, radius, dist);
  
  return vec4<f32>(1.0, 1.0, 1.0, alpha);
}