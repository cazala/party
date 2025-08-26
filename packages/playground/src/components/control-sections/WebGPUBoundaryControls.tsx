import { useEffect, useState } from "react";

interface WebGPUBoundaryLike {
  setRestitution: (value: number) => void;
  setFriction?: (value: number) => void;
}

export function WebGPUBoundaryControls({
  boundary,
}: {
  boundary: WebGPUBoundaryLike | null;
}) {
  const [restitution, setRestitution] = useState(0.6);
  const [friction, setFriction] = useState(0);

  useEffect(() => {
    // no-op: could hydrate from module if it exposed getters
  }, [boundary]);

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Restitution: {restitution.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={restitution}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setRestitution(v);
              boundary?.setRestitution(v);
            }}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Friction: {friction.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={friction}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setFriction(v);
              boundary?.setFriction?.(v);
            }}
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
