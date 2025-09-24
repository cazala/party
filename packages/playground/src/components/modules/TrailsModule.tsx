import { useState } from "react";
import {
  DEFAULT_TRAILS_TRAIL_DECAY,
  DEFAULT_TRAILS_TRAIL_DIFFUSE,
  Trails,
} from "@cazala/party";

export function TrailsModule({
  trails,
  enabled = true,
}: {
  trails: Trails | null;
  enabled?: boolean;
}) {
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAILS_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(
    DEFAULT_TRAILS_TRAIL_DIFFUSE
  );

  const handleChange = (property: string, value: number | boolean) => {
    if (!trails || !enabled) return;
    switch (property) {
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
    <>
      {/* Only top-level Enabled is kept; this toggle removed */}

      <div className="control-group">
        <label>
          Trail Decay: {trailDecay.toFixed(2)}
          <input
            type="range"
            min="0.02"
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
    </>
  );
}
