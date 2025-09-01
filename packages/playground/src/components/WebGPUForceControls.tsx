import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";
import { WebGPUCollisionsControls } from "./control-sections/WebGPUCollisionsControls";
import { WebGPUFluidControls } from "./control-sections/WebGPUFluidControls";

interface WebGPUEnvironmentLike {
  setStrength: (value: number) => void;
  setDirection?: (x: number, y: number) => void;
  setInertia?: (value: number) => void;
  setFriction?: (value: number) => void;
  setDamping?: (value: number) => void;
}

interface WebGPUBoundaryLike {
  setRestitution: (value: number) => void;
  setFriction?: (value: number) => void;
}

interface WebGPUCollisionsLike {
  setRestitution: (value: number) => void;
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

export function WebGPUForceControls({
  environment,
  boundary,
  collisions,
  fluid,
}: {
  environment: WebGPUEnvironmentLike | null;
  boundary: WebGPUBoundaryLike | null;
  collisions?: WebGPUCollisionsLike | null;
  fluid?: WebGPUFluidLike | null;
}) {
  return (
    <div className="controls-panel">
      <div className="controls-header">
        <h3>Forces</h3>
      </div>

      <div className="control-section">
        <h4 style={{ marginTop: 0 }}>Environment</h4>
        <WebGPUEnvironmentControls environment={environment} />
      </div>

      <div className="control-section">
        <h4>Boundary</h4>
        <WebGPUBoundaryControls boundary={boundary} />
      </div>

      {collisions && (
        <div className="control-section">
          <h4>Collisions</h4>
          <WebGPUCollisionsControls collisions={collisions} />
        </div>
      )}

      {fluid && (
        <div className="control-section">
          <h4>Fluids</h4>
          <WebGPUFluidControls fluid={fluid} />
        </div>
      )}
    </div>
  );
}
