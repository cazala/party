import { useEffect, useState } from "react";
import {
  DEFAULT_BOUNDARY_RESTITUTION,
  DEFAULT_BOUNDARY_FRICTION,
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
  Boundary,
} from "@cazala/party/modules/webgpu/modules/forces/boundary";

export function WebGPUBoundaryControls({
  boundary,
  hideEnabled = false,
  enabled = true,
}: {
  boundary: Boundary | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [restitution, setRestitution] = useState(DEFAULT_BOUNDARY_RESTITUTION);
  const [friction, setFriction] = useState(DEFAULT_BOUNDARY_FRICTION);
  const [mode, setMode] = useState<"bounce" | "warp" | "kill" | "none">(
    DEFAULT_BOUNDARY_MODE
  );
  const [internalEnabled, setInternalEnabled] = useState(true);
  const [repelDistance, setRepelDistance] = useState(
    DEFAULT_BOUNDARY_REPEL_DISTANCE
  );
  const [repelStrength, setRepelStrength] = useState(
    DEFAULT_BOUNDARY_REPEL_STRENGTH
  );

  useEffect(() => {
    // no-op: could hydrate from module if it exposed getters
  }, [boundary]);

  return (
    <div className="control-section">
      {!hideEnabled && (
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={internalEnabled}
              onChange={(e) => {
                setInternalEnabled(e.target.checked);
                boundary?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}
      <div className="control-group">
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => {
              const m = e.target.value as "bounce" | "warp" | "kill" | "none";
              setMode(m);
              boundary?.setMode?.(m);
            }}
            disabled={!enabled}
            className="form-select"
          >
            <option value="bounce">Bounce</option>
            <option value="warp">Warp</option>
            <option value="kill">Kill</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>

      {mode === "bounce" && (
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
              disabled={!enabled}
              className={`slider ${!enabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}

      {mode === "bounce" && (
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
              disabled={!enabled}
              className={`slider ${!enabled ? "disabled" : ""}`}
            />
          </label>
        </div>
      )}
      {/* Repel controls - visible in all modes */}
      <div className="control-group">
        <label>
          Repel Distance: {repelDistance}
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={repelDistance}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setRepelDistance(v);
              boundary?.setRepelDistance?.(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Repel Strength: {repelStrength}
          <input
            type="range"
            min="0"
            max="500"
            step="1"
            value={repelStrength}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setRepelStrength(v);
              boundary?.setRepelStrength?.(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
