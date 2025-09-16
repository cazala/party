import { simulationModule } from "./simulation";
import { Environment } from "./environment";
import { Boundary } from "./boundary";
import { Collisions } from "./collisions";
import { Fluid } from "./fluid";
import { Behavior } from "./behavior";
import { Sensors } from "./sensors";
import { Trails } from "./trails";
import { Interaction } from "./interaction";
import { Grid, gridModule } from "./grid";

export {
  simulationModule,
  Environment,
  Boundary,
  Collisions,
  Fluid,
  Behavior,
  Sensors,
  Trails,
  Interaction,
  Grid,
};

export const defaultComputeModules = [
  simulationModule,
  gridModule,
  new Environment(),
  new Boundary(),
  new Collisions(),
  new Behavior(),
  new Fluid(),
  new Trails(),
  new Sensors(),
  new Interaction(),
];
