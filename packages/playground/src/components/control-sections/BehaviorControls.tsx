import { useState, useEffect } from "react";
import { Flock, Fluid } from "../../../../core/src";
import {
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
} from "../../../../core/src/modules/forces/flock.js";
import {
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
} from "../../../../core/src/modules/forces/fluid.js";

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
  const [influenceRadius, setInfluenceRadius] = useState(
    DEFAULT_INFLUENCE_RADIUS
  );
  const [targetDensity, setTargetDensity] = useState(DEFAULT_TARGET_DENSITY);
  const [pressureMultiplier, setPressureMultiplier] = useState(
    DEFAULT_PRESSURE_MULTIPLIER
  );

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
      setInfluenceRadius(fluid.influenceRadius);
      setTargetDensity(fluid.targetDensity);
      setPressureMultiplier(fluid.pressureMultiplier);
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

  const handleFluidChange = (property: keyof Fluid, value: number) => {
    if (!fluid) return;

    switch (property) {
      case "influenceRadius":
        setInfluenceRadius(value);
        fluid.influenceRadius = value;
        break;
      case "targetDensity":
        setTargetDensity(value);
        fluid.targetDensity = value;
        break;
      case "pressureMultiplier":
        setPressureMultiplier(value);
        fluid.pressureMultiplier = value;
        break;
    }
  };

  return (
    <div className="control-section">
      <h4>Behavior</h4>

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
          Separation: {separationWeight.toFixed(1)}
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
          Range: {separationRange.toFixed(0)}
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
            min="0.1"
            max="100"
            step="0.1"
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
    </div>
  );
}
