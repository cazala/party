import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type SimKeys = "dt" | "count";

export class Simulation extends ComputeModule<"simulation", SimKeys> {
  constructor() {
    super();
  }

  descriptor(): ComputeModuleDescriptor<"simulation", SimKeys> {
    return {
      name: "simulation",
      role: "simulation",
      bindings: ["dt", "count"],
    };
  }
}

export const simulationModule = new Simulation();
