import { Particle } from "./particle";
import { SpatialGrid } from "./spatial-grid";
import { Vector2D } from "./vector";
import {
  Physics,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
} from "./forces/physics";
import {
  Bounds,
  DEFAULT_BOUNDS_BOUNCE,
  DEFAULT_BOUNDS_MODE,
  DEFAULT_BOUNDS_REPEL_DISTANCE,
  DEFAULT_BOUNDS_REPEL_STRENGTH,
} from "./forces/bounds";
import {
  Collisions,
  DEFAULT_COLLISIONS_ENABLED,
  DEFAULT_COLLISIONS_EAT,
} from "./forces/collisions";
import {
  Behavior,
  DEFAULT_BEHAVIOR_ENABLED,
  DEFAULT_BEHAVIOR_WANDER_WEIGHT,
  DEFAULT_BEHAVIOR_COHESION_WEIGHT,
  DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_WEIGHT,
  DEFAULT_BEHAVIOR_CHASE_WEIGHT,
  DEFAULT_BEHAVIOR_AVOID_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_RANGE,
  DEFAULT_BEHAVIOR_VIEW_RADIUS,
  DEFAULT_BEHAVIOR_VIEW_ANGLE,
} from "./forces/behavior";
import {
  Fluid,
  DEFAULT_FLUID_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_VISCOSITY,
  DEFAULT_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_NEAR_THRESHOLD,
} from "./forces/fluid";
import {
  Sensors,
  DEFAULT_TRAIL_ENABLED,
  DEFAULT_TRAIL_DECAY,
  DEFAULT_TRAIL_DIFFUSE,
  DEFAULT_SENSORS_ENABLED,
  DEFAULT_SENSOR_DISTANCE,
  DEFAULT_SENSOR_ANGLE,
  DEFAULT_SENSOR_RADIUS,
  DEFAULT_SENSOR_THRESHOLD,
  DEFAULT_SENSOR_STRENGTH,
  DEFAULT_FOLLOW_BEHAVIOR,
  DEFAULT_FLEE_BEHAVIOR,
  DEFAULT_COLOR_SIMILARITY_THRESHOLD,
  DEFAULT_FLEE_ANGLE,
  SensorBehavior,
} from "./forces/sensors";
import {
  Joints,
  DEFAULT_JOINTS_ENABLED,
  DEFAULT_JOINT_STIFFNESS,
  DEFAULT_JOINT_TOLERANCE,
} from "./forces/joints";

/**
 * Interface defining the lifecycle methods for a physics force.
 * Forces are applied to particles during each simulation step using a four-phase lifecycle:
 * before → apply → constraints → after
 *
 * @interface Force
 */
export interface Force {
  /**
   * Called once per frame before applying force to individual particles.
   * Use for global calculations or setup that affects all particles.
   *
   * @param particles - Array of all particles in the system
   * @param deltaTime - Time elapsed since last frame in milliseconds
   */
  before?(particles: Particle[], deltaTime: number): void;

  /**
   * Called once per particle to apply the force effect.
   * This is where the main force logic should be implemented.
   *
   * @param particle - The particle to apply the force to
   * @param spatialGrid - Spatial grid for efficient neighbor queries
   */
  apply(particle: Particle, spatialGrid: SpatialGrid): void;

  /**
   * Called after applying forces but before updating particle positions.
   * Use for constraint resolution and position corrections.
   *
   * @param particles - Array of all particles in the system
   * @param spatialGrid - Spatial grid for efficient neighbor queries
   */
  constraints?(particles: Particle[], spatialGrid: SpatialGrid): void;

  /**
   * Called once per frame after all particles have been updated.
   * Use for cleanup or post-processing operations.
   *
   * @param particles - Array of all particles in the system
   * @param deltaTime - Time elapsed since last frame in milliseconds
   * @param spatialGrid - Spatial grid for efficient neighbor queries
   */
  after?(
    particles: Particle[],
    deltaTime: number,
    spatialGrid: SpatialGrid
  ): void;

  /**
   * Called when the force is being removed or the system is being reset.
   * Use for cleanup of resources, event listeners, or internal state.
   */
  clear?(): void;
}

/**
 * Configuration interface for the particle system.
 * Contains all settings for physics forces, behaviors, and system-wide parameters.
 * All properties are optional to allow partial configuration updates.
 *
 * @interface Config
 */
export interface Config {
  /** Physics force configurations */
  physics?: {
    /** Gravity settings */
    gravity?: {
      /** Gravitational acceleration strength (default: 0.1) */
      strength?: number;
      /** Gravity direction vector. Default is downward: {x: 0, y: 1} */
      direction?: { x?: number; y?: number };
    };
    /** Inertia factor for momentum preservation (0-1, default: 0.99) */
    inertia?: number;
    /** Friction coefficient for velocity damping (0-1, default: 0.01) */
    friction?: number;
  };

  /** Boundary behavior settings */
  bounds?: {
    /** Bounce coefficient when particles hit boundaries (0-1) */
    bounce?: number;
    /** Friction applied during boundary interactions (0-1) */
    friction?: number;
    /** Boundary interaction mode */
    mode?: "bounce" | "kill" | "warp";
    /** Distance from boundary to start repel force */
    repelDistance?: number;
    /** Strength of boundary repel force */
    repelStrength?: number;
  };

  /** Particle collision settings */
  collisions?: {
    /** Whether particle-particle collisions are enabled */
    enabled?: boolean;
    /** Whether larger particles can consume smaller ones */
    eat?: boolean;
  };

  /** Flocking behavior settings */
  behavior?: {
    /** Whether behavior forces are enabled */
    enabled?: boolean;
    /** Random wandering force strength */
    wanderWeight?: number;
    /** Attraction to group center strength */
    cohesionWeight?: number;
    /** Velocity matching with neighbors strength */
    alignmentWeight?: number;
    /** Avoidance of nearby particles strength */
    separationWeight?: number;
    /** Chase behavior toward different colored particles */
    chaseWeight?: number;
    /** Avoidance of different colored particles */
    avoidWeight?: number;
    /** Distance at which separation force activates */
    separationRange?: number;
    /** Maximum distance for neighbor detection */
    viewRadius?: number;
    /** Field of view angle in degrees for behavior interactions */
    viewAngle?: number;
  };

  /** Fluid dynamics (SPH) settings */
  fluid?: {
    /** Whether fluid forces are enabled */
    enabled?: boolean;
    /** Radius of influence for fluid interactions */
    influenceRadius?: number;
    /** Target density for fluid pressure calculations */
    targetDensity?: number;
    /** Multiplier for pressure force strength */
    pressureMultiplier?: number;
    /** Viscosity force strength for internal friction */
    viscosity?: number;
    /** Multiplier for near pressure force strength when particles are very close */
    nearPressureMultiplier?: number;
    /** Distance threshold for switching from regular to near pressure (in pixels) */
    nearThreshold?: number;
    /** Resistance to movement through fluid medium */
    resistance?: number;
  };

  /** Environmental sensor settings */
  sensors?: {
    /** Whether particles leave visual trails */
    enableTrail?: boolean;
    /** Rate of trail decay (0-1, higher = faster decay) */
    trailDecay?: number;
    /** Trail blur/diffusion strength */
    trailDiffuse?: number;
    /** Whether sensor-based navigation is enabled */
    enableSensors?: boolean;
    /** Distance sensors project in front of particles */
    sensorDistance?: number;
    /** Angle offset for left/right sensors (degrees) */
    sensorAngle?: number;
    /** Radius of sensor detection area */
    sensorRadius?: number;
    /** Minimum intensity threshold for sensor activation */
    sensorThreshold?: number;
    /** Strength of sensor-based steering forces */
    sensorStrength?: number;
    /** Behavior mode for following sensor targets */
    followBehavior?: SensorBehavior;
    /** Behavior mode for fleeing from sensor targets */
    fleeBehavior?: SensorBehavior;
    /** Threshold for color similarity detection (0-1) */
    colorSimilarityThreshold?: number;
    /** Maximum angle for flee behavior steering (degrees) */
    fleeAngle?: number;
  };

  /** Joint constraint settings */
  joints?: {
    /** Whether joint constraints are enabled */
    enabled?: boolean;
    /** Joint stiffness (0.0 = elastic, 1.0 = rigid) */
    stiffness?: number;
    /** Joint tolerance (0.0 = break easily, 1.0 = never break) */
    tolerance?: number;
    /** Bounce factor for joint stress responses */
    restitution?: number;
    /** Whether joints interact with particle collisions */
    enableCollisions?: boolean;
    /** Friction applied to connected particles */
    friction?: number;
  };
}

/** Default cell size for spatial grid optimization */
export const DEFAULT_SPATIAL_GRID_CELL_SIZE = 100;

/**
 * Options for initializing a particle system.
 *
 * @interface SystemOptions
 */
export interface SystemOptions {
  /** Width of the simulation area in world units */
  width: number;
  /** Height of the simulation area in world units */
  height: number;
  /** Size of spatial grid cells for collision optimization (default: 100) */
  cellSize?: number;
}

/**
 * Main particle system class that manages particles, forces, and simulation lifecycle.
 *
 * The System class provides:
 * - Particle management (add, remove, update)
 * - Force system with pluggable architecture
 * - Spatial grid optimization for performance
 * - Animation loop with play/pause controls
 * - Configuration import/export
 * - FPS tracking and performance monitoring
 *
 * @class System
 * @example
 * ```typescript
 * const system = new System({ width: 800, height: 600 });
 *
 * // Add some particles
 * const particle = new Particle(100, 100, { size: 5, mass: 1 });
 * system.addParticle(particle);
 *
 * // Add forces
 * system.addForce(new Physics());
 * system.addForce(new Bounds());
 *
 * // Start simulation
 * system.play();
 * ```
 */
export class System {
  /** Array of all particles in the system */
  public particles: Particle[] = [];
  /** Array of all active forces */
  public forces: Force[] = [];
  /** Spatial grid for efficient neighbor queries and collision detection */
  public spatialGrid: SpatialGrid;
  /** Width of the simulation area */
  public width: number;
  /** Height of the simulation area */
  public height: number;
  /** Whether the simulation is currently running */
  public isPlaying: boolean = false;

  /** Timestamp of the last animation frame */
  private lastTime: number = 0;
  /** Current animation frame request ID */
  private animationId: number | null = null;

  /** Frame time history for FPS calculation */
  private fpsFrameTimes: number[] = [];
  /** Maximum number of frame times to track */
  private fpsMaxSamples: number = 60;
  /** Current calculated FPS */
  private currentFPS: number = 0;

  /** Optional callback function called after each frame update */
  private renderCallback?: (system: System) => void;

  /**
   * Creates a new particle system.
   *
   * @param options - Configuration options for the system
   * @param options.width - Width of the simulation area
   * @param options.height - Height of the simulation area
   * @param options.cellSize - Size of spatial grid cells (optional, default: 100)
   */
  constructor(options: SystemOptions) {
    this.width = options.width;
    this.height = options.height;

    this.spatialGrid = new SpatialGrid({
      width: this.width,
      height: this.height,
      cellSize: options.cellSize ?? DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
  }

  /**
   * Adds a particle to the system.
   *
   * @param particle - The particle to add
   */
  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  /**
   * Adds multiple particles to the system.
   *
   * @param particles - Array of particles to add
   */
  addParticles(particles: Particle[]): void {
    for (const particle of particles) {
      this.addParticle(particle);
    }
  }

  /**
   * Finds a particle by its unique ID.
   *
   * @param id - The particle ID to search for
   * @returns The particle if found, null otherwise
   */
  getParticle(id: number): Particle | null {
    const particle = this.particles.find((particle) => particle.id === id);
    return particle || null;
  }

  /**
   * Removes a particle from the system.
   *
   * @param particle - The particle to remove
   */
  removeParticle(particle: Particle): void {
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
    }
  }

  /**
   * Adds a force to the system.
   * Forces are applied to particles during each update cycle.
   *
   * @param force - The force to add
   */
  addForce(force: Force): void {
    this.forces.push(force);
  }

  /**
   * Removes a force from the system.
   *
   * @param force - The force to remove
   */
  removeForce(force: Force): void {
    const index = this.forces.indexOf(force);
    if (index > -1) {
      this.forces.splice(index, 1);
    }
  }

  /**
   * Removes all forces from the system.
   */
  clearForces(): void {
    this.forces = [];
  }

  /**
   * Updates the simulation by one time step.
   *
   * This method:
   * 1. Updates the spatial grid with current particle positions
   * 2. Runs the force lifecycle: before → apply → constraints → after
   * 3. Updates particle physics and positions
   * 4. Removes particles marked for deletion (mass = 0)
   *
   * @param deltaTime - Time elapsed since last update in milliseconds
   */
  update(deltaTime: number): void {
    // Clear and repopulate spatial grid
    this.spatialGrid.clear();

    for (const particle of this.particles) {
      this.spatialGrid.insert(particle);
    }

    for (const force of this.forces) {
      force.before?.(this.particles, deltaTime);
    }

    // Apply forces and integrate physics
    for (const particle of this.particles) {
      for (const force of this.forces) {
        force.apply(particle, this.spatialGrid);
      }
      if (!particle.pinned) {
        particle.update(deltaTime);

        // Reset velocity for grabbed particles after physics update
        // (the grab tool will set the correct position)
        if (particle.grabbed) {
          particle.velocity.x = 0;
          particle.velocity.y = 0;
        }
      } else {
        particle.velocity.x = 0;
        particle.velocity.y = 0;
      }
    }

    // Apply constraints
    for (const force of this.forces) {
      force.constraints?.(this.particles, this.spatialGrid);
    }

    // Apply post-physics operations (momentum, etc.)
    for (const force of this.forces) {
      force.after?.(this.particles, deltaTime, this.spatialGrid);
    }

    // Remove eaten particles (marked with mass = 0)
    this.particles = this.particles.filter((particle) => particle.mass > 0);
  }

  /**
   * Starts the simulation animation loop.
   * If already playing, this method does nothing.
   */
  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  /**
   * Pauses the simulation animation loop.
   * The simulation state is preserved and can be resumed with play().
   */
  pause(): void {
    this.isPlaying = false;
  }

  /**
   * Toggles the simulation between playing and paused states.
   */
  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Resets the simulation to its initial state.
   *
   * This method:
   * - Pauses the simulation
   * - Clears all particles
   * - Resets timing and FPS data
   * - Clears force-specific caches
   */
  reset(): void {
    this.pause();
    // Ensure animation frame is properly cancelled
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.particles = [];
    this.lastTime = 0;
    // Clear FPS tracking data
    this.fpsFrameTimes = [];
    this.currentFPS = 0;
    // Clear force-specific caches to prevent memory leaks
    for (const force of this.forces) {
      force.clear?.();
    }
  }

  clear(): void {
    this.particles = [];
    this.spatialGrid.clear();
    // Clear FPS tracking data to prevent memory accumulation
    this.fpsFrameTimes = [];
    this.currentFPS = 0;
    // Clear force-specific caches to prevent memory leaks
    for (const force of this.forces) {
      force.clear?.();
    }
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  getFPS(): number {
    return this.currentFPS;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.spatialGrid.setSize(width, height);
  }

  private animate = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Update FPS calculation
    this.updateFPS(currentTime);

    if (this.isPlaying) {
      this.update(deltaTime);
    }

    this.animationId = requestAnimationFrame(this.animate);

    if (this.renderCallback) {
      this.renderCallback(this);
    }
  };

  private updateFPS(currentTime: number): void {
    // Add current frame time
    this.fpsFrameTimes.push(currentTime);

    // Remove old frames (keep only last N frames)
    if (this.fpsFrameTimes.length > this.fpsMaxSamples) {
      this.fpsFrameTimes.shift();
    }

    // Calculate FPS from recent frames
    if (this.fpsFrameTimes.length >= 2) {
      const timeSpan =
        this.fpsFrameTimes[this.fpsFrameTimes.length - 1] -
        this.fpsFrameTimes[0];
      const frames = this.fpsFrameTimes.length - 1;
      this.currentFPS = frames / (timeSpan / 1000);
    }
  }

  setRenderCallback(callback: (system: System) => void): void {
    this.renderCallback = callback;
  }

  clearRenderCallback(): void {
    this.renderCallback = undefined;
  }

  export(): Config {
    const config: Config = {};

    // Export configuration for each force type present in the system
    for (const force of this.forces) {
      if (force instanceof Physics) {
        config.physics = {
          gravity: {
            strength: force.strength,
            direction: { x: force.direction.x, y: force.direction.y },
          },
          inertia: force.inertia,
          friction: force.friction,
        };
      } else if (force instanceof Bounds) {
        config.bounds = {
          bounce: force.bounce,
          mode: force.mode,
          repelDistance: force.repelDistance,
          repelStrength: force.repelStrength,
        };
      } else if (force instanceof Collisions) {
        config.collisions = {
          enabled: force.enabled,
          eat: force.eat,
        };
      } else if (force instanceof Behavior) {
        config.behavior = {
          enabled: force.enabled,
          wanderWeight: force.wanderWeight,
          cohesionWeight: force.cohesionWeight,
          alignmentWeight: force.alignmentWeight,
          separationWeight: force.separationWeight,
          chaseWeight: force.chaseWeight,
          avoidWeight: force.avoidWeight,
          separationRange: force.separationRange,
          viewRadius: force.viewRadius,
          viewAngle: force.viewAngle,
        };
      } else if (force instanceof Fluid) {
        config.fluid = {
          enabled: force.enabled,
          influenceRadius: force.influenceRadius,
          targetDensity: force.targetDensity,
          pressureMultiplier: force.pressureMultiplier,
          viscosity: force.viscosity,
          nearPressureMultiplier: force.nearPressureMultiplier,
          nearThreshold: force.nearThreshold,
        };
      } else if (force instanceof Sensors) {
        config.sensors = {
          enableTrail: force.enableTrail,
          trailDecay: force.trailDecay,
          trailDiffuse: force.trailDiffuse,
          enableSensors: force.enableSensors,
          sensorDistance: force.sensorDistance,
          sensorAngle: force.sensorAngle,
          sensorRadius: force.sensorRadius,
          sensorThreshold: force.sensorThreshold,
          sensorStrength: force.sensorStrength,
          followBehavior: force.followBehavior,
          fleeBehavior: force.fleeBehavior,
          colorSimilarityThreshold: force.colorSimilarityThreshold,
          fleeAngle: force.fleeAngle,
        };
      } else if (force instanceof Joints) {
        config.joints = {
          enabled: force.enabled,
          stiffness: force.getGlobalStiffness(),
          tolerance: force.getGlobalTolerance(),
          enableCollisions: force.enableCollisions,
        };
      }
    }

    // No system settings to export currently

    return config;
  }

  import(config: Config): void {
    // Apply configuration for each force type present in the system
    for (const force of this.forces) {
      if (force instanceof Physics) {
        if (config.physics) {
          force.setStrength(
            config.physics.gravity?.strength ?? DEFAULT_GRAVITY_STRENGTH
          );
          force.setDirection(
            new Vector2D(
              config.physics.gravity?.direction?.x ??
                DEFAULT_GRAVITY_DIRECTION.x,
              config.physics.gravity?.direction?.y ??
                DEFAULT_GRAVITY_DIRECTION.y
            )
          );
          force.setInertia(config.physics.inertia ?? DEFAULT_INERTIA);
          force.setFriction(config.physics.friction ?? DEFAULT_FRICTION);
        }
      } else if (force instanceof Bounds && config.bounds) {
        force.bounce = config.bounds.bounce ?? DEFAULT_BOUNDS_BOUNCE;
        force.setMode(config.bounds.mode ?? DEFAULT_BOUNDS_MODE);
        force.setRepelDistance(
          config.bounds.repelDistance ?? DEFAULT_BOUNDS_REPEL_DISTANCE
        );
        force.setRepelStrength(
          config.bounds.repelStrength ?? DEFAULT_BOUNDS_REPEL_STRENGTH
        );
      } else if (force instanceof Collisions && config.collisions) {
        force.setEnabled(
          config.collisions.enabled ?? DEFAULT_COLLISIONS_ENABLED
        );
        force.setEat(config.collisions.eat ?? DEFAULT_COLLISIONS_EAT);
      } else if (force instanceof Behavior && config.behavior) {
        force.setEnabled(config.behavior.enabled ?? DEFAULT_BEHAVIOR_ENABLED);
        force.wanderWeight =
          config.behavior.wanderWeight ?? DEFAULT_BEHAVIOR_WANDER_WEIGHT;
        force.cohesionWeight =
          config.behavior.cohesionWeight ?? DEFAULT_BEHAVIOR_COHESION_WEIGHT;
        force.alignmentWeight =
          config.behavior.alignmentWeight ?? DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT;
        force.separationWeight =
          config.behavior.separationWeight ??
          DEFAULT_BEHAVIOR_SEPARATION_WEIGHT;
        force.chaseWeight =
          config.behavior.chaseWeight ?? DEFAULT_BEHAVIOR_CHASE_WEIGHT;
        force.avoidWeight =
          config.behavior.avoidWeight ?? DEFAULT_BEHAVIOR_AVOID_WEIGHT;
        force.separationRange =
          config.behavior.separationRange ?? DEFAULT_BEHAVIOR_SEPARATION_RANGE;
        force.viewRadius =
          config.behavior.viewRadius ?? DEFAULT_BEHAVIOR_VIEW_RADIUS;
        force.viewAngle =
          config.behavior.viewAngle ?? DEFAULT_BEHAVIOR_VIEW_ANGLE;
      } else if (force instanceof Fluid && config.fluid) {
        force.setEnabled(config.fluid.enabled ?? DEFAULT_FLUID_ENABLED);
        force.influenceRadius =
          config.fluid.influenceRadius ?? DEFAULT_INFLUENCE_RADIUS;
        force.targetDensity =
          config.fluid.targetDensity ?? DEFAULT_TARGET_DENSITY;
        force.pressureMultiplier =
          config.fluid.pressureMultiplier ?? DEFAULT_PRESSURE_MULTIPLIER;
        force.viscosity = config.fluid.viscosity ?? DEFAULT_VISCOSITY;
        force.nearPressureMultiplier =
          config.fluid.nearPressureMultiplier ??
          DEFAULT_NEAR_PRESSURE_MULTIPLIER;
        force.nearThreshold =
          config.fluid.nearThreshold ?? DEFAULT_NEAR_THRESHOLD;
      } else if (force instanceof Sensors && config.sensors) {
        force.setEnableTrail(
          config.sensors.enableTrail ?? DEFAULT_TRAIL_ENABLED
        );
        force.setTrailDecay(config.sensors.trailDecay ?? DEFAULT_TRAIL_DECAY);
        force.setTrailDiffuse(
          config.sensors.trailDiffuse ?? DEFAULT_TRAIL_DIFFUSE
        );
        force.setEnableSensors(
          config.sensors.enableSensors ?? DEFAULT_SENSORS_ENABLED
        );
        force.setSensorDistance(
          config.sensors.sensorDistance ?? DEFAULT_SENSOR_DISTANCE
        );
        force.setSensorAngle(
          config.sensors.sensorAngle ?? DEFAULT_SENSOR_ANGLE
        );
        force.setSensorRadius(
          config.sensors.sensorRadius ?? DEFAULT_SENSOR_RADIUS
        );
        force.setSensorThreshold(
          config.sensors.sensorThreshold ?? DEFAULT_SENSOR_THRESHOLD
        );
        force.setSensorStrength(
          config.sensors.sensorStrength ?? DEFAULT_SENSOR_STRENGTH
        );
        force.setFollowBehavior(
          config.sensors.followBehavior ?? DEFAULT_FOLLOW_BEHAVIOR
        );
        force.setFleeBehavior(
          config.sensors.fleeBehavior ?? DEFAULT_FLEE_BEHAVIOR
        );
        force.setColorSimilarityThreshold(
          config.sensors.colorSimilarityThreshold ??
            DEFAULT_COLOR_SIMILARITY_THRESHOLD
        );
        force.setFleeAngle(config.sensors.fleeAngle ?? DEFAULT_FLEE_ANGLE);
      } else if (force instanceof Joints && config.joints) {
        force.setEnabled(config.joints.enabled ?? DEFAULT_JOINTS_ENABLED);
        force.setGlobalStiffness(
          config.joints.stiffness ?? DEFAULT_JOINT_STIFFNESS
        );
        force.setGlobalTolerance(
          config.joints.tolerance ?? DEFAULT_JOINT_TOLERANCE
        );
        if (config.joints.enableCollisions !== undefined) {
          force.setEnableCollisions(config.joints.enableCollisions);
        }
      }
    }

    // No system settings to import currently
  }
}
