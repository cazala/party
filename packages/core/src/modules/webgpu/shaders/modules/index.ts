import { simulationModule } from "./simulation";
import { Gravity } from "./gravity";

export { simulationModule, Gravity };

export const defaultComputeModules = [simulationModule, new Gravity()];
