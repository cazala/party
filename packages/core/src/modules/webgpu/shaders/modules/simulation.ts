import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type SimKeys =
  | "dt"
  | "count"
  | "minCorrection"
  | "maxCorrection"
  | "restThreshold";

export class Simulation extends ComputeModule<"simulation", SimKeys> {
  setMinCorrection(value: number): void {
    (this as any).write?.({ minCorrection: value });
  }
  setMaxCorrection(value: number): void {
    (this as any).write?.({ maxCorrection: value });
  }
  setRestThreshold(value: number): void {
    (this as any).write?.({ restThreshold: value });
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
