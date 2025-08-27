import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";
import { WebGPUCollisionsControls } from "./control-sections/WebGPUCollisionsControls";

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

export function WebGPUForceControls({
  environment,
  boundary,
  collisions,
}: {
  environment: WebGPUEnvironmentLike | null;
  boundary: WebGPUBoundaryLike | null;
  collisions?: WebGPUCollisionsLike | null;
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
    </div>
  );
}
