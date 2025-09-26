import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Field } from "./ui/Field";
import { Metrics } from "./ui/Metrics";
import { useEngine } from "../hooks/useEngine";

export function PerformanceControls() {
  const {
    isWebGPU,
    constrainIterations,
    gridCellSize,
    particleCount,
    fps,
    setConstrainIterations,
    setCellSize,
    toggleRuntime,
  } = useEngine();
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
        label="Grid Cell Size"
        value={gridCellSize}
        min={8}
        max={128}
        step={8}
        onChange={setCellSize}
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
