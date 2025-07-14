import { useState, useEffect } from "react";
import { Boids } from "@party/core";
import {
  DEFAULT_BOIDS_ENABLED,
  DEFAULT_BOIDS_WANDER_WEIGHT,
  DEFAULT_BOIDS_COHESION_WEIGHT,
  DEFAULT_BOIDS_ALIGNMENT_WEIGHT,
  DEFAULT_BOIDS_SEPARATION_WEIGHT,
  DEFAULT_BOIDS_CHASE_WEIGHT,
  DEFAULT_BOIDS_AVOID_WEIGHT,
  DEFAULT_BOIDS_SEPARATION_RANGE,
  DEFAULT_BOIDS_NEIGHBOR_RADIUS,
} from "@party/core/modules/forces/boids";

interface BoidsControlsProps {
  boids: Boids | null;
}

export function BoidsControls({ boids }: BoidsControlsProps) {
  const [boidsEnabled, setBoidsEnabled] = useState(false); // Playground default: off
  const [wanderWeight, setWanderWeight] = useState(DEFAULT_BOIDS_WANDER_WEIGHT);
  const [cohesionWeight, setCohesionWeight] = useState(
    DEFAULT_BOIDS_COHESION_WEIGHT
  );
  const [alignmentWeight, setAlignmentWeight] = useState(
    DEFAULT_BOIDS_ALIGNMENT_WEIGHT
  );
  const [separationWeight, setSeparationWeight] = useState(
    DEFAULT_BOIDS_SEPARATION_WEIGHT
  );
  const [chaseWeight, setChaseWeight] = useState(DEFAULT_BOIDS_CHASE_WEIGHT);
  const [avoidWeight, setAvoidWeight] = useState(DEFAULT_BOIDS_AVOID_WEIGHT);
  const [separationRange, setSeparationRange] = useState(
    DEFAULT_BOIDS_SEPARATION_RANGE
  );
  const [neighborRadius, setNeighborRadius] = useState(
    DEFAULT_BOIDS_NEIGHBOR_RADIUS
  );

  useEffect(() => {
    if (boids) {
      setBoidsEnabled(boids.enabled);
      setWanderWeight(boids.wanderWeight);
      setCohesionWeight(boids.cohesionWeight);
      setAlignmentWeight(boids.alignmentWeight);
      setSeparationWeight(boids.separationWeight);
      setChaseWeight(boids.chaseWeight);
      setAvoidWeight(boids.avoidWeight);
      setSeparationRange(boids.separationRange);
      setNeighborRadius(boids.neighborRadius);
    }
  }, [boids]);

  const handleBoidsChange = (
    property: keyof Boids,
    value: number | boolean
  ) => {
    if (!boids) return;

    switch (property) {
      case "enabled":
        setBoidsEnabled(value as boolean);
        boids.setEnabled(value as boolean);
        break;
      case "wanderWeight":
        setWanderWeight(value as number);
        boids.wanderWeight = value as number;
        break;
      case "cohesionWeight":
        setCohesionWeight(value as number);
        boids.cohesionWeight = value as number;
        break;
      case "alignmentWeight":
        setAlignmentWeight(value as number);
        boids.alignmentWeight = value as number;
        break;
      case "separationWeight":
        setSeparationWeight(value as number);
        boids.separationWeight = value as number;
        break;
      case "chaseWeight":
        setChaseWeight(value as number);
        boids.chaseWeight = value as number;
        break;
      case "avoidWeight":
        setAvoidWeight(value as number);
        boids.avoidWeight = value as number;
        break;
      case "separationRange":
        setSeparationRange(value as number);
        boids.separationRange = value as number;
        break;
      case "neighborRadius":
        setNeighborRadius(value as number);
        boids.neighborRadius = value as number;
        break;
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={boidsEnabled}
            onChange={(e) => handleBoidsChange("enabled", e.target.checked)}
            className="checkbox"
          />
          Enable
        </label>
      </div>

      <div className="control-group">
        <label>
          Wander: {wanderWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={wanderWeight}
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("wanderWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
          />
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
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("cohesionWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
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
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("alignmentWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
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
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("separationWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
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
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("separationRange", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Chase: {chaseWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={chaseWeight}
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("chaseWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Avoid: {avoidWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={avoidWeight}
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("avoidWeight", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Vision: {neighborRadius.toFixed(0)}
          <input
            type="range"
            min="0"
            max="500"
            step="1"
            value={neighborRadius}
            disabled={!boidsEnabled}
            onChange={(e) =>
              handleBoidsChange("neighborRadius", parseFloat(e.target.value))
            }
            className={`slider ${!boidsEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
