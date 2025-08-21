struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  size: f32,
  mass: f32,
}

struct ForceUniforms {
  gravity_strength: f32,
  gravity_direction: vec2<f32>,
  delta_time: f32,
  particle_count: u32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> force_uniforms: ForceUniforms;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= force_uniforms.particle_count) {
    return;
  }

  var particle = particles[index];
  
  // Apply gravity force
  let gravity_force = force_uniforms.gravity_direction * force_uniforms.gravity_strength * particle.mass;
  particle.velocity += gravity_force * force_uniforms.delta_time;
  
  // Update position
  particle.position += particle.velocity * force_uniforms.delta_time;
  
  // Store updated particle
  particles[index] = particle;
}