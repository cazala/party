import { simulationModule } from "./simulation";
import { Gravity } from "./gravity";
import { Boundary } from "./boundary";

export { simulationModule, Gravity, Boundary };

export const defaultComputeModules = [
  simulationModule,
  new Gravity(),
  new Boundary(),
];
