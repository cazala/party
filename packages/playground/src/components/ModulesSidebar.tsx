import { useState } from "react";
import {
  Environment,
  Boundary,
  Collisions,
  Fluid,
  Behavior,
  Sensors,
  Trails,
  Interaction,
} from "@cazala/party";
import { EnvironmentModule } from "./modules/EnvironmentModule";
import { BoundaryModule } from "./modules/BoundaryModule";
import { CollisionsModule } from "./modules/CollisionsModule";
import { FluidModule } from "./modules/FluidModule";
import { BehaviorModule } from "./modules/BehaviorModule";
import { SensorsModule } from "./modules/SensorsModule";
import { TrailsModule } from "./modules/TrailsModule";
import { WebGPUInteractionControls } from "./modules/InteractionModule";
import { ModuleWrapper } from "./ModuleWrapper";

export function ModulesSidebar({
  environment,
  boundary,
  collisions,
  fluid,
  behavior,
  sensors,
  trails,
  interaction,
  isSupported,
  isInitialized,
  isInitializing,
}: {
  environment: Environment | null;
  boundary: Boundary | null;
  collisions: Collisions | null;
  fluid: Fluid | null;
  behavior: Behavior | null;
  sensors: Sensors | null;
  trails: Trails | null;
  interaction: Interaction | null;
  isSupported: (module: any) => boolean;
  isInitialized: boolean;
  isInitializing: boolean;
}) {
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);
  const [collisionsEnabled, setCollisionsEnabled] = useState(true);
  const [fluidEnabled, setFluidEnabled] = useState(false);
  const [behaviorEnabled, setBehaviorEnabled] = useState(false);
  const [sensorsEnabled, setSensorsEnabled] = useState(false);
  const [trailsEnabled, setTrailsEnabled] = useState(false);
  const [interactionEnabled, setInteractionEnabled] = useState(false);

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
      </div>

      <ModuleWrapper
        title="Environment"
        module={environment}
        enabled={environmentEnabled}
        setEnabled={setEnvironmentEnabled}
      >
        <EnvironmentModule environment={environment} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Boundary"
        module={boundary}
        enabled={boundaryEnabled}
        setEnabled={setBoundaryEnabled}
      >
        <BoundaryModule boundary={boundary} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Collisions"
        module={collisions}
        enabled={collisionsEnabled}
        setEnabled={setCollisionsEnabled}
      >
        <CollisionsModule collisions={collisions} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Fluids"
        module={fluid}
        isSupported={isSupported(fluid)}
        enabled={fluidEnabled}
        setEnabled={setFluidEnabled}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
        syncValues={() => {
          // This will be called by ModuleWrapper to sync values
        }}
      >
        <FluidModule fluid={fluid} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Behavior"
        module={behavior}
        isSupported={isSupported(behavior)}
        enabled={behaviorEnabled}
        setEnabled={setBehaviorEnabled}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
        syncValues={() => {
          // This will be called by ModuleWrapper to sync values
        }}
      >
        <BehaviorModule behavior={behavior} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Trails"
        module={trails}
        enabled={trailsEnabled}
        setEnabled={setTrailsEnabled}
      >
        <TrailsModule trails={trails} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Sensors"
        module={sensors}
        isSupported={isSupported(sensors)}
        enabled={sensorsEnabled}
        setEnabled={setSensorsEnabled}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
        syncValues={() => {
          // This will be called by ModuleWrapper to sync values
        }}
      >
        <SensorsModule sensors={sensors} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Interaction"
        module={interaction}
        isSupported={isSupported(interaction)}
        enabled={interactionEnabled}
        setEnabled={setInteractionEnabled}
      >
        <WebGPUInteractionControls interaction={interaction} />
      </ModuleWrapper>
    </div>
  );
}
