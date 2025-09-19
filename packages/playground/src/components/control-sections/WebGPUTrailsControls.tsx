import { useEffect, useState } from "react";
import {
  DEFAULT_TRAILS_TRAIL_DECAY,
  DEFAULT_TRAILS_TRAIL_DIFFUSE,
  Trails,
} from "@cazala/party/modules/webgpu/modules/render/trails";

export function WebGPUTrailsControls({
  trails,
  hideEnabled = false,
  enabled = true,
}: {
  trails: Trails | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(true);
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAILS_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(
    DEFAULT_TRAILS_TRAIL_DIFFUSE
  );

  useEffect(() => {
    // hydrate if getters exist in future
  }, [trails]);

  const handleChange = (property: string, value: number | boolean) => {
    if (!trails || !enabled) return;
    switch (property) {
      case "enable":
        setInternalEnabled(value as boolean);
        trails.setEnabled?.(value as boolean);
        break;
      case "trailDecay":
        setTrailDecay(value as number);
        trails.setTrailDecay(value as number);
        break;
      case "trailDiffuse":
        setTrailDiffuse(value as number);
        trails.setTrailDiffuse(value as number);
        break;
    }
  };

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
                trails?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}

      {/* Only top-level Enabled is kept; this toggle removed */}

      <div className="control-group">
        <label>
          Trail Decay: {trailDecay.toFixed(2)}
          <input
            type="range"
            min="0.01"
            max="0.2"
            step="0.01"
            value={trailDecay}
            disabled={!enabled}
            onChange={(e) =>
              handleChange("trailDecay", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Trail Diffuse: {trailDiffuse}px
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={trailDiffuse}
            disabled={!enabled}
            onChange={(e) =>
              handleChange("trailDiffuse", parseFloat(e.target.value))
            }
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
