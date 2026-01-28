// Centralized list of modules that are affected by restart and should be restored on quickload
export const RESTART_AFFECTED_MODULES = [
  "environment",
  "boundary",
  "collisions",
  "fluids",
  "behavior",
  "sensors",
  "interaction",
  "gameOfLife",
  "reactionDiffusion",
  "elementaryCa",
];

export type RestartAffectedModule = (typeof RESTART_AFFECTED_MODULES)[number];
