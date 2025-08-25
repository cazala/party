import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

export class Simulation extends ComputeModule<"simulation", "dt" | "count"> {
  descriptor(): ComputeModuleDescriptor<"simulation", "dt" | "count"> {
    return {
      name: "simulation",
      role: "simulation",
      // bindings auto-injected as ["dt","count"] by builder
    };
  }
}

export const simulationModule = new Simulation();
