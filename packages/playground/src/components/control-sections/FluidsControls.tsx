import { useState, useEffect } from "react";
import { Fluid } from "@cazala/party/legacy";
import {
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_VISCOSITY,
  DEFAULT_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_NEAR_THRESHOLD,
  DEFAULT_ENABLE_NEAR_PRESSURE,
} from "@cazala/party/legacy";

interface FluidsControlsProps {
  fluid: Fluid | null;
}

export function FluidsControls({ fluid }: FluidsControlsProps) {
  // Fluid state
  const [fluidEnabled, setFluidEnabled] = useState(false); // Playground default: off
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(DEFAULT_TARGET_DENSITY);
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_PRESSURE_MULTIPLIER
  );
  const [viscosity, setViscosity] = useState(DEFAULT_VISCOSITY);
  const [nearPressureMultiplier, setNearPressureMultiplier] = useState(
    DEFAULT_NEAR_PRESSURE_MULTIPLIER
  );
  const [nearThreshold, setNearThreshold] = useState(DEFAULT_NEAR_THRESHOLD);
  const [enableNearPressure, setEnableNearPressure] = useState(
    DEFAULT_ENABLE_NEAR_PRESSURE
  );

  useEffect(() => {
    if (fluid) {
      setFluidEnabled(fluid.enabled);
      setInfluenceRadius(fluid.influenceRadius);
      setTargetDensity(fluid.targetDensity);
      setPressureMultiplier(fluid.pressureMultiplier);
      setViscosity(fluid.viscosity);
      setNearPressureMultiplier(fluid.nearPressureMultiplier);
      setNearThreshold(fluid.nearThreshold);
      setEnableNearPressure(fluid.enableNearPressure);
    }
  }, [fluid]);

  const handleFluidChange = (
    property: keyof Fluid,
    value: number | boolean
  ) => {
    if (!fluid) return;

    switch (property) {
      case "enabled":
        setFluidEnabled(value as boolean);
        fluid.setEnabled(value as boolean);
        break;
      case "influenceRadius":
        setInfluenceRadius(value as number);
        fluid.influenceRadius = value as number;
        break;
      case "targetDensity":
        setTargetDensity(value as number);
        fluid.targetDensity = value as number;
        break;
      case "pressureMultiplier":
        setPressureMultiplier(value as number);
        fluid.pressureMultiplier = value as number;
        break;
      case "viscosity":
        setViscosity(value as number);
        fluid.viscosity = value as number;
        break;
      case "nearPressureMultiplier":
        setNearPressureMultiplier(value as number);
        fluid.nearPressureMultiplier = value as number;
        break;
      case "nearThreshold":
        setNearThreshold(value as number);
        fluid.nearThreshold = value as number;
        break;
      case "enableNearPressure":
        setEnableNearPressure(value as boolean);
        fluid.enableNearPressure = value as boolean;
        break;
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={fluidEnabled}
            onChange={(e) => handleFluidChange("enabled", e.target.checked)}
            className="checkbox"
          />
          Enable Fluids
        </label>
      </div>

      <div className="control-group">
        <label>
          Density: {targetDensity.toFixed(2)}
          <input
            type="range"
            min="0.001"
            max="2"
            step="0.0001"
            value={targetDensity}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("targetDensity", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Pressure: {pressureMultiplier.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={pressureMultiplier}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange(
                "pressureMultiplier",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Influence: {influenceRadius.toFixed(0)}px
          <input
            type="range"
            min="10"
            max="200"
            step="1"
            value={influenceRadius}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("influenceRadius", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
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
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("viscosity", parseFloat(e.target.value))
            }
            className={`slider ${!fluidEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={enableNearPressure}
            disabled={!fluidEnabled}
            onChange={(e) =>
              handleFluidChange("enableNearPressure", e.target.checked)
            }
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
            disabled={!fluidEnabled || !enableNearPressure}
            onChange={(e) =>
              handleFluidChange("nearThreshold", parseFloat(e.target.value))
            }
            className={`slider ${
              !fluidEnabled || !enableNearPressure ? "disabled" : ""
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
            disabled={!fluidEnabled || !enableNearPressure}
            onChange={(e) =>
              handleFluidChange(
                "nearPressureMultiplier",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${
              !fluidEnabled || !enableNearPressure ? "disabled" : ""
            }`}
          />
        </label>
      </div>
    </div>
  );
}
