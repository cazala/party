// Shared module state interfaces
export interface EnvironmentModuleState {
  enabled: boolean;
  gravityStrength: number;
  dirX: number;
  dirY: number;
  inertia: number;
  friction: number;
  damping: number;
  mode: string;
}

export interface BoundaryModuleState {
  enabled: boolean;
  restitution: number;
  friction: number;
  mode: "bounce" | "warp" | "kill" | "none";
  repelDistance: number;
  repelStrength: number;
}

export interface CollisionsModuleState {
  enabled: boolean;
  restitution: number;
}

export interface FluidsModuleState {
  enabled: boolean;
  influenceRadius: number;
  targetDensity: number;
  pressureMultiplier: number;
  viscosity: number;
  nearPressureMultiplier: number;
  nearThreshold: number;
  enableNearPressure: boolean;
  maxAcceleration: number;
}

export interface BehaviorModuleState {
  enabled: boolean;
  wander: number;
  cohesion: number;
  alignment: number;
  repulsion: number;
  chase: number;
  avoid: number;
  separation: number;
  viewRadius: number;
  viewAngle: number; // stored in radians, displayed in degrees
}

export interface SensorsModuleState {
  enabled: boolean;
  sensorDistance: number;
  sensorAngle: number; // stored in radians, displayed in degrees
  sensorRadius: number;
  sensorThreshold: number;
  sensorStrength: number;
  followValue: string;
  fleeValue: string;
  colorSimilarityThreshold: number;
  fleeAngle: number; // stored in radians, displayed in degrees
}

export interface TrailsModuleState {
  enabled: boolean;
  trailDecay: number;
  trailDiffuse: number;
}

export interface InteractionModuleState {
  enabled: boolean;
  mode: "attract" | "repel";
  strength: number;
  radius: number;
}

export interface ParticleModuleState {
  enabled: boolean;
  // Add specific particle rendering properties as needed
}

export interface ModulesState {
  environment: EnvironmentModuleState;
  boundary: BoundaryModuleState;
  collisions: CollisionsModuleState;
  fluids: FluidsModuleState;
  behavior: BehaviorModuleState;
  sensors: SensorsModuleState;
  trails: TrailsModuleState;
  interaction: InteractionModuleState;
  particle: ParticleModuleState;
}