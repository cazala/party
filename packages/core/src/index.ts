export { Vector2D } from "./modules/vector";
export {
  Particle,
  type ParticleOptions,
  getIdCounter,
  setIdCounter,
} from "./modules/particle";
export {
  System,
  type Force as ForceFunction,
  type SystemOptions,
  type Config,
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
  type ColorConfig,
  type ParticleWithSide,
  calculateSquareVelocity,
  calculateVelocity,
  getParticleColor,
} from "./modules/spawner";
export {
  Bounds as BoundingBox,
  type BoundingBoxOptions,
} from "./modules/forces/bounds";
export {
  Renderer,
  Canvas2DRenderer,
  createCanvas2DRenderer,
  type RenderOptions,
} from "./modules/render";
export * from "./modules/forces";
