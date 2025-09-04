import { useState, useEffect } from "react";

interface SimulationControlsProps {
  setConstrainIterations?: (v: number) => void;
}

export function SimulationControls({
  setConstrainIterations,
}: SimulationControlsProps) {
  const [constrainIterations, setConstrainIterationsVal] = useState(50);

  const handleConstrainIterationsChange = (value: number) => {
    setConstrainIterationsVal(value);
    setConstrainIterations?.(value);
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
    </div>
  );
}