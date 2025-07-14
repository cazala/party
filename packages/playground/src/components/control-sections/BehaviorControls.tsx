import { useState, useEffect } from "react";
import { Behavior } from "@party/core";
import {
  DEFAULT_BEHAVIOR_ENABLED,
  DEFAULT_BEHAVIOR_WANDER_WEIGHT,
  DEFAULT_BEHAVIOR_COHESION_WEIGHT,
  DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_WEIGHT,
  DEFAULT_BEHAVIOR_CHASE_WEIGHT,
  DEFAULT_BEHAVIOR_AVOID_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_RANGE,
  DEFAULT_BEHAVIOR_NEIGHBOR_RADIUS,
} from "@party/core/modules/forces/behavior";

interface BehaviorControlsProps {
  behavior: Behavior | null;
}

export function BehaviorControls({ behavior }: BehaviorControlsProps) {
  const [behaviorEnabled, setBehaviorEnabled] = useState(false); // Playground default: off
  const [wanderWeight, setWanderWeight] = useState(
    DEFAULT_BEHAVIOR_WANDER_WEIGHT
  );
  const [cohesionWeight, setCohesionWeight] = useState(
    DEFAULT_BEHAVIOR_COHESION_WEIGHT
  );
  const [alignmentWeight, setAlignmentWeight] = useState(
    DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT
  );
  const [separationWeight, setSeparationWeight] = useState(
    DEFAULT_BEHAVIOR_SEPARATION_WEIGHT
  );
  const [chaseWeight, setChaseWeight] = useState(DEFAULT_BEHAVIOR_CHASE_WEIGHT);
  const [avoidWeight, setAvoidWeight] = useState(DEFAULT_BEHAVIOR_AVOID_WEIGHT);
  const [separationRange, setSeparationRange] = useState(
    DEFAULT_BEHAVIOR_SEPARATION_RANGE
  );
  const [neighborRadius, setNeighborRadius] = useState(
    DEFAULT_BEHAVIOR_NEIGHBOR_RADIUS
  );

  useEffect(() => {
    if (behavior) {
      setBehaviorEnabled(behavior.enabled);
      setWanderWeight(behavior.wanderWeight);
      setCohesionWeight(behavior.cohesionWeight);
      setAlignmentWeight(behavior.alignmentWeight);
      setSeparationWeight(behavior.separationWeight);
      setChaseWeight(behavior.chaseWeight);
      setAvoidWeight(behavior.avoidWeight);
      setSeparationRange(behavior.separationRange);
      setNeighborRadius(behavior.neighborRadius);
    }
  }, [behavior]);

  const handleBehaviorChange = (
    property: keyof Behavior,
    value: number | boolean
  ) => {
    if (!behavior) return;

    switch (property) {
      case "enabled":
        setBehaviorEnabled(value as boolean);
        behavior.setEnabled(value as boolean);
        break;
      case "wanderWeight":
        setWanderWeight(value as number);
        behavior.wanderWeight = value as number;
        break;
      case "cohesionWeight":
        setCohesionWeight(value as number);
        behavior.cohesionWeight = value as number;
        break;
      case "alignmentWeight":
        setAlignmentWeight(value as number);
        behavior.alignmentWeight = value as number;
        break;
      case "separationWeight":
        setSeparationWeight(value as number);
        behavior.separationWeight = value as number;
        break;
      case "chaseWeight":
        setChaseWeight(value as number);
        behavior.chaseWeight = value as number;
        break;
      case "avoidWeight":
        setAvoidWeight(value as number);
        behavior.avoidWeight = value as number;
        break;
      case "separationRange":
        setSeparationRange(value as number);
        behavior.separationRange = value as number;
        break;
      case "neighborRadius":
        setNeighborRadius(value as number);
        behavior.neighborRadius = value as number;
        break;
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={behaviorEnabled}
            onChange={(e) => handleBehaviorChange("enabled", e.target.checked)}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange("wanderWeight", parseFloat(e.target.value))
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange("cohesionWeight", parseFloat(e.target.value))
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange(
                "alignmentWeight",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange(
                "separationWeight",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange(
                "separationRange",
                parseFloat(e.target.value)
              )
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Chase: {chaseWeight.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={chaseWeight}
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange("chaseWeight", parseFloat(e.target.value))
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange("avoidWeight", parseFloat(e.target.value))
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
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
            disabled={!behaviorEnabled}
            onChange={(e) =>
              handleBehaviorChange("neighborRadius", parseFloat(e.target.value))
            }
            className={`slider ${!behaviorEnabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
