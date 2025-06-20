export { Vector2D } from './modules/vector.js';
export { Particle, type ParticleOptions } from './modules/particle.js';
export { ParticleSystem, type ForceFunction, type SystemOptions } from './modules/system.js';
export { 
  Spawner, 
  type SpawnerOptions, 
  type SpawnPattern,
  type GridSpawnOptions,
  type CircleSpawnOptions,
  type LineSpawnOptions,
  type RandomSpawnOptions
} from './modules/spawner.js';
export { 
  BoundingBox, 
  type BoundingBoxOptions,
  createScreenBounds
} from './modules/bounds.js';
export {
  Renderer,
  Canvas2DRenderer,
  createCanvas2DRenderer,
  type RenderOptions,
  type ParticleRenderOptions
} from './modules/render.js';
export {
  Gravity,
  createGravityForce,
  defaultGravity,
  type GravityOptions
} from './modules/forces/gravity.js';
export {
  createParticleSystemHook,
  type ParticleSystemState,
  type ParticleSystemControls,
  type ParticleSystemHook,
  type UseParticleSystemOptions
} from './modules/react.js';