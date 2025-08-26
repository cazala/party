import { simulationModule } from "./simulation";
import { Environment } from "./environment";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";

export { simulationModule, Environment, Boundary, Collisions };

export const defaultComputeModules = [
  simulationModule,
  new Environment(),
  new Boundary(),
  new Collisions(),
];
