import { RotateCcw } from "lucide-react";
import { EnvironmentModule } from "./modules/EnvironmentModule";
import { BoundaryModule } from "./modules/BoundaryModule";
import { CollisionsModule } from "./modules/CollisionsModule";
import { FluidsModule } from "./modules/FluidsModule";
import { BehaviorModule } from "./modules/BehaviorModule";
import { SensorsModule } from "./modules/SensorsModule";
import { JointsModule } from "./modules/JointsModule";
import { PicflipModule } from "./modules/PicflipModule";
import { ModuleWrapper } from "./ModuleWrapper";
import { useEngine } from "../hooks/useEngine";
import { useOscillators } from "../hooks/useOscillators";
import { useReset } from "../contexts/ResetContext";
import {
  useEnvironment,
  useBoundary,
  useCollisions,
  useFluids,
  useBehavior,
  useSensors,
  useJoints,
  usePicflip,
} from "../hooks/modules";
import { RESTART_AFFECTED_MODULES } from "../constants/modules";
import "./ModulesSidebar.css";

export function ModulesSidebar() {
  const {
    environment,
    boundary,
    collisions,
    fluids,
    behavior,
    sensors,
    joints,
    picflip,
    isSupported,
  } = useEngine();

  const { clearModuleOscillators } = useOscillators();
  const { setIsResetting } = useReset();

  const {
    isEnabled: isEnvironmentEnabled,
    setEnabled: setEnvironmentEnabled,
    reset: resetEnvironment,
  } = useEnvironment();
  const {
    isEnabled: isBoundaryEnabled,
    setEnabled: setBoundaryEnabled,
    reset: resetBoundary,
  } = useBoundary();
  const {
    isEnabled: isCollisionsEnabled,
    setEnabled: setCollisionsEnabled,
    reset: resetCollisions,
  } = useCollisions();
  const {
    isEnabled: isFluidsEnabled,
    setEnabled: setFluidsEnabled,
    reset: resetFluids,
  } = useFluids();
  const {
    isEnabled: isBehaviorEnabled,
    setEnabled: setBehaviorEnabled,
    reset: resetBehavior,
  } = useBehavior();
  const {
    isEnabled: isSensorsEnabled,
    setEnabled: setSensorsEnabled,
    reset: resetSensors,
  } = useSensors();
  const {
    isEnabled: isJointsEnabled,
    setEnabled: setJointsEnabled,
    reset: resetJoints,
  } = useJoints();
  const {
    isEnabled: isPicflipEnabled,
    setEnabled: setPicflipEnabled,
    reset: resetPicflip,
  } = usePicflip();

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
        <button
          className="reset-button"
          onClick={() => {
            // Set reset flag to prevent oscillators from preserving current values
            setIsResetting(true);
            
            // Clear oscillators for each module first
            RESTART_AFFECTED_MODULES.forEach(moduleName => {
              clearModuleOscillators(moduleName);
            });
            
            // Then reset all module states
            resetEnvironment();
            resetBoundary();
            resetCollisions();
            resetFluids();
            resetBehavior();
            resetSensors();
            resetJoints();
            resetPicflip();
            
            // Clear reset flag after a brief delay
            setTimeout(() => setIsResetting(false), 10);
          }}
          title="Reset all modules to default values"
        >
          <RotateCcw size={16} />
        </button>
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
        title="PIC/FLIP"
        module={picflip}
        isSupported={isSupported(picflip)}
        enabled={isPicflipEnabled}
        setEnabled={setPicflipEnabled}
      >
        <PicflipModule />
      </ModuleWrapper>

      {/* Interaction controls moved into the Interact tool; module UI removed */}
    </div>
  );
}
