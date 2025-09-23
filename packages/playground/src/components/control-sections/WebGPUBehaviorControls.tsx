import { useEffect, useState } from "react";
import {
  DEFAULT_BEHAVIOR_WANDER_WEIGHT,
  DEFAULT_BEHAVIOR_COHESION_WEIGHT,
  DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_WEIGHT,
  DEFAULT_BEHAVIOR_CHASE_WEIGHT,
  DEFAULT_BEHAVIOR_AVOID_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_RANGE,
  DEFAULT_BEHAVIOR_VIEW_RADIUS,
  DEFAULT_BEHAVIOR_VIEW_ANGLE,
  Behavior,
} from "@cazala/party";

export function WebGPUBehaviorControls({
  behavior,
  hideEnabled = false,
  enabled = true,
  isInitialized = true,
  isInitializing = false,
}: {
  behavior: Behavior | null;
  hideEnabled?: boolean;
  enabled?: boolean;
  isInitialized?: boolean;
  isInitializing?: boolean;
}) {
  const [internalEnabled, setInternalEnabled] = useState(true);
  const [wander, setWander] = useState(DEFAULT_BEHAVIOR_WANDER_WEIGHT);
  const [cohesion, setCohesion] = useState(DEFAULT_BEHAVIOR_COHESION_WEIGHT);
  const [alignment, setAlignment] = useState(DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT);
  const [separation, setSeparation] = useState(
    DEFAULT_BEHAVIOR_SEPARATION_WEIGHT
  );
  const [chase, setChase] = useState(DEFAULT_BEHAVIOR_CHASE_WEIGHT);
  const [avoid, setAvoid] = useState(DEFAULT_BEHAVIOR_AVOID_WEIGHT);
  const [sepRange, setSepRange] = useState(DEFAULT_BEHAVIOR_SEPARATION_RANGE);
  const [viewRadius, setVR] = useState(DEFAULT_BEHAVIOR_VIEW_RADIUS);
  const [viewAngle, setVA] = useState(DEFAULT_BEHAVIOR_VIEW_ANGLE);

  useEffect(() => {
    // Sync UI state with actual module values when behavior module changes
    if (behavior && isInitialized && !isInitializing) {
      setWander(behavior.getWanderWeight());
      setCohesion(behavior.getCohesionWeight());
      setAlignment(behavior.getAlignmentWeight());
      setSeparation(behavior.getSeparationWeight());
      setChase(behavior.getChaseWeight());
      setAvoid(behavior.getAvoidWeight());
      setSepRange(behavior.getSeparationRange());
      setVR(behavior.getViewRadius());
      setVA(behavior.getViewAngle());
      setInternalEnabled(behavior.isEnabled());
    }
  }, [behavior, isInitialized, isInitializing]);

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
                behavior?.setEnabled?.(e.target.checked);
              }}
            />
            Enabled
          </label>
        </div>
      )}

      <div className="control-group">
        <label>
          Wander: {wander.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={wander}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setWander(v);
              behavior?.setWanderWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Cohesion: {cohesion.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={cohesion}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setCohesion(v);
              behavior?.setCohesionWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Alignment: {alignment.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={alignment}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setAlignment(v);
              behavior?.setAlignmentWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Repulsion: {separation.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={separation}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setSeparation(v);
              behavior?.setSeparationWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Separation: {sepRange.toFixed(0)}
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            value={sepRange}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setSepRange(v);
              behavior?.setSeparationRange(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Chase: {chase.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={chase}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setChase(v);
              behavior?.setChaseWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Avoid: {avoid.toFixed(1)}
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={avoid}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setAvoid(v);
              behavior?.setAvoidWeight(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          View Radius: {viewRadius.toFixed(0)}
          <input
            type="range"
            min="0"
            max="500"
            step="1"
            value={viewRadius}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVR(v);
              behavior?.setViewRadius(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          View Angle: {Math.round((viewAngle * 180) / Math.PI)}°
          <input
            type="range"
            min="0"
            max={2 * Math.PI}
            step="0.017"
            value={viewAngle}
            disabled={!enabled}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVA(v);
              behavior?.setViewAngle(v);
            }}
            className={`slider ${!enabled ? "disabled" : ""}`}
          />
        </label>
      </div>
    </div>
  );
}
