import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Module state interfaces based on the @party/core modules
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

const initialState: ModulesState = {
  environment: {
    enabled: true,
    gravityStrength: 0,
    dirX: 0,
    dirY: 1,
    inertia: 0,
    friction: 0,
    damping: 0,
    mode: "normal",
  },
  boundary: {
    enabled: true,
    restitution: 0.6,
    friction: 0.1,
    mode: "bounce",
    repelDistance: 0,
    repelStrength: 0,
  },
  collisions: {
    enabled: true,
    restitution: 0.8,
  },
  fluids: {
    enabled: false,
    influenceRadius: 100,
    targetDensity: 1,
    pressureMultiplier: 30,
    viscosity: 1,
    nearPressureMultiplier: 50,
    nearThreshold: 20,
    enableNearPressure: true,
    maxAcceleration: 75,
  },
  behavior: {
    enabled: false,
    wander: 5,
    cohesion: 1,
    alignment: 1,
    repulsion: 2,
    chase: 0,
    avoid: 0,
    separation: 25,
    viewRadius: 50,
    viewAngle: Math.PI / 3, // 60 degrees in radians
  },
  sensors: {
    enabled: false,
    sensorDistance: 10,
    sensorAngle: Math.PI / 6, // 30 degrees in radians
    sensorRadius: 3,
    sensorThreshold: 0.1,
    sensorStrength: 100,
    followValue: "none",
    fleeValue: "none",
    colorSimilarityThreshold: 0.8,
    fleeAngle: Math.PI, // 180 degrees in radians
  },
  trails: {
    enabled: false,
    trailDecay: 10,
    trailDiffuse: 1,
  },
  interaction: {
    enabled: false,
    mode: "attract",
    strength: 10000,
    radius: 500,
  },
  particle: {
    enabled: true,
  },
};

export const modulesSlice = createSlice({
  name: "modules",
  initialState,
  reducers: {
    // Generic actions for any module
    setModuleEnabled: (
      state,
      action: PayloadAction<{ module: keyof ModulesState; enabled: boolean }>
    ) => {
      const { module, enabled } = action.payload;
      state[module].enabled = enabled;
    },
    setModuleProperty: (
      state,
      action: PayloadAction<{
        module: keyof ModulesState;
        property: string;
        value: any;
      }>
    ) => {
      const { module, property, value } = action.payload;
      (state[module] as any)[property] = value;
    },
    updateModuleState: (
      state,
      action: PayloadAction<{
        module: keyof ModulesState;
        updates: Partial<any>;
      }>
    ) => {
      const { module, updates } = action.payload;
      Object.assign(state[module], updates);
    },

    // Environment specific actions
    setEnvironmentGravityStrength: (state, action: PayloadAction<number>) => {
      state.environment.gravityStrength = action.payload;
    },
    setEnvironmentInertia: (state, action: PayloadAction<number>) => {
      state.environment.inertia = action.payload;
    },
    setEnvironmentFriction: (state, action: PayloadAction<number>) => {
      state.environment.friction = action.payload;
    },
    setEnvironmentDamping: (state, action: PayloadAction<number>) => {
      state.environment.damping = action.payload;
    },
    setEnvironmentDirection: (
      state,
      action: PayloadAction<{ dirX: number; dirY: number }>
    ) => {
      state.environment.dirX = action.payload.dirX;
      state.environment.dirY = action.payload.dirY;
    },

    // Boundary specific actions
    setBoundaryMode: (
      state,
      action: PayloadAction<BoundaryModuleState["mode"]>
    ) => {
      state.boundary.mode = action.payload;
    },
    setBoundaryRestitution: (state, action: PayloadAction<number>) => {
      state.boundary.restitution = action.payload;
    },
    setBoundaryFriction: (state, action: PayloadAction<number>) => {
      state.boundary.friction = action.payload;
    },
    setBoundaryRepelDistance: (state, action: PayloadAction<number>) => {
      state.boundary.repelDistance = action.payload;
    },
    setBoundaryRepelStrength: (state, action: PayloadAction<number>) => {
      state.boundary.repelStrength = action.payload;
    },

    // Collisions specific actions
    setCollisionsRestitution: (state, action: PayloadAction<number>) => {
      state.collisions.restitution = action.payload;
    },

    // Interaction specific actions
    setInteractionMode: (
      state,
      action: PayloadAction<InteractionModuleState["mode"]>
    ) => {
      state.interaction.mode = action.payload;
    },
    setInteractionStrength: (state, action: PayloadAction<number>) => {
      state.interaction.strength = action.payload;
    },
    setInteractionRadius: (state, action: PayloadAction<number>) => {
      state.interaction.radius = action.payload;
    },

    // Fluids specific actions
    setFluidsInfluenceRadius: (state, action: PayloadAction<number>) => {
      state.fluids.influenceRadius = action.payload;
    },
    setFluidsTargetDensity: (state, action: PayloadAction<number>) => {
      state.fluids.targetDensity = action.payload;
    },
    setFluidsPressureMultiplier: (state, action: PayloadAction<number>) => {
      state.fluids.pressureMultiplier = action.payload;
    },
    setFluidsViscosity: (state, action: PayloadAction<number>) => {
      state.fluids.viscosity = action.payload;
    },
    setFluidsNearPressureMultiplier: (state, action: PayloadAction<number>) => {
      state.fluids.nearPressureMultiplier = action.payload;
    },
    setFluidsNearThreshold: (state, action: PayloadAction<number>) => {
      state.fluids.nearThreshold = action.payload;
    },
    setFluidsEnableNearPressure: (state, action: PayloadAction<boolean>) => {
      state.fluids.enableNearPressure = action.payload;
    },
    setFluidsMaxAcceleration: (state, action: PayloadAction<number>) => {
      state.fluids.maxAcceleration = action.payload;
    },

    // Behavior specific actions
    setBehaviorWander: (state, action: PayloadAction<number>) => {
      state.behavior.wander = action.payload;
    },
    setBehaviorCohesion: (state, action: PayloadAction<number>) => {
      state.behavior.cohesion = action.payload;
    },
    setBehaviorAlignment: (state, action: PayloadAction<number>) => {
      state.behavior.alignment = action.payload;
    },
    setBehaviorRepulsion: (state, action: PayloadAction<number>) => {
      state.behavior.repulsion = action.payload;
    },
    setBehaviorChase: (state, action: PayloadAction<number>) => {
      state.behavior.chase = action.payload;
    },
    setBehaviorAvoid: (state, action: PayloadAction<number>) => {
      state.behavior.avoid = action.payload;
    },
    setBehaviorSeparation: (state, action: PayloadAction<number>) => {
      state.behavior.separation = action.payload;
    },
    setBehaviorViewRadius: (state, action: PayloadAction<number>) => {
      state.behavior.viewRadius = action.payload;
    },
    setBehaviorViewAngle: (state, action: PayloadAction<number>) => {
      state.behavior.viewAngle = action.payload;
    },

    // Sensors specific actions
    setSensorDistance: (state, action: PayloadAction<number>) => {
      state.sensors.sensorDistance = action.payload;
    },
    setSensorAngle: (state, action: PayloadAction<number>) => {
      state.sensors.sensorAngle = action.payload;
    },
    setSensorRadius: (state, action: PayloadAction<number>) => {
      state.sensors.sensorRadius = action.payload;
    },
    setSensorThreshold: (state, action: PayloadAction<number>) => {
      state.sensors.sensorThreshold = action.payload;
    },
    setSensorStrength: (state, action: PayloadAction<number>) => {
      state.sensors.sensorStrength = action.payload;
    },
    setSensorFollowValue: (state, action: PayloadAction<string>) => {
      state.sensors.followValue = action.payload;
    },
    setSensorFleeValue: (state, action: PayloadAction<string>) => {
      state.sensors.fleeValue = action.payload;
    },
    setSensorColorSimilarityThreshold: (
      state,
      action: PayloadAction<number>
    ) => {
      state.sensors.colorSimilarityThreshold = action.payload;
    },
    setSensorFleeAngle: (state, action: PayloadAction<number>) => {
      state.sensors.fleeAngle = action.payload;
    },

    // Trails specific actions
    setTrailsDecay: (state, action: PayloadAction<number>) => {
      state.trails.trailDecay = action.payload;
    },
    setTrailsDiffuse: (state, action: PayloadAction<number>) => {
      state.trails.trailDiffuse = action.payload;
    },

    // Reset all modules
    resetModules: () => initialState,

    // Import/export module settings (for engine switching)
    importModuleSettings: (
      state,
      action: PayloadAction<Partial<ModulesState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setModuleEnabled,
  setModuleProperty,
  updateModuleState,
  setEnvironmentGravityStrength,
  setEnvironmentInertia,
  setEnvironmentFriction,
  setEnvironmentDamping,
  setEnvironmentDirection,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
  setCollisionsRestitution,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
  setBehaviorWander,
  setBehaviorCohesion,
  setBehaviorAlignment,
  setBehaviorRepulsion,
  setBehaviorChase,
  setBehaviorAvoid,
  setBehaviorSeparation,
  setBehaviorViewRadius,
  setBehaviorViewAngle,
  setSensorDistance,
  setSensorAngle,
  setSensorRadius,
  setSensorThreshold,
  setSensorStrength,
  setSensorFollowValue,
  setSensorFleeValue,
  setSensorColorSimilarityThreshold,
  setSensorFleeAngle,
  setTrailsDecay,
  setTrailsDiffuse,
  resetModules,
  importModuleSettings,
} = modulesSlice.actions;

export const modulesReducer = modulesSlice.reducer;

// Selectors
export const selectModulesState = (state: { modules: ModulesState }) =>
  state.modules;
export const selectEnvironmentModule = (state: { modules: ModulesState }) =>
  state.modules.environment;
export const selectBoundaryModule = (state: { modules: ModulesState }) =>
  state.modules.boundary;
export const selectCollisionsModule = (state: { modules: ModulesState }) =>
  state.modules.collisions;
export const selectFluidsModule = (state: { modules: ModulesState }) =>
  state.modules.fluids;
export const selectBehaviorModule = (state: { modules: ModulesState }) =>
  state.modules.behavior;
export const selectSensorsModule = (state: { modules: ModulesState }) =>
  state.modules.sensors;
export const selectTrailsModule = (state: { modules: ModulesState }) =>
  state.modules.trails;
export const selectInteractionModule = (state: { modules: ModulesState }) =>
  state.modules.interaction;
export const selectParticleModule = (state: { modules: ModulesState }) =>
  state.modules.particle;

// Generic module selector
export const selectModule =
  (moduleName: keyof ModulesState) => (state: { modules: ModulesState }) =>
    state.modules[moduleName];

// Module enabled selectors
export const selectModuleEnabled =
  (moduleName: keyof ModulesState) => (state: { modules: ModulesState }) =>
    state.modules[moduleName].enabled;
