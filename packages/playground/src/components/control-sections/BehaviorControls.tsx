import { useState, useEffect } from "react";
import { Flock, Fluid } from "@party/core";
import {
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
} from "@party/core/modules/forces/flock";
import {
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_WOBBLE_FACTOR,
  DEFAULT_FLUID_ENABLED,
} from "@party/core/modules/forces/fluid";

interface BehaviorControlsProps {
  flock: Flock | null;
  fluid: Fluid | null;
}

export function BehaviorControls({ flock, fluid }: BehaviorControlsProps) {
  const [cohesionWeight, setCohesionWeight] = useState(
    DEFAULT_FLOCK_COHESION_WEIGHT
  );
  const [alignmentWeight, setAlignmentWeight] = useState(
    DEFAULT_FLOCK_ALIGNMENT_WEIGHT
  );
  const [separationWeight, setSeparationWeight] = useState(
    DEFAULT_FLOCK_SEPARATION_WEIGHT
  );
  const [separationRange, setSeparationRange] = useState(
    DEFAULT_FLOCK_SEPARATION_RANGE
  );
  const [neighborRadius, setNeighborRadius] = useState(
    DEFAULT_FLOCK_NEIGHBOR_RADIUS
  );

  // Fluid state
  const [fluidEnabled, setFluidEnabled] = useState(DEFAULT_FLUID_ENABLED);
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(DEFAULT_TARGET_DENSITY);
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_PRESSURE_MULTIPLIER
  );
  const [wobbleFactor, setWobbleFactor] = useState(DEFAULT_WOBBLE_FACTOR);

  useEffect(() => {
    if (flock) {
      setCohesionWeight(flock.cohesionWeight);
      setAlignmentWeight(flock.alignmentWeight);
      setSeparationWeight(flock.separationWeight);
      setSeparationRange(flock.separationRange);
      setNeighborRadius(flock.neighborRadius);
    }
  }, [flock]);

  useEffect(() => {
    if (fluid) {
      setFluidEnabled(fluid.enabled);
      setInfluenceRadius(fluid.influenceRadius);
      setTargetDensity(fluid.targetDensity);
      setPressureMultiplier(fluid.pressureMultiplier);
      setWobbleFactor(fluid.wobbleFactor);
    }
  }, [fluid]);

  const handleFlockingChange = (property: keyof Flock, value: number) => {
    if (!flock) return;

    switch (property) {
      case "cohesionWeight":
        setCohesionWeight(value);
        flock.cohesionWeight = value;
        break;
      case "alignmentWeight":
        setAlignmentWeight(value);
        flock.alignmentWeight = value;
        break;
      case "separationWeight":
        setSeparationWeight(value);
        flock.separationWeight = value;
        break;
      case "separationRange":
        setSeparationRange(value);
        flock.separationRange = value;
        break;
      case "neighborRadius":
        setNeighborRadius(value);
        flock.neighborRadius = value;
        break;
    }
  };

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
      case "wobbleFactor":
        setWobbleFactor(value as number);
        fluid.wobbleFactor = value as number;
        break;
    }
  };

  return (
    <div className="control-section">
      <h4>Behavior</h4>

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
          Cohesion: {cohesionWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={cohesionWeight}
            onChange={(e) =>
              handleFlockingChange("cohesionWeight", parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Alignment: {alignmentWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={alignmentWeight}
            onChange={(e) =>
              handleFlockingChange(
                "alignmentWeight",
                parseFloat(e.target.value)
              )
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Repulsion: {separationWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={separationWeight}
            onChange={(e) =>
              handleFlockingChange(
                "separationWeight",
                parseFloat(e.target.value)
              )
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Separation: {separationRange.toFixed(0)}
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            value={separationRange}
            onChange={(e) =>
              handleFlockingChange(
                "separationRange",
                parseFloat(e.target.value)
              )
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Radius: {neighborRadius.toFixed(0)}
          <input
            type="range"
            min="0"
            max="500"
            step="1"
            value={neighborRadius}
            onChange={(e) =>
              handleFlockingChange("neighborRadius", parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Influence: {influenceRadius.toFixed(1)}
          <input
            type="range"
            min="5"
            max="500"
            step="1"
            value={influenceRadius}
            onChange={(e) =>
              handleFluidChange("influenceRadius", parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Density: {targetDensity.toFixed(2)}
          <input
            type="range"
            min="0.001"
            max="1"
            step="0.0001"
            value={targetDensity}
            onChange={(e) =>
              handleFluidChange("targetDensity", parseFloat(e.target.value))
            }
            className="slider"
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
            onChange={(e) =>
              handleFluidChange(
                "pressureMultiplier",
                parseFloat(e.target.value)
              )
            }
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Wobble: {wobbleFactor.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={wobbleFactor}
            onChange={(e) =>
              handleFluidChange("wobbleFactor", parseFloat(e.target.value))
            }
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}
