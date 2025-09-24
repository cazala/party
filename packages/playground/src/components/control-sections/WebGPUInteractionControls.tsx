import { useState } from "react";
import {
  DEFAULT_INTERACTION_ACTION,
  DEFAULT_INTERACTION_MODE,
  DEFAULT_INTERACTION_STRENGTH,
  DEFAULT_INTERACTION_RADIUS,
} from "@cazala/party";

interface WebGPUInteractionLike {
  setEnabled?: (v: boolean) => void;
  setAction: (v: "click" | "right_click") => void;
  setMode: (v: "attract" | "repel") => void;
  setStrength: (v: number) => void;
  setRadius: (v: number) => void;
}

export function WebGPUInteractionControls({
  interaction,
  hideEnabled = false,
  enabled = true,
}: {
  interaction: WebGPUInteractionLike | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(true);
  const [action, setAction] = useState<"click" | "right_click">(
    DEFAULT_INTERACTION_ACTION
  );
  const [mode, setMode] = useState<"attract" | "repel">(
    DEFAULT_INTERACTION_MODE
  );
  const [strength, setStrength] = useState(DEFAULT_INTERACTION_STRENGTH);
  const [radius, setRadius] = useState(DEFAULT_INTERACTION_RADIUS);

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
                interaction?.setEnabled?.(e.target.checked);
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
    </div>
  );
}
