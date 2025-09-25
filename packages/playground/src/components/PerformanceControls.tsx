import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Field } from "./ui/Field";
import { Metrics } from "./ui/Metrics";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import {
  selectEngineState,
  setConstrainIterations,
  setGridCellSize,
} from "../modules/engine/slice";

interface PerformanceControlsProps {
  onConstrainIterationsChange?: (value: number) => void;
  onCellSizeChange?: (value: number) => void;
  onToggleEngineType?: () => void;
}

export function PerformanceControls({
  onConstrainIterationsChange,
  onCellSizeChange,
  onToggleEngineType,
}: PerformanceControlsProps = {}) {
  const dispatch = useAppDispatch();
  const engineState = useAppSelector(selectEngineState);
  const {
    isWebGPU,
    constrainIterations,
    gridCellSize,
    particleCount,
    fps,
  } = engineState;
  return (
    <>
      <Checkbox
        checked={isWebGPU}
        onChange={() => onToggleEngineType?.()}
        label="Use WebGPU"
      />

      <Slider
        label="Constrain Iterations"
        value={constrainIterations}
        min={1}
        max={100}
        step={1}
        onChange={(value) => {
          dispatch(setConstrainIterations(value));
          onConstrainIterationsChange?.(value);
        }}
      />
      <Slider
        label="Grid Cell Size"
        value={gridCellSize}
        min={8}
        max={128}
        step={8}
        onChange={(value) => {
          dispatch(setGridCellSize(value));
          onCellSizeChange?.(value);
        }}
      />

      <Field>
        <Metrics label="Particles" value={particleCount.toLocaleString()} />
      </Field>
      <Field>
        <Metrics label="FPS" value={Math.min(Math.round(fps) || 0, 120).toLocaleString()} />
      </Field>
    </>
  );
}
