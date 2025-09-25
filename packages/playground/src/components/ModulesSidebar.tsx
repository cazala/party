import {
  Environment,
  Boundary,
  Collisions,
  Fluids,
  Behavior,
  Sensors,
  Trails,
  Interaction,
} from "@cazala/party";
import { EnvironmentModule } from "./modules/EnvironmentModule";
import { BoundaryModule } from "./modules/BoundaryModule";
import { CollisionsModule } from "./modules/CollisionsModule";
import { FluidsModule } from "./modules/FluidsModule";
import { BehaviorModule } from "./modules/BehaviorModule";
import { SensorsModule } from "./modules/SensorsModule";
import { TrailsModule } from "./modules/TrailsModule";
import { InteractionModule } from "./modules/InteractionModule";
import { ModuleWrapper } from "./ModuleWrapper";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import { selectModulesState, setModuleEnabled } from "../modules/modules/slice";
import { selectEngineState } from "../modules/engine/slice";
import "./ModulesSidebar.css";

export function ModulesSidebar({
  environment,
  boundary,
  collisions,
  fluids,
  behavior,
  sensors,
  trails,
  interaction,
  isSupported,
}: {
  environment: Environment | null;
  boundary: Boundary | null;
  collisions: Collisions | null;
  fluids: Fluids | null;
  behavior: Behavior | null;
  sensors: Sensors | null;
  trails: Trails | null;
  interaction: Interaction | null;
  isSupported: (module: any) => boolean;
}) {
  const dispatch = useAppDispatch();
  const modulesState = useAppSelector(selectModulesState);
  const engineState = useAppSelector(selectEngineState);
  const { isInitialized, isInitializing } = engineState;
  
  // Get enabled states from Redux
  const environmentEnabled = modulesState.environment.enabled;
  const boundaryEnabled = modulesState.boundary.enabled;
  const collisionsEnabled = modulesState.collisions.enabled;
  const fluidsEnabled = modulesState.fluids.enabled;
  const behaviorEnabled = modulesState.behavior.enabled;
  const sensorsEnabled = modulesState.sensors.enabled;
  const trailsEnabled = modulesState.trails.enabled;
  const interactionEnabled = modulesState.interaction.enabled;
  
  // Helper to handle module enabled/disabled
  const handleModuleEnabledChange = (module: keyof typeof modulesState, enabled: boolean) => {
    dispatch(setModuleEnabled({ module, enabled }));
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
      </div>

      <ModuleWrapper
        title="Environment"
        module={environment}
        enabled={environmentEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('environment', enabled)}
        isSupported={isSupported(environment)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <EnvironmentModule environment={environment} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Boundary"
        module={boundary}
        enabled={boundaryEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('boundary', enabled)}
        isSupported={isSupported(boundary)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <BoundaryModule boundary={boundary} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Collisions"
        module={collisions}
        enabled={collisionsEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('collisions', enabled)}
        isSupported={isSupported(collisions)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <CollisionsModule collisions={collisions} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Fluids"
        module={fluids}
        isSupported={isSupported(fluids)}
        enabled={fluidsEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('fluids', enabled)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <FluidsModule fluids={fluids} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Behavior"
        module={behavior}
        isSupported={isSupported(behavior)}
        enabled={behaviorEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('behavior', enabled)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <BehaviorModule behavior={behavior} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Trails"
        module={trails}
        enabled={trailsEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('trails', enabled)}
      >
        <TrailsModule trails={trails} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Sensors"
        module={sensors}
        isSupported={isSupported(sensors)}
        enabled={sensorsEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('sensors', enabled)}
        isInitialized={isInitialized}
        isInitializing={isInitializing}
      >
        <SensorsModule sensors={sensors} />
      </ModuleWrapper>

      <ModuleWrapper
        title="Interaction"
        module={interaction}
        isSupported={isSupported(interaction)}
        enabled={interactionEnabled}
        setEnabled={(enabled) => handleModuleEnabledChange('interaction', enabled)}
      >
        <InteractionModule interaction={interaction} />
      </ModuleWrapper>
    </div>
  );
}
