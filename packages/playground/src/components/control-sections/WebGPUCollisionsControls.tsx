import { useEffect, useState } from "react";
import {
  DEFAULT_COLLISIONS_RESTITUTION,
  Collisions,
} from "@cazala/party/modules/webgpu/modules/collisions";

export function WebGPUCollisionsControls({
  collisions,
  hideEnabled = false,
  enabled = true,
}: {
  collisions: Collisions | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [restitution, setRestitution] = useState(
    DEFAULT_COLLISIONS_RESTITUTION
  );
  const [internalEnabled, setInternalEnabled] = useState(true);

  useEffect(() => {
    // no-op: hydrate if getters exist later
  }, [collisions]);

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
                collisions?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}
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
              collisions?.setRestitution(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
