export const PARTICLE_STRUCT = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
}`;

export const STORAGE_DECL = `@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;`;
