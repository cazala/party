import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type SimKeys = "dt" | "count" | "restThreshold";

export class Simulation extends ComputeModule<"simulation", SimKeys> {
  constructor() {
    super();
  }
  getRestThreshold(): number {
    const vals = this.read();
    return (vals?.restThreshold as number) ?? 0;
  }
  setRestThreshold(value: number): void {
    this.write({ restThreshold: value });
  }

  descriptor(): ComputeModuleDescriptor<"simulation", SimKeys> {
    return {
      name: "simulation",
      role: "simulation",
      // bindings auto-injected by builder
    };
  }
}

export const simulationModule = new Simulation();
