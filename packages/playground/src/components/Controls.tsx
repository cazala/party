import {
  Gravity,
  Flock,
  Bounds,
  Collisions,
  Fluid,
  Canvas2DRenderer,
  SpatialGrid,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_ANGLE,
  DEFAULT_FLOCK_MAX_SPEED,
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_FRICTION,
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
} from "@party/core";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
} from "@party/core/modules/render";
import { PhysicsControls } from "./control-sections/PhysicsControls";
import { SpawnControls } from "./control-sections/SpawnControls";
import { BehaviorControls } from "./control-sections/BehaviorControls";
import { RenderControls } from "./control-sections/RenderControls";
import { PerformanceControls } from "./control-sections/PerformanceControls";

const DEFAULT_SPAWN_NUM_PARTICLES = 100;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_DRAG_THRESHOLD = 5;

interface ControlsProps {
  gravity: Gravity | null;
  flock: Flock | null;
  bounds: Bounds | null;
  collisions: Collisions | null;
  fluid: Fluid | null;
  renderer: Canvas2DRenderer | null;
  spatialGrid: SpatialGrid | null;
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random",
    spacing: number,
    particleSize: number,
    dragThreshold: number
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
  };
}

export function Controls({
  gravity,
  flock,
  bounds,
  collisions,
  fluid,
  renderer,
  spatialGrid,
  onSpawnParticles,
  onGetSpawnConfig,
}: ControlsProps) {
  const resetToDefaults = () => {
    // Reset gravity
    if (gravity) {
      gravity.setStrength(DEFAULT_GRAVITY_STRENGTH);
      gravity.setDirectionFromAngle(DEFAULT_GRAVITY_ANGLE * (Math.PI / 180));
    }

    // Reset bounds
    if (bounds) {
      bounds.bounce = DEFAULT_BOUNDS_BOUNCE;
      bounds.setFriction(DEFAULT_BOUNDS_FRICTION);
    }

    // Reset collisions
    if (collisions) {
      collisions.setEnabled(DEFAULT_COLLISIONS_ENABLED);
    }

    // Reset flock
    if (flock) {
      flock.cohesionWeight = DEFAULT_FLOCK_COHESION_WEIGHT;
      flock.alignmentWeight = DEFAULT_FLOCK_ALIGNMENT_WEIGHT;
      flock.separationWeight = DEFAULT_FLOCK_SEPARATION_WEIGHT;
      flock.maxSpeed = DEFAULT_FLOCK_MAX_SPEED;
      flock.separationRange = DEFAULT_FLOCK_SEPARATION_RANGE;
      flock.neighborRadius = DEFAULT_FLOCK_NEIGHBOR_RADIUS;
    }

    // Reset fluid
    if (fluid) {
      fluid.influenceRadius = DEFAULT_INFLUENCE_RADIUS;
      fluid.targetDensity = DEFAULT_TARGET_DENSITY;
      fluid.pressureMultiplier = DEFAULT_PRESSURE_MULTIPLIER;
    }

    // Reset renderer
    if (renderer) {
      renderer.setColorMode(DEFAULT_RENDER_COLOR_MODE);
      renderer.setCustomColor(DEFAULT_RENDER_CUSTOM_COLOR);
      renderer.setShowSpatialGrid(false);
    }

    // Reset spawn - trigger spawn through callback
    if (onSpawnParticles) {
      onSpawnParticles(
        DEFAULT_SPAWN_NUM_PARTICLES,
        DEFAULT_SPAWN_SHAPE,
        DEFAULT_SPAWN_SPACING,
        DEFAULT_SPAWN_PARTICLE_SIZE,
        DEFAULT_DRAG_THRESHOLD
      );
    }
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Controls</h3>
        <button onClick={resetToDefaults} className="reset-button">
          Reset
        </button>
      </div>

      <PhysicsControls
        gravity={gravity}
        bounds={bounds}
        collisions={collisions}
      />
      <SpawnControls
        onSpawnParticles={onSpawnParticles}
        onGetSpawnConfig={onGetSpawnConfig}
      />
      <BehaviorControls flock={flock} fluid={fluid} />
      <RenderControls renderer={renderer} flock={flock} />
      <PerformanceControls spatialGrid={spatialGrid} renderer={renderer} />
    </div>
  );
}
