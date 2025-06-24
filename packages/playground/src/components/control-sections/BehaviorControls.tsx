import { useState, useEffect } from "react";
import { Flock, Canvas2DRenderer } from "../../../../core/src";
import {
  DEFAULT_FLOCK_COHESION_WEIGHT,
  DEFAULT_FLOCK_ALIGNMENT_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_WEIGHT,
  DEFAULT_FLOCK_SEPARATION_RANGE,
  DEFAULT_FLOCK_NEIGHBOR_RADIUS,
} from "../../../../core/src/modules/forces/flock.js";

interface BehaviorControlsProps {
  flock: Flock | null;
}

export function BehaviorControls({ flock }: BehaviorControlsProps) {
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

  useEffect(() => {
    if (flock) {
      setCohesionWeight(flock.cohesionWeight);
      setAlignmentWeight(flock.alignmentWeight);
      setSeparationWeight(flock.separationWeight);
      setSeparationRange(flock.separationRange);
      setNeighborRadius(flock.neighborRadius);
    }
  }, [flock]);

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
          Separation Range: {separationRange.toFixed(0)}
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
          Neighbor Radius: {neighborRadius.toFixed(0)}
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
    </div>
  );
}
