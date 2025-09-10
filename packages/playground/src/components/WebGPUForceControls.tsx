import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";
import { WebGPUCollisionsControls } from "./control-sections/WebGPUCollisionsControls";
import { WebGPUFluidControls } from "./control-sections/WebGPUFluidControls";
import { WebGPUBehaviorControls } from "./control-sections/WebGPUBehaviorControls";
import { WebGPUSensorsControls } from "./control-sections/WebGPUSensorsControls";
import { CollapsibleSection } from "./CollapsibleSection";
import { useState } from "react";

interface WebGPUEnvironmentLike {
  setStrength: (value: number) => void;
  setDirection?: (x: number, y: number) => void;
  setInertia?: (value: number) => void;
  setFriction?: (value: number) => void;
  setDamping?: (value: number) => void;
  setEnabled?: (value: boolean) => void;
}

interface WebGPUBoundaryLike {
  setRestitution: (value: number) => void;
  setFriction?: (value: number) => void;
  setEnabled?: (value: boolean) => void;
}

interface WebGPUCollisionsLike {
  setRestitution: (value: number) => void;
  setEnabled?: (value: boolean) => void;
}

interface WebGPUFluidLike {
  setEnabled: (enabled: boolean) => void;
  setInfluenceRadius: (v: number) => void;
  setTargetDensity: (v: number) => void;
  setPressureMultiplier: (v: number) => void;
  setViscosity: (v: number) => void;
  setNearPressureMultiplier: (v: number) => void;
  setNearThreshold: (v: number) => void;
  setEnableNearPressure: (enabled: boolean) => void;
}

interface WebGPUBehaviorLike {
  setWanderWeight: (v: number) => void;
  setCohesionWeight: (v: number) => void;
  setAlignmentWeight: (v: number) => void;
  setSeparationWeight: (v: number) => void;
  setChaseWeight: (v: number) => void;
  setAvoidWeight: (v: number) => void;
  setSeparationRange: (v: number) => void;
  setViewRadius: (v: number) => void;
  setViewAngle: (v: number) => void;
  setEnabled?: (v: boolean) => void;
}

interface WebGPUSensorsLike {
  setEnableTrail: (v: boolean) => void;
  setTrailDecay: (v: number) => void;
  setTrailDiffuse: (v: number) => void;
  setEnableSensors: (v: boolean) => void;
  setSensorDistance: (v: number) => void;
  setSensorAngle: (v: number) => void;
  setSensorRadius: (v: number) => void;
  setSensorThreshold: (v: number) => void;
  setSensorStrength: (v: number) => void;
  setColorSimilarityThreshold: (v: number) => void;
  setFollowBehavior: (v: any) => void;
  setFleeBehavior: (v: any) => void;
  setFleeAngle: (v: number) => void;
  setParticleColor: (v: string) => void;
  setEnabled?: (v: boolean) => void;
}

export function WebGPUForceControls({
  environment,
  boundary,
  collisions,
  fluid,
  behavior,
  sensors,
}: {
  environment: WebGPUEnvironmentLike | null;
  boundary: WebGPUBoundaryLike | null;
  collisions?: WebGPUCollisionsLike | null;
  fluid?: WebGPUFluidLike | null;
  behavior?: WebGPUBehaviorLike | null;
  sensors?: WebGPUSensorsLike | null;
}) {
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);
  const [collisionsEnabled, setCollisionsEnabled] = useState(true);
  const [fluidEnabled, setFluidEnabled] = useState(false);
  const [behaviorEnabled, setBehaviorEnabled] = useState(true);
  const [sensorsEnabled, setSensorsEnabled] = useState(false);

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
        <h3>Forces</h3>
      </div>

      <CollapsibleSection title="Environment" defaultOpen={true}>
        <div style={{ marginBottom: "12px" }}>
          {createEnabledHeader(
            environmentEnabled,
            setEnvironmentEnabled,
            environment
          )}
        </div>
        <WebGPUEnvironmentControls environment={environment} hideEnabled enabled={environmentEnabled} />
      </CollapsibleSection>

      <CollapsibleSection title="Boundary">
        <div style={{ marginBottom: "12px" }}>
          {createEnabledHeader(boundaryEnabled, setBoundaryEnabled, boundary)}
        </div>
        <WebGPUBoundaryControls boundary={boundary} hideEnabled enabled={boundaryEnabled} />
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
          <WebGPUCollisionsControls collisions={collisions} hideEnabled enabled={collisionsEnabled} />
        </CollapsibleSection>
      )}

      {fluid && (
        <CollapsibleSection title="Fluids">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(fluidEnabled, setFluidEnabled, fluid)}
          </div>
          <WebGPUFluidControls fluid={fluid} hideEnabled enabled={fluidEnabled} />
        </CollapsibleSection>
      )}

      {behavior && (
        <CollapsibleSection title="Behavior">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(behaviorEnabled, setBehaviorEnabled, behavior)}
          </div>
          <WebGPUBehaviorControls behavior={behavior} hideEnabled enabled={behaviorEnabled} />
        </CollapsibleSection>
      )}

      {sensors && (
        <CollapsibleSection title="Sensors">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(sensorsEnabled, setSensorsEnabled, sensors)}
          </div>
          <WebGPUSensorsControls sensors={sensors} hideEnabled enabled={sensorsEnabled} />
        </CollapsibleSection>
      )}
    </div>
  );
}
