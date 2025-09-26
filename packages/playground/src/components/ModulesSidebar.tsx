import { EnvironmentModule } from "./modules/EnvironmentModule";
import { BoundaryModule } from "./modules/BoundaryModule";
import { CollisionsModule } from "./modules/CollisionsModule";
import { FluidsModule } from "./modules/FluidsModule";
import { BehaviorModule } from "./modules/BehaviorModule";
import { SensorsModule } from "./modules/SensorsModule";
import { TrailsModule } from "./modules/TrailsModule";
import { InteractionModule } from "./modules/InteractionModule";
import { ModuleWrapper } from "./ModuleWrapper";
import { useEngine } from "../hooks/useEngine";
import { useModules } from "../hooks/useModules";
import "./ModulesSidebar.css";

export function ModulesSidebar() {
  const {
    environment,
    boundary,
    collisions,
    fluids,
    behavior,
    sensors,
    trails,
    interaction,
    isSupported,
  } = useEngine();

  const {
    isEnvironmentEnabled,
    isBoundaryEnabled,
    isCollisionsEnabled,
    isFluidsEnabled,
    isBehaviorEnabled,
    isSensorsEnabled,
    isTrailsEnabled,
    isInteractionEnabled,
    setModuleEnabled,
  } = useModules();

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
      </div>

      <ModuleWrapper
        title="Environment"
        module={environment}
        enabled={isEnvironmentEnabled}
        setEnabled={(enabled) => setModuleEnabled("environment", enabled)}
        isSupported={isSupported(environment)}
      >
        <EnvironmentModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Boundary"
        module={boundary}
        enabled={isBoundaryEnabled}
        setEnabled={(enabled) => setModuleEnabled("boundary", enabled)}
        isSupported={isSupported(boundary)}
      >
        <BoundaryModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Collisions"
        module={collisions}
        enabled={isCollisionsEnabled}
        setEnabled={(enabled) => setModuleEnabled("collisions", enabled)}
        isSupported={isSupported(collisions)}
      >
        <CollisionsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Fluids"
        module={fluids}
        isSupported={isSupported(fluids)}
        enabled={isFluidsEnabled}
        setEnabled={(enabled) => setModuleEnabled("fluids", enabled)}
      >
        <FluidsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Behavior"
        module={behavior}
        isSupported={isSupported(behavior)}
        enabled={isBehaviorEnabled}
        setEnabled={(enabled) => setModuleEnabled("behavior", enabled)}
      >
        <BehaviorModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Trails"
        module={trails}
        isSupported={isSupported(trails)}
        enabled={isTrailsEnabled}
        setEnabled={(enabled) => setModuleEnabled("trails", enabled)}
      >
        <TrailsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Sensors"
        module={sensors}
        isSupported={isSupported(sensors)}
        enabled={isSensorsEnabled}
        setEnabled={(enabled) => setModuleEnabled("sensors", enabled)}
      >
        <SensorsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Interaction"
        module={interaction}
        isSupported={isSupported(interaction)}
        enabled={isInteractionEnabled}
        setEnabled={(enabled) => setModuleEnabled("interaction", enabled)}
      >
        <InteractionModule />
      </ModuleWrapper>
    </div>
  );
}
