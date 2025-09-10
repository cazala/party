import { simulationModule } from "./simulation";
import { Environment } from "./environment";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";
import { Fluid } from "./fluid";
import { Behavior } from "./behavior";
import { Sensors } from "./sensors";

export { simulationModule, Environment, Boundary, Collisions, Fluid, Behavior, Sensors };

export const defaultComputeModules = [
  simulationModule,
  new Environment(),
  new Boundary(),
  new Collisions(),
  new Behavior(),
  new Fluid(),
  new Sensors(),
];
