import { simulationModule } from "./simulation";
import { Environment } from "./environment";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";
import { Fluid } from "./fluid";

export { simulationModule, Environment, Boundary, Collisions, Fluid };

export const defaultComputeModules = [
  simulationModule,
  new Environment(),
  new Boundary(),
  new Collisions(),
  new Fluid(),
];
