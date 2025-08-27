import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type SimKeys =
  | "dt"
  | "count"
  | "minCorrection"
  | "maxCorrection"
  | "restThreshold";

export class Simulation extends ComputeModule<"simulation", SimKeys> {
  constructor() {
    super();
  }
  getMinCorrection(): number {
    const vals = this.read();
    return (vals?.minCorrection as number) ?? 0;
  }
  getMaxCorrection(): number {
    const vals = this.read();
    return (vals.maxCorrection as number) ?? 0;
  }
  getRestThreshold(): number {
    const vals = this.read();
    return (vals?.restThreshold as number) ?? 0;
  }
  setMinCorrection(value: number): void {
    this.write({ minCorrection: value });
  }
  setMaxCorrection(value: number): void {
    this.write({ maxCorrection: value });
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
