import { useEffect, useState } from "react";

interface WebGPUBehaviorLike {
  setWanderWeight: (v: number) => void;
  setCohesionWeight: (v: number) => void;
  setAlignmentWeight: (v: number) => void;
  setSeparationWeight: (v: number) => void;
  setChaseWeight: (v: number) => void;
  setAvoidWeight: (v: number) => void;
  setSeparationRange: (v: number) => void;
  setViewRadius: (v: number) => void;
  setViewAngle: (v: number) => void;
  setEnabled?: (v: boolean) => void;
}

export function WebGPUBehaviorControls({
  behavior,
  hideEnabled = false,
}: {
  behavior: WebGPUBehaviorLike | null;
  hideEnabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(true);
  const [wander, setWander] = useState(0);
  const [cohesion, setCohesion] = useState(0);
  const [alignment, setAlignment] = useState(0);
  const [separation, setSeparation] = useState(0);
  const [chase, setChase] = useState(0);
  const [avoid, setAvoid] = useState(0);
  const [sepRange, setSepRange] = useState(30);
  const [viewRadius, setVR] = useState(100);
  const [viewAngle, setVA] = useState(Math.PI * 2);

  useEffect(() => {
    // could hydrate from module if getters existed
  }, [behavior]);

  return (
    <div className="control-section">
      {!hideEnabled && (
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
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
            max="1"
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
