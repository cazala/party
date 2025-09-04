import { useEffect, useState } from "react";

interface WebGPUFluidLike {
  setEnabled: (enabled: boolean) => void;
  setInfluenceRadius: (v: number) => void;
  setTargetDensity: (v: number) => void;
  setPressureMultiplier: (v: number) => void;
  setViscosity: (v: number) => void;
  setNearPressureMultiplier: (v: number) => void;
  setNearThreshold: (v: number) => void;
  setEnableNearPressure: (enabled: boolean) => void;
}

export function WebGPUFluidControls({
  fluid,
  hideEnabled = false,
  enabled = true,
}: {
  fluid: WebGPUFluidLike | null;
  hideEnabled?: boolean;
  enabled?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(false);
  const [influenceRadius, setInfluenceRadius] = useState(100);
  const [targetDensity, setTargetDensity] = useState(1);
  const [pressureMultiplier, setPressureMultiplier] = useState(15);
  const [viscosity, setViscosity] = useState(0.6);
  const [nearPressureMultiplier, setNearPressureMultiplier] = useState(30);
  const [nearThreshold, setNearThreshold] = useState(50);
  const [enableNearPressure, setEnableNearPressure] = useState(true);

  useEffect(() => {
    // Could hydrate current values if the module exposed getters. For now, keep UI state local.
  }, [fluid]);

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
                fluid?.setEnabled(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}

      <div className="control-group">
        <label>
          Influence: {influenceRadius.toFixed(0)}px
          <input
            type="range"
            min="10"
            max="200"
            step="1"
            value={influenceRadius}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setInfluenceRadius(v);
              fluid?.setInfluenceRadius(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Density: {targetDensity.toFixed(3)}
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.001"
            value={targetDensity}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setTargetDensity(v);
              fluid?.setTargetDensity(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Pressure: {pressureMultiplier.toFixed(1)}
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={pressureMultiplier}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setPressureMultiplier(v);
              fluid?.setPressureMultiplier(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Viscosity: {viscosity.toFixed(2)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={viscosity}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setViscosity(v);
              fluid?.setViscosity(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enableNearPressure}
            disabled={!enabled}
            onChange={(e) => {
              setEnableNearPressure(e.target.checked);
              fluid?.setEnableNearPressure(e.target.checked);
            }}
            className="checkbox"
          />
          Enable Near Pressure
        </label>
      </div>

      <div className="control-group">
        <label>
          Near Threshold: {nearThreshold.toFixed(0)}px
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={nearThreshold}
            disabled={!enabled || !enableNearPressure}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setNearThreshold(v);
              fluid?.setNearThreshold(v);
            }}
            className={`slider ${
              !enabled || !enableNearPressure ? "disabled" : ""
            }`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Near Pressure: {nearPressureMultiplier.toFixed(1)}
          <input
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={nearPressureMultiplier}
            disabled={!enabled || !enableNearPressure}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setNearPressureMultiplier(v);
              fluid?.setNearPressureMultiplier(v);
            }}
            className={`slider ${
              !enabled || !enableNearPressure ? "disabled" : ""
            }`}
          />
        </label>
      </div>
    </div>
  );
}
