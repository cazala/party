import { simulationModule } from "./simulation";
import { Environment } from "./environment";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";
import { Fluid } from "./fluid";
import { Behavior } from "./behavior";
import { Sensors } from "./sensors";
import { Trails } from "./trails";

export {
  simulationModule,
  Environment,
  Boundary,
  Collisions,
  Fluid,
  Behavior,
  Sensors,
  Trails,
};

export const defaultComputeModules = [
  simulationModule,
  new Environment(),
  new Boundary(),
  new Collisions(),
  new Behavior(),
  new Fluid(),
  new Trails(),
  new Sensors(),
];
