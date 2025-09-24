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
import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";
import { WebGPUCollisionsControls } from "./control-sections/WebGPUCollisionsControls";
import { WebGPUFluidControls } from "./control-sections/WebGPUFluidControls";
import { WebGPUBehaviorControls } from "./control-sections/WebGPUBehaviorControls";
import { WebGPUSensorsControls } from "./control-sections/WebGPUSensorsControls";
import { WebGPUTrailsControls } from "./control-sections/WebGPUTrailsControls";
import { WebGPUInteractionControls } from "./control-sections/WebGPUInteractionControls";
import { CollapsibleSection } from "./CollapsibleSection";

export function WebGPUForceControls({
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
  collisions?: Collisions | null;
  fluid?: Fluid | null;
  behavior?: Behavior | null;
  sensors?: Sensors | null;
  trails?: Trails | null;
  interaction?: Interaction | null;
  isSupported?: (module: any) => boolean;
  isInitialized?: boolean;
  isInitializing?: boolean;
}) {
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);
  const [collisionsEnabled, setCollisionsEnabled] = useState(true);
  const [fluidEnabled, setFluidEnabled] = useState(false);
  const [behaviorEnabled, setBehaviorEnabled] = useState(false);
  const [sensorsEnabled, setSensorsEnabled] = useState(false);
  const [trailsEnabled, setTrailsEnabled] = useState(false);
  const [interactionEnabled, setInteractionEnabled] = useState(false);

  const createEnabledHeader = (
    enabled: boolean,
    setEnabled: (value: boolean) => void,
    module: any
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <label
        style={{ display: "flex", alignItems: "center", gap: "4px", margin: 0 }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            module?.setEnabled?.(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          style={{ fontSize: "14px", fontWeight: "normal", cursor: "pointer" }}
        >
          Enabled
        </span>
      </label>
    </div>
  );

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Modules</h3>
      </div>

      <CollapsibleSection title="Environment" defaultOpen={true}>
        <div style={{ marginBottom: "12px" }}>
          {createEnabledHeader(
            environmentEnabled,
            setEnvironmentEnabled,
            environment
          )}
        </div>
        <WebGPUEnvironmentControls
          environment={environment}
          hideEnabled
          enabled={environmentEnabled}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Boundary">
        <div style={{ marginBottom: "12px" }}>
          {createEnabledHeader(boundaryEnabled, setBoundaryEnabled, boundary)}
        </div>
        <WebGPUBoundaryControls
          boundary={boundary}
          hideEnabled
          enabled={boundaryEnabled}
        />
      </CollapsibleSection>

      {collisions && (
        <CollapsibleSection title="Collisions">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(
              collisionsEnabled,
              setCollisionsEnabled,
              collisions
            )}
          </div>
          <WebGPUCollisionsControls
            collisions={collisions}
            hideEnabled
            enabled={collisionsEnabled}
          />
        </CollapsibleSection>
      )}

      {fluid && isSupported?.(fluid) && (
        <CollapsibleSection title="Fluids">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(fluidEnabled, setFluidEnabled, fluid)}
          </div>
          <WebGPUFluidControls
            fluid={fluid}
            hideEnabled
            enabled={fluidEnabled}
            isInitialized={isInitialized}
            isInitializing={isInitializing}
          />
        </CollapsibleSection>
      )}

      {fluid && !isSupported?.(fluid) && (
        <CollapsibleSection title="Fluids">
          <div style={{ padding: "8px 0", opacity: 0.7 }}>
            <span style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              Not supported in current runtime
            </span>
          </div>
        </CollapsibleSection>
      )}

      {behavior && isSupported?.(behavior) && (
        <CollapsibleSection title="Behavior">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(behaviorEnabled, setBehaviorEnabled, behavior)}
          </div>
          <WebGPUBehaviorControls
            behavior={behavior}
            hideEnabled
            enabled={behaviorEnabled}
            isInitialized={isInitialized}
            isInitializing={isInitializing}
          />
        </CollapsibleSection>
      )}

      {behavior && !isSupported?.(behavior) && (
        <CollapsibleSection title="Behavior">
          <div style={{ padding: "8px 0", opacity: 0.7 }}>
            <span style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              Not supported in current runtime
            </span>
          </div>
        </CollapsibleSection>
      )}

      {trails && (
        <CollapsibleSection title="Trails">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(trailsEnabled, setTrailsEnabled, trails)}
          </div>
          <WebGPUTrailsControls
            trails={trails}
            hideEnabled
            enabled={trailsEnabled}
          />
        </CollapsibleSection>
      )}

      {sensors && isSupported?.(sensors) && (
        <CollapsibleSection title="Sensors">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(sensorsEnabled, setSensorsEnabled, sensors)}
          </div>
          <WebGPUSensorsControls
            sensors={sensors}
            hideEnabled
            enabled={sensorsEnabled}
            isInitialized={isInitialized}
            isInitializing={isInitializing}
          />
        </CollapsibleSection>
      )}

      {sensors && !isSupported?.(sensors) && (
        <CollapsibleSection title="Sensors">
          <div style={{ padding: "8px 0", opacity: 0.7 }}>
            <span style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              Not supported in current runtime
            </span>
          </div>
        </CollapsibleSection>
      )}

      {interaction && isSupported?.(interaction) && (
        <CollapsibleSection title="Interaction">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(
              interactionEnabled,
              setInteractionEnabled,
              interaction
            )}
          </div>
          <WebGPUInteractionControls
            interaction={interaction}
            hideEnabled
            enabled={interactionEnabled}
          />
        </CollapsibleSection>
      )}

      {interaction && !isSupported?.(interaction) && (
        <CollapsibleSection title="Interaction">
          <div style={{ padding: "8px 0", opacity: 0.7 }}>
            <span style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              Not supported in current runtime
            </span>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
