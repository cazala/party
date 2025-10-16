import { EnvironmentModule } from "./modules/EnvironmentModule";
import { BoundaryModule } from "./modules/BoundaryModule";
import { CollisionsModule } from "./modules/CollisionsModule";
import { FluidsModule } from "./modules/FluidsModule";
import { BehaviorModule } from "./modules/BehaviorModule";
import { SensorsModule } from "./modules/SensorsModule";
import { InteractionModule } from "./modules/InteractionModule";
import { JointsModule } from "./modules/JointsModule";
import { ModuleWrapper } from "./ModuleWrapper";
import { useEngine } from "../hooks/useEngine";
import {
  useEnvironment,
  useBoundary,
  useCollisions,
  useFluids,
  useBehavior,
  useSensors,
  useInteraction,
  useJoints,
} from "../hooks/modules";
import "./ModulesSidebar.css";

export function ModulesSidebar() {
  const {
    environment,
    boundary,
    collisions,
    fluids,
    behavior,
    sensors,

    interaction,
    joints,
    isSupported,
  } = useEngine();

  const { isEnabled: isEnvironmentEnabled, setEnabled: setEnvironmentEnabled } =
    useEnvironment();
  const { isEnabled: isBoundaryEnabled, setEnabled: setBoundaryEnabled } =
    useBoundary();
  const { isEnabled: isCollisionsEnabled, setEnabled: setCollisionsEnabled } =
    useCollisions();
  const { isEnabled: isFluidsEnabled, setEnabled: setFluidsEnabled } =
    useFluids();
  const { isEnabled: isBehaviorEnabled, setEnabled: setBehaviorEnabled } =
    useBehavior();
  const { isEnabled: isSensorsEnabled, setEnabled: setSensorsEnabled } =
    useSensors();
  const { isEnabled: isInteractionEnabled, setEnabled: setInteractionEnabled } =
    useInteraction();
  const { isEnabled: isJointsEnabled, setEnabled: setJointsEnabled } =
    useJoints();

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
      </div>

      <ModuleWrapper
        title="Environment"
        module={environment}
        enabled={isEnvironmentEnabled}
        setEnabled={setEnvironmentEnabled}
        isSupported={isSupported(environment)}
      >
        <EnvironmentModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Boundary"
        module={boundary}
        enabled={isBoundaryEnabled}
        setEnabled={setBoundaryEnabled}
        isSupported={isSupported(boundary)}
      >
        <BoundaryModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Collisions"
        module={collisions}
        enabled={isCollisionsEnabled}
        setEnabled={setCollisionsEnabled}
        isSupported={isSupported(collisions)}
      >
        <CollisionsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Fluids"
        module={fluids}
        isSupported={isSupported(fluids)}
        enabled={isFluidsEnabled}
        setEnabled={setFluidsEnabled}
      >
        <FluidsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Behavior"
        module={behavior}
        isSupported={isSupported(behavior)}
        enabled={isBehaviorEnabled}
        setEnabled={setBehaviorEnabled}
      >
        <BehaviorModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Sensors"
        module={sensors}
        isSupported={isSupported(sensors)}
        enabled={isSensorsEnabled}
        setEnabled={setSensorsEnabled}
      >
        <SensorsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Joints"
        module={joints}
        isSupported={isSupported(joints)}
        enabled={isJointsEnabled}
        setEnabled={setJointsEnabled}
      >
        <JointsModule />
      </ModuleWrapper>

      <ModuleWrapper
        title="Interaction"
        module={interaction}
        isSupported={isSupported(interaction)}
        enabled={isInteractionEnabled}
        setEnabled={setInteractionEnabled}
      >
        <InteractionModule />
      </ModuleWrapper>
    </div>
  );
}
