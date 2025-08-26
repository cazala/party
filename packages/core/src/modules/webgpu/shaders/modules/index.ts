import { simulationModule } from "./simulation";
import { Gravity } from "./gravity";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";

export { simulationModule, Gravity, Boundary, Collisions };

export const defaultComputeModules = [
  simulationModule,
  new Gravity(),
  new Boundary(),
  new Collisions(),
];
