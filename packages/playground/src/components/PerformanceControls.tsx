import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Field } from "./ui/Field";
import { Metrics } from "./ui/Metrics";

interface PerformanceControlsProps {
  useWebGPU: boolean;
  onToggleEngineType: () => void;
  constrainIterations: number;
  onConstrainIterationsChange: (value: number) => void;
  cellSize: number;
  onCellSizeChange: (value: number) => void;
  particleCount: number;
  fps: number;
}

export function PerformanceControls({
  useWebGPU,
  onToggleEngineType,
  constrainIterations,
  onConstrainIterationsChange,
  cellSize,
  onCellSizeChange,
  particleCount,
  fps,
}: PerformanceControlsProps) {
  return (
    <>
      <Checkbox
        checked={useWebGPU}
        onChange={onToggleEngineType}
        label="Use WebGPU"
      />

      <Slider
        label="Constrain Iterations"
        value={constrainIterations}
        onChange={onConstrainIterationsChange}
      />
      <Slider
        label="Grid Cell Size"
        value={cellSize}
        onChange={onCellSizeChange}
      />

      <Field>
        <Metrics label="Particles" value={particleCount.toLocaleString()} />
      </Field>
      <Field>
        <Metrics label="FPS" value={fps.toFixed(1)} />
      </Field>
    </>
  );
}
