import { useEffect, useState } from "react";
import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Field } from "./ui/Field";
import { Metrics } from "./ui/Metrics";
import { useEngine } from "../hooks/useEngine";
import { useAppSelector } from "../hooks/useAppSelector";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { selectShowGrid, setShowGrid } from "../slices/performance";

export function PerformanceControls() {
  const dispatch = useAppDispatch();
  const showGrid = useAppSelector(selectShowGrid);

  // Local state for FPS and particle count (updated via interval)
  const [particleCount, setParticleCount] = useState(0);
  const [fps, setFPS] = useState(0);

  const {
    isWebGPU,
    constrainIterations,
    gridCellSize,
    maxNeighbors,
    setConstrainIterations,
    setCellSize,
    setMaxNeighbors,
    toggleRuntime,
    getFPS,
    getCount,
  } = useEngine();

  // Interval to update local state from engine getter functions
  useEffect(() => {
    const interval = setInterval(() => {
      setParticleCount(getCount());
      setFPS(getFPS());
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [getFPS, getCount]);
  return (
    <>
      <Checkbox
        checked={isWebGPU}
        onChange={() => toggleRuntime()}
        label="Use WebGPU"
      />

      <Slider
        label="Constrain Iterations"
        value={constrainIterations}
        min={1}
        max={100}
        step={1}
        onChange={setConstrainIterations}
      />

      <Slider
        label="Max Neighbors"
        value={maxNeighbors}
        min={1}
        max={10000}
        step={1}
        onChange={setMaxNeighbors}
      />

      <Slider
        label="Grid Cell Size"
        value={gridCellSize}
        min={16}
        max={128}
        step={8}
        onChange={setCellSize}
      />

      <Checkbox
        checked={showGrid}
        onChange={(checked) => dispatch(setShowGrid(checked))}
        label="Show Grid"
      />

      <Field>
        <Metrics label="Particles" value={particleCount.toLocaleString()} />
      </Field>
      <Field>
        <Metrics
          label="FPS"
          value={Math.min(Math.round(fps) || 0, 120).toLocaleString()}
        />
      </Field>
    </>
  );
}
