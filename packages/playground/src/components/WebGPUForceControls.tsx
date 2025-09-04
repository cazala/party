import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";
import { WebGPUCollisionsControls } from "./control-sections/WebGPUCollisionsControls";
import { WebGPUFluidControls } from "./control-sections/WebGPUFluidControls";
import { WebGPUBehaviorControls } from "./control-sections/WebGPUBehaviorControls";
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

export function WebGPUForceControls({
  environment,
  boundary,
  collisions,
  fluid,
  behavior,
}: {
  environment: WebGPUEnvironmentLike | null;
  boundary: WebGPUBoundaryLike | null;
  collisions?: WebGPUCollisionsLike | null;
  fluid?: WebGPUFluidLike | null;
  behavior?: WebGPUBehaviorLike | null;
}) {
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);
  const [collisionsEnabled, setCollisionsEnabled] = useState(true);
  const [fluidEnabled, setFluidEnabled] = useState(false);
  const [behaviorEnabled, setBehaviorEnabled] = useState(true);

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
        <WebGPUEnvironmentControls environment={environment} hideEnabled />
      </CollapsibleSection>

      <CollapsibleSection title="Boundary">
        <div style={{ marginBottom: "12px" }}>
          {createEnabledHeader(boundaryEnabled, setBoundaryEnabled, boundary)}
        </div>
        <WebGPUBoundaryControls boundary={boundary} hideEnabled />
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
          <WebGPUCollisionsControls collisions={collisions} hideEnabled />
        </CollapsibleSection>
      )}

      {fluid && (
        <CollapsibleSection title="Fluids">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(fluidEnabled, setFluidEnabled, fluid)}
          </div>
          <WebGPUFluidControls fluid={fluid} hideEnabled />
        </CollapsibleSection>
      )}

      {behavior && (
        <CollapsibleSection title="Behavior">
          <div style={{ marginBottom: "12px" }}>
            {createEnabledHeader(behaviorEnabled, setBehaviorEnabled, behavior)}
          </div>
          <WebGPUBehaviorControls behavior={behavior} hideEnabled />
        </CollapsibleSection>
      )}
    </div>
  );
}
