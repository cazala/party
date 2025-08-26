import { WebGPUEnvironmentControls } from "./control-sections/WebGPUEnvironmentControls";
import { WebGPUBoundaryControls } from "./control-sections/WebGPUBoundaryControls";

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

export function WebGPUForceControls({
  environment,
  boundary,
  renderer,
}: {
  environment: WebGPUEnvironmentLike | null;
  boundary: WebGPUBoundaryLike | null;
  renderer?: any | null;
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
    </div>
  );
}
