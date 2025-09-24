import { useState } from "react";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_INTERACTION_STRENGTH,
  DEFAULT_INTERACTION_RADIUS,
  Interaction,
} from "@cazala/party";

export function WebGPUInteractionControls({
  interaction,
  enabled = true,
}: {
  interaction: Interaction | null;
  enabled?: boolean;
}) {
  const [mode, setMode] = useState<"attract" | "repel">(
    DEFAULT_INTERACTION_MODE
  );
  const [strength, setStrength] = useState(DEFAULT_INTERACTION_STRENGTH);
  const [radius, setRadius] = useState(DEFAULT_INTERACTION_RADIUS);

  return (
    <>

      <div className="control-group">
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => {
              const v = e.target.value as "attract" | "repel";
              setMode(v);
              interaction?.setMode(v);
            }}
            disabled={!enabled}
            className="form-select"
          >
            <option value="attract">Attract</option>
            <option value="repel">Repel</option>
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          Strength: {strength}
          <input
            type="range"
            min="0"
            max="20000"
            step="10"
            value={strength}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setStrength(v);
              interaction?.setStrength(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Radius: {radius}
          <input
            type="range"
            min="10"
            max="1000"
            step="1"
            value={radius}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setRadius(v);
              interaction?.setRadius(v);
            }}
            disabled={!enabled}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </>
  );
}
