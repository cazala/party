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
  DEFAULT_BOUNDS_FRICTION,
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
  DEFAULT_WOBBLE_FACTOR,
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
  SensorBehavior,
} from "./forces/sensors";
import {
  Joints,
  DEFAULT_JOINTS_ENABLED,
  DEFAULT_JOINT_STIFFNESS,
  DEFAULT_JOINT_DAMPING,
  DEFAULT_JOINT_MAX_FORCE,
} from "./forces/joints";

export interface Force {
  warmup?(particles: Particle[], deltaTime: number): void;
  apply(particle: Particle, spatialGrid: SpatialGrid): void;
  clear?(): void;
}

export interface Config {
  physics?: {
    gravity?: {
      strength?: number;
      direction?: { x?: number; y?: number };
    };
    inertia?: number;
    friction?: number;
  };
  // Legacy support for old configs
  gravity?: {
    strength?: number;
    direction?: { x?: number; y?: number };
  };
  bounds?: {
    bounce?: number;
    friction?: number;
    mode?: "bounce" | "kill" | "warp";
    repelDistance?: number;
    repelStrength?: number;
  };
  collisions?: {
    enabled?: boolean;
    eat?: boolean;
  };
  behavior?: {
    enabled?: boolean;
    wanderWeight?: number;
    cohesionWeight?: number;
    alignmentWeight?: number;
    separationWeight?: number;
    chaseWeight?: number;
    avoidWeight?: number;
    separationRange?: number;
    viewRadius?: number;
    viewAngle?: number;
  };
  fluid?: {
    enabled?: boolean;
    influenceRadius?: number;
    targetDensity?: number;
    pressureMultiplier?: number;
    wobbleFactor?: number;
    resistance?: number;
  };
  sensors?: {
    enableTrail?: boolean;
    trailDecay?: number;
    trailDiffuse?: number;
    enableSensors?: boolean;
    sensorDistance?: number;
    sensorAngle?: number;
    sensorRadius?: number;
    sensorThreshold?: number;
    sensorStrength?: number;
    followBehavior?: SensorBehavior;
    fleeBehavior?: SensorBehavior;
  };
  joints?: {
    enabled?: boolean;
    defaultStiffness?: number;
    defaultDamping?: number;
    defaultMaxForce?: number;
  };
  system?: {
    momentumPreservation?: number;
  };
}

// Default constants for ParticleSystem
export const DEFAULT_SPATIAL_GRID_CELL_SIZE = 100;
export const DEFAULT_MOMENTUM_PRESERVATION = 0.7;

export interface SystemOptions {
  width: number;
  height: number;
  cellSize?: number;
  momentumPreservation?: number;
}

export class System {
  public particles: Particle[] = [];
  public forces: Force[] = [];
  public spatialGrid: SpatialGrid;
  public width: number;
  public height: number;
  public isPlaying: boolean = false;
  public momentumPreservation: number;

  private lastTime: number = 0;
  private animationId: number | null = null;

  // FPS tracking
  private fpsFrameTimes: number[] = [];
  private fpsMaxSamples: number = 60; // Track last 60 frames
  private currentFPS: number = 0;

  private renderCallback?: (system: System) => void;

  constructor(options: SystemOptions) {
    this.width = options.width;
    this.height = options.height;
    this.momentumPreservation =
      options.momentumPreservation ?? DEFAULT_MOMENTUM_PRESERVATION;

    this.spatialGrid = new SpatialGrid({
      width: this.width,
      height: this.height,
      cellSize: options.cellSize ?? DEFAULT_SPATIAL_GRID_CELL_SIZE,
    });
  }

  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  addParticles(particles: Particle[]): void {
    for (const particle of particles) {
      this.addParticle(particle);
    }
  }

  getParticle(id: number): Particle | null {
    const particle = this.particles.find((particle) => particle.id === id);
    return particle || null;
  }

  removeParticle(particle: Particle): void {
    const index = this.particles.indexOf(particle);
    if (index > -1) {
      this.particles.splice(index, 1);
    }
  }

  setMomentumPreservation(value: number): void {
    this.momentumPreservation = Math.max(0, Math.min(1, value)); // Clamp between 0 and 1
  }

  addForce(force: Force): void {
    this.forces.push(force);
  }

  removeForce(force: Force): void {
    const index = this.forces.indexOf(force);
    if (index > -1) {
      this.forces.splice(index, 1);
    }
  }

  clearForces(): void {
    this.forces = [];
  }

  update(deltaTime: number): void {
    // Clear and repopulate spatial grid
    this.spatialGrid.clear();

    for (const particle of this.particles) {
      this.spatialGrid.insert(particle);
    }

    for (const force of this.forces) {
      force.warmup?.(this.particles, deltaTime);
    }

    // Store positions before physics integration for constraint velocity correction
    const prePhysicsPositions = new Map<number, Vector2D>();
    for (const particle of this.particles) {
      prePhysicsPositions.set(particle.id, particle.position.clone());
    }

    for (const particle of this.particles) {
      for (const force of this.forces) {
        force.apply(particle, this.spatialGrid);
      }
      if (!particle.static) {
        particle.update(deltaTime);
      } else {
        particle.velocity.x = 0;
        particle.velocity.y = 0;
      }
    }

    // Apply joint constraints AFTER physics integration to preserve natural motion
    const jointsForce = this.forces.find((force) => force instanceof Joints);
    if (jointsForce && "applyConstraints" in jointsForce) {
      (jointsForce as any).applyConstraints();

      // Update velocities to match actual movement after constraint solving
      if (deltaTime > 0) {
        for (const particle of this.particles) {
          if (!particle.static && jointsForce.hasJoint(particle.id)) {
            const prePhysicsPosition = prePhysicsPositions.get(particle.id);
            if (prePhysicsPosition) {
              // Calculate total actual movement from start to end
              const totalMovement = particle.position
                .clone()
                .subtract(prePhysicsPosition);
              const actualVelocity = totalMovement.divide(deltaTime);

              const momentum =
                jointsForce.getJointsForParticle(particle).length < 3
                  ? 0.75
                  : 0.95;

              // Blend between current velocity and actual movement based on momentum preservation
              particle.velocity = particle.velocity
                .clone()
                .multiply(1 - momentum)
                .add(actualVelocity.multiply(momentum));
            }
          }
        }
      }
    }

    // Remove eaten particles (marked with mass = 0)
    this.particles = this.particles.filter((particle) => particle.mass > 0);
  }

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.animate();
  }

  pause(): void {
    this.isPlaying = false;
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

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
          friction: force.friction,
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
          wobbleFactor: force.wobbleFactor,
          resistance: force.resistance,
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
        };
      } else if (force instanceof Joints) {
        config.joints = {
          enabled: force.enabled,
          defaultStiffness: force.defaultStiffness,
          defaultDamping: force.defaultDamping,
          defaultMaxForce: force.defaultMaxForce,
        };
      }
    }

    // Export system settings
    config.system = {
      momentumPreservation: this.momentumPreservation,
    };

    return config;
  }

  import(config: Config): void {
    // Apply configuration for each force type present in the system
    for (const force of this.forces) {
      if (force instanceof Physics) {
        // Handle new physics config format
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
        // Handle legacy gravity config for backward compatibility
        else if (config.gravity) {
          force.setStrength(
            config.gravity.strength ?? DEFAULT_GRAVITY_STRENGTH
          );
          force.setDirection(
            new Vector2D(
              config.gravity.direction?.x ?? DEFAULT_GRAVITY_DIRECTION.x,
              config.gravity.direction?.y ?? DEFAULT_GRAVITY_DIRECTION.y
            )
          );
          force.setInertia(DEFAULT_INERTIA);
          force.setFriction(DEFAULT_FRICTION);
        }
      } else if (force instanceof Bounds && config.bounds) {
        force.bounce = config.bounds.bounce ?? DEFAULT_BOUNDS_BOUNCE;
        force.setFriction(config.bounds.friction ?? DEFAULT_BOUNDS_FRICTION);
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
        force.wobbleFactor = config.fluid.wobbleFactor ?? DEFAULT_WOBBLE_FACTOR;
        force.resistance = config.fluid.resistance ?? 1; // Default resistance value
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
      } else if (force instanceof Joints && config.joints) {
        force.setEnabled(config.joints.enabled ?? DEFAULT_JOINTS_ENABLED);
        force.setDefaultStiffness(
          config.joints.defaultStiffness ?? DEFAULT_JOINT_STIFFNESS
        );
        force.setDefaultDamping(
          config.joints.defaultDamping ?? DEFAULT_JOINT_DAMPING
        );
        force.setDefaultMaxForce(
          config.joints.defaultMaxForce ?? DEFAULT_JOINT_MAX_FORCE
        );
      }
    }

    // Import system settings
    if (config.system) {
      this.setMomentumPreservation(
        config.system.momentumPreservation ?? DEFAULT_MOMENTUM_PRESERVATION
      );
    }
  }
}
