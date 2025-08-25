export const computeShaderWGSL = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

struct ForceUniforms {
  v0: vec4<f32>, // x: gravity_strength, y: delta_time, z: particle_count, w: unused
  v1: vec4<f32>, // x: dir.x, y: dir.y, z: unused, w: unused
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> force_uniforms: ForceUniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let count = u32(force_uniforms.v0.z);
  if (index >= count) {
    return;
  }

  var particle = particles[index];
  
  // Apply gravity acceleration (Y positive is down in world, so use +)
  let gravity = vec2<f32>(force_uniforms.v1.x, force_uniforms.v1.y) * force_uniforms.v0.x;
  particle.velocity += gravity * force_uniforms.v0.y;
  
  // Integrate position
  particle.position += particle.velocity * force_uniforms.v0.y;
  
  particles[index] = particle;
}`;
