export { Vector2D, degToRad, radToDeg } from "./modules/vector";
export {
  Particle,
  type ParticleOptions,
  getIdCounter,
  setIdCounter,
} from "./modules/particle";
export {
  System,
  type Force,
  type SystemOptions,
  type Config,
  type SystemEvents,
  DEFAULT_SPATIAL_GRID_CELL_SIZE,
} from "./modules/system";
export { SpatialGrid, type SpatialGridOptions } from "./modules/spatial-grid";
export {
  Spawner,
  type GridSpawnOptions,
  type RandomSpawnOptions,
  type CircleSpawnOptions,
  type SquareSpawnOptions,
  type DonutSpawnOptions,
  type InitParticlesOptions,
  type VelocityConfig,
  type ParticleWithSide,
  calculateSquareVelocity,
  calculateVelocity,
  getParticleColor,
  DEFAULT_COLOR_PALETTE,
} from "./modules/spawner";
export {
  Boundary,
  type BoundaryOptions,
  type BoundaryMode,
  DEFAULT_BOUNDARY_BOUNCE,
  DEFAULT_BOUNDARY_MIN_BOUNCE_VELOCITY,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
  DEFAULT_BOUNDARY_MODE,
  // Legacy aliases for backward compatibility
  Boundary as BoundingBox,
  type BoundaryOptions as BoundingBoxOptions,
} from "./modules/forces/boundary";
export {
  Renderer,
  Canvas2DRenderer,
  createCanvas2DRenderer,
  type RenderOptions,
  PINNED_PARTICLE_COLOR,
} from "./modules/render";
export * from "./modules/forces";
export {
  Emitter,
  type SerializedEmitter,
  type EmitterOptions,
  DEFAULT_EMITTER_RATE,
  DEFAULT_EMITTER_DIRECTION,
  DEFAULT_EMITTER_SPEED,
  DEFAULT_EMITTER_AMPLITUDE,
  DEFAULT_EMITTER_PARTICLE_SIZE,
  DEFAULT_EMITTER_PARTICLE_MASS,
  DEFAULT_EMITTER_COLORS,
  DEFAULT_EMITTER_FOLLOW_MOUSE,
  // Lifetime defaults
  DEFAULT_EMITTER_LIFETIME,
  DEFAULT_EMITTER_DURATION,
  DEFAULT_EMITTER_END_SIZE_MULTIPLIER,
  DEFAULT_EMITTER_END_ALPHA,
  DEFAULT_EMITTER_END_COLORS,
  DEFAULT_EMITTER_END_SPEED_MULTIPLIER,
} from "./modules/emitter";
export { Emitters } from "./modules/emitters";
