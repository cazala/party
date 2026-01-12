import { combineReducers } from "@reduxjs/toolkit";
import { environmentReducer, EnvironmentModuleState } from "./environment";
import { boundaryReducer, BoundaryModuleState } from "./boundary";
import { collisionsReducer, CollisionsModuleState } from "./collisions";
import { fluidsReducer, FluidsModuleState } from "./fluids";
import { behaviorReducer, BehaviorModuleState } from "./behavior";
import { sensorsReducer, SensorsModuleState } from "./sensors";
import { trailsReducer, TrailsModuleState } from "./trails";
import { interactionReducer, InteractionModuleState } from "./interaction";
import { particlesReducer, ParticlesModuleState } from "./particles";
import { jointsReducer, JointsModuleState } from "./joints";
import { linesReducer, LinesModuleState } from "./lines";
import { grabReducer, GrabModuleState } from "./grab";

// Re-export all module types
export type {
  EnvironmentModuleState,
  BoundaryModuleState,
  CollisionsModuleState,
  FluidsModuleState,
  BehaviorModuleState,
  SensorsModuleState,
  TrailsModuleState,
  InteractionModuleState,
  ParticlesModuleState,
  JointsModuleState,
  LinesModuleState,
  GrabModuleState,
};

// Re-export all module actions and reducers
export * from "./environment";
export * from "./boundary";
export * from "./collisions";
export * from "./fluids";
export * from "./behavior";
export * from "./sensors";
export * from "./trails";
export * from "./interaction";
export * from "./particles";
export * from "./joints";
export * from "./lines";
export * from "./grab";

// Re-export combinedReducer for easier imports
export interface ModulesState {
  environment: EnvironmentModuleState;
  boundary: BoundaryModuleState;
  collisions: CollisionsModuleState;
  fluids: FluidsModuleState;
  behavior: BehaviorModuleState;
  sensors: SensorsModuleState;
  trails: TrailsModuleState;
  interaction: InteractionModuleState;
  particles: ParticlesModuleState;
  joints: JointsModuleState;
  lines: LinesModuleState;
  grab: GrabModuleState;
}

export const modulesReducer = combineReducers({
  environment: environmentReducer,
  boundary: boundaryReducer,
  collisions: collisionsReducer,
  fluids: fluidsReducer,
  behavior: behaviorReducer,
  sensors: sensorsReducer,
  trails: trailsReducer,
  interaction: interactionReducer,
  particles: particlesReducer,
  joints: jointsReducer,
  lines: linesReducer,
  grab: grabReducer,
});

// Global selectors
export const selectModules = (state: { modules: ModulesState }) =>
  state.modules;

// Global actions for resetting and importing all modules
export const resetAllModules = {
  type: "modules/resetAll",
};

export const importAllModuleSettings = (payload: any) => ({
  type: "modules/importAll",
  payload,
});
