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
