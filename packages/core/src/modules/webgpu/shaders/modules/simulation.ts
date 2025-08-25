import type { ComputeModuleDescriptor } from "../compute";

export const simulationModule: ComputeModuleDescriptor = {
  name: "simulation",
  role: "simulation",
  // bindings auto-injected as ["dt","count"] by builder
};
