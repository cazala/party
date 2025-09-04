import { useState } from "react";

interface SimulationControlsProps {
  setConstrainIterations?: (v: number) => void;
  setZoomSensitivity?: (v: number) => void;
}

export function SimulationControls({
  setConstrainIterations,
  setZoomSensitivity,
}: SimulationControlsProps) {
  const [constrainIterations, setConstrainIterationsVal] = useState(50);
  const [zoomSensitivity, setZoomSensitivityVal] = useState(0.01);

  const handleConstrainIterationsChange = (value: number) => {
    setConstrainIterationsVal(value);
    setConstrainIterations?.(value);
  };

  const handleZoomSensitivityChange = (value: number) => {
    setZoomSensitivityVal(value);
    setZoomSensitivity?.(value);
  };

  return (
    <div>
      <div className="control-group">
        <label>
          Constrain Iterations: {constrainIterations}
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={constrainIterations}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              handleConstrainIterationsChange(v);
            }}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Zoom Speed: {(zoomSensitivity * 1000).toFixed(1)}
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={zoomSensitivity * 1000}
            onChange={(e) => {
              const v = parseFloat(e.target.value) / 1000;
              handleZoomSensitivityChange(v);
            }}
            className="slider"
          />
        </label>
      </div>
    </div>
  );
}