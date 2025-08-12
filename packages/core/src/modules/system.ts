import { Particle } from "./particle";
import { SpatialGrid } from "./spatial-grid";
import { Vector2D } from "./vector";
import mitt, { Emitter as MittEmitter } from "mitt";
import {
  Physics,
  DEFAULT_GRAVITY_STRENGTH,
  DEFAULT_GRAVITY_DIRECTION,
  DEFAULT_INERTIA,
  DEFAULT_FRICTION,
} from "./forces/physics";
import {
  Boundary,
  DEFAULT_BOUNDARY_BOUNCE,
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
} from "./forces/boundary";
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
  DEFAULT_JOINT_TOLERANCE,
} from "./forces/joints";
import { Emitters } from "./emitters";
import { SerializedEmitter } from "./emitter";

/**
 * Events emitted by the particle system
 */
export type SystemEvents = {
  "particle-added": { particle: Particle };
};

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
  boundary?: {
    /** Bounce coefficient when particles hit boundaries (0-1) */
    bounce?: number;
    /** Friction applied during boundary interactions (0-1) */
    friction?: number;
    /** Boundary interaction mode */
    mode?: "bounce" | "kill" | "warp" | "none";
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

  /** Particle emitters settings */
  emitters?: {
    /** Whether emitters are enabled globally */
    enabled?: boolean;
    /** Array of emitter configurations */
    emitterConfigs?: SerializedEmitter[];
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
  /** Enable camera frustum culling for performance (default: false) */
  enableFrustumCulling?: boolean;
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
 * system.addForce(new Boundary());
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
  /** Particle emitters manager */
  public emitters: Emitters;
  /** Spatial grid for efficient neighbor queries and collision detection */
  public spatialGrid: SpatialGrid;
  /** Width of the simulation area */
  public width: number;
  /** Height of the simulation area */
  public height: number;
  /** Whether the simulation is currently running */
  public isPlaying: boolean = false;
  /** Whether camera frustum culling is enabled */
  public enableFrustumCulling: boolean = false;

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

  /** Z-index tracking for efficient sorting optimization */
  private zIndexCounts: Map<number, number> = new Map();
  private uniqueZIndexCount: number = 0;

  /** Event emitter for system events */
  public events: MittEmitter<SystemEvents>;

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
    this.enableFrustumCulling = options.enableFrustumCulling ?? false;

    this.spatialGrid = new SpatialGrid({
      width: this.width,
      height: this.height,
      cellSize: options.cellSize ?? DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });

    this.emitters = new Emitters();
    this.events = mitt<SystemEvents>();
  }

  /**
   * Adds a particle to the system.
   *
   * @param particle - The particle to add
   */
  addParticle(particle: Particle): void {
    this.particles.push(particle);
    this.trackZIndex(particle.zIndex);
    this.events.emit("particle-added", { particle });
  }

  /**
   * Adds multiple particles to the system.
   *
   * @param particles - Array of particles to add
   */
  addParticles(particles: Particle[]): void {
    // Batch add particles for better performance
    this.particles.push(...particles);

    // Track z-indices for all added particles
    for (const particle of particles) {
      this.trackZIndex(particle.zIndex);
      this.events.emit("particle-added", { particle });
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
      this.untrackZIndex(particle.zIndex);
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
    // Early exit if no particles
    if (this.particles.length === 0) {
      this.emitters.update(deltaTime, this);
      return;
    }

    // Clear and repopulate spatial grid using incremental updates
    this.spatialGrid.clearIncremental(this.particles);

    // Filter particles for processing based on visibility (if frustum culling is enabled)
    const particlesToProcess = this.enableFrustumCulling
      ? this.spatialGrid.getVisibleParticles(this.particles, 100) // 100px padding
      : this.particles;

    for (const particle of this.particles) {
      this.spatialGrid.insert(particle);
    }

    // Filter out disabled forces to avoid unnecessary iterations
    const enabledForces: Force[] = [];
    for (const force of this.forces) {
      // Check if force has an enabled property and if it's enabled
      if ("enabled" in force && typeof (force as any).enabled === "boolean") {
        if ((force as any).enabled) {
          enabledForces.push(force);
        }
      } else {
        // If no enabled property, assume force is always active
        enabledForces.push(force);
      }
    }

    // Early exit if no enabled forces and no physics needed
    if (enabledForces.length === 0) {
      // Still need to update particles for basic physics and lifetime
      for (const particle of this.particles) {
        if (!particle.pinned && !particle.grabbed) {
          particle.update(deltaTime);
        } else {
          particle.velocity.x = 0;
          particle.velocity.y = 0;
        }

        if (particle.duration !== null) {
          particle.interpolateProperties(deltaTime);
        }
      }

      this.emitters.update(deltaTime, this);
      this.removeDeadParticles();
      return;
    }

    // Run before phase for all enabled forces (use all particles for global calculations)
    for (const force of enabledForces) {
      force.before?.(this.particles, deltaTime);
    }

    // Optimized force application: process visible particles first, then off-screen ones
    if (
      this.enableFrustumCulling &&
      particlesToProcess.length < this.particles.length
    ) {
      // Create set of visible particle IDs for efficient lookup
      const visibleParticleIds = new Set(particlesToProcess.map((p) => p.id));

      // Process visible particles with full force calculations
      for (const particle of particlesToProcess) {
        this.processParticleWithForces(particle, enabledForces, deltaTime);
      }

      // Process off-screen particles with minimal updates (just basic physics)
      for (const particle of this.particles) {
        if (!visibleParticleIds.has(particle.id)) {
          this.processParticleBasicPhysics(particle, deltaTime);
        }
      }
    } else {
      // Process all particles normally
      for (const particle of this.particles) {
        this.processParticleWithForces(particle, enabledForces, deltaTime);
      }
    }

    // Apply constraints phase
    for (const force of enabledForces) {
      force.constraints?.(this.particles, this.spatialGrid);
    }

    // Apply after phase
    for (const force of enabledForces) {
      force.after?.(this.particles, deltaTime, this.spatialGrid);
    }

    // Update emitters (spawn new particles)
    this.emitters.update(deltaTime, this);

    // Remove dead particles
    this.removeDeadParticles();
  }

  /**
   * Process a particle with all forces applied
   */
  private processParticleWithForces(
    particle: Particle,
    forces: Force[],
    deltaTime: number
  ): void {
    // Apply all forces to this particle in sequence
    for (const force of forces) {
      force.apply(particle, this.spatialGrid);
    }

    // Update physics immediately after force application
    if (!particle.pinned) {
      particle.update(deltaTime);

      // Reset velocity for grabbed particles after physics update
      if (particle.grabbed) {
        particle.velocity.x = 0;
        particle.velocity.y = 0;
      }
    } else {
      particle.velocity.x = 0;
      particle.velocity.y = 0;
    }

    // Update particle lifetime properties
    if (particle.duration !== null) {
      particle.interpolateProperties(deltaTime);
    }
  }

  /**
   * Process a particle with only basic physics (for off-screen particles)
   */
  private processParticleBasicPhysics(
    particle: Particle,
    deltaTime: number
  ): void {
    // Update physics only (no forces applied)
    if (!particle.pinned) {
      particle.update(deltaTime);

      // Reset velocity for grabbed particles
      if (particle.grabbed) {
        particle.velocity.x = 0;
        particle.velocity.y = 0;
      }
    } else {
      particle.velocity.x = 0;
      particle.velocity.y = 0;
    }

    // Update particle lifetime properties
    if (particle.duration !== null) {
      particle.interpolateProperties(deltaTime);
    }
  }

  /**
   * Efficiently removes dead particles to avoid array reallocations
   */
  private removeDeadParticles(): void {
    // Check if any particles need removal first
    let foundDeadParticle = false;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (particle.mass <= 0 || particle.isDead()) {
        foundDeadParticle = true;
        break;
      }
    }

    if (!foundDeadParticle) return;

    // Use in-place filtering to avoid creating new arrays
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.particles.length; readIndex++) {
      const particle = this.particles[readIndex];
      if (particle.mass > 0 && !particle.isDead()) {
        if (writeIndex !== readIndex) {
          this.particles[writeIndex] = particle;
        }
        writeIndex++;
      } else {
        // Particle is being removed, untrack z-index
        this.untrackZIndex(particle.zIndex);
      }
    }

    // Truncate array to new length
    this.particles.length = writeIndex;
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
    this.emitters.clear();
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
    this.clearZIndexTracking();
    this.emitters.clear();
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

  /**
   * Enable or disable camera frustum culling for performance optimization
   * @param enabled Whether to enable frustum culling
   */
  setFrustumCulling(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
  }

  /**
   * Update camera information for frustum culling
   * @param cameraX Camera X position
   * @param cameraY Camera Y position
   * @param zoom Camera zoom level
   */
  updateCamera(cameraX: number, cameraY: number, zoom: number): void {
    this.spatialGrid.setCamera(cameraX, cameraY, zoom);
  }

  /**
   * Get current frustum culling state
   * @returns Whether frustum culling is enabled
   */
  getFrustumCulling(): boolean {
    return this.enableFrustumCulling;
  }

  /**
   * Set the maximum pool size for spatial grid arrays
   * @param maxSize Maximum number of arrays to pool
   */
  setMaxPoolSize(maxSize: number): void {
    this.spatialGrid.setMaxPoolSize(maxSize);
  }

  /**
   * Get the current maximum pool size
   * @returns Maximum pool size
   */
  getMaxPoolSize(): number {
    return this.spatialGrid.getMaxPoolSize();
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
      } else if (force instanceof Boundary) {
        config.boundary = {
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
          tolerance: force.getGlobalTolerance(),
          enableCollisions: force.enableCollisions,
        };
      }
    }

    // Export emitters configuration
    config.emitters = {
      enabled: this.emitters.getEnabled(),
      emitterConfigs: this.emitters.serialize(),
    };

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
      } else if (force instanceof Boundary && config.boundary) {
        force.bounce = config.boundary.bounce ?? DEFAULT_BOUNDARY_BOUNCE;
        force.setMode(config.boundary.mode ?? DEFAULT_BOUNDARY_MODE);
        force.setRepelDistance(
          config.boundary.repelDistance ?? DEFAULT_BOUNDARY_REPEL_DISTANCE
        );
        force.setRepelStrength(
          config.boundary.repelStrength ?? DEFAULT_BOUNDARY_REPEL_STRENGTH
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
        force.setGlobalTolerance(
          config.joints.tolerance ?? DEFAULT_JOINT_TOLERANCE
        );
        if (config.joints.enableCollisions !== undefined) {
          force.setEnableCollisions(config.joints.enableCollisions);
        }
      }
    }

    // Import emitters configuration
    if (config.emitters) {
      this.emitters.setEnabled(config.emitters.enabled ?? true);
      if (config.emitters.emitterConfigs) {
        this.emitters.deserialize(config.emitters.emitterConfigs);
      }
    }
  }

  /**
   * Z-index tracking methods for efficient sorting optimization
   */

  /**
   * Tracks a z-index value when a particle is added
   */
  private trackZIndex(zIndex: number): void {
    const currentCount = this.zIndexCounts.get(zIndex) || 0;
    this.zIndexCounts.set(zIndex, currentCount + 1);

    if (currentCount === 0) {
      this.uniqueZIndexCount++;
    }
  }

  /**
   * Untracks a z-index value when a particle is removed
   */
  private untrackZIndex(zIndex: number): void {
    const currentCount = this.zIndexCounts.get(zIndex) || 0;
    if (currentCount > 1) {
      this.zIndexCounts.set(zIndex, currentCount - 1);
    } else if (currentCount === 1) {
      this.zIndexCounts.delete(zIndex);
      this.uniqueZIndexCount--;
    }
  }

  /**
   * Clears all z-index tracking
   */
  private clearZIndexTracking(): void {
    this.zIndexCounts.clear();
    this.uniqueZIndexCount = 0;
  }

  /**
   * Returns whether sorting is needed based on z-index diversity
   */
  public needsZIndexSorting(): boolean {
    return this.uniqueZIndexCount > 1;
  }
}
