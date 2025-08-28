import { useEffect, useState } from "react";

interface WebGPUBoundaryLike {
  setRestitution: (value: number) => void;
  setFriction?: (value: number) => void;
  setMode?: (mode: "bounce" | "warp" | "kill") => void;
}

export function WebGPUBoundaryControls({
  boundary,
}: {
  boundary: WebGPUBoundaryLike | null;
}) {
  const [restitution, setRestitution] = useState(0.6);
  const [friction, setFriction] = useState(0.1);
  const [mode, setMode] = useState<"bounce" | "warp" | "kill">("bounce");

  useEffect(() => {
    // no-op: could hydrate from module if it exposed getters
  }, [boundary]);

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => {
              const m = e.target.value as "bounce" | "warp" | "kill";
              setMode(m);
              boundary?.setMode?.(m);
            }}
            className="form-select"
          >
            <option value="bounce">Bounce</option>
            <option value="warp">Warp</option>
            <option value="kill">Kill</option>
          </select>
        </label>
      </div>

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
