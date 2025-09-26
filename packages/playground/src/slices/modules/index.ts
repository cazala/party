// Re-export all module types
export * from "./types";

// Re-export all module actions and reducers
export * from "./environment";
export * from "./boundary";
export * from "./collisions";
export * from "./fluids";
export * from "./behavior";
export * from "./sensors";
export * from "./trails";
export * from "./interaction";
export * from "./particle";

// Re-export combinedReducer for easier imports
import { combineReducers } from "@reduxjs/toolkit";
import { environmentReducer } from "./environment";
import { boundaryReducer } from "./boundary";
import { collisionsReducer } from "./collisions";
import { fluidsReducer } from "./fluids";
import { behaviorReducer } from "./behavior";
import { sensorsReducer } from "./sensors";
import { trailsReducer } from "./trails";
import { interactionReducer } from "./interaction";
import { particleReducer } from "./particle";

export const modulesReducer = combineReducers({
  environment: environmentReducer,
  boundary: boundaryReducer,
  collisions: collisionsReducer,
  fluids: fluidsReducer,
  behavior: behaviorReducer,
  sensors: sensorsReducer,
  trails: trailsReducer,
  interaction: interactionReducer,
  particle: particleReducer,
});

// Global actions for resetting and importing all modules
export const resetAllModules = {
  type: "modules/resetAll",
};

export const importAllModuleSettings = (payload: any) => ({
  type: "modules/importAll",
  payload,
});