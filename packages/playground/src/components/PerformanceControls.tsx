import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Field } from "./ui/Field";
import { Metrics } from "./ui/Metrics";
import { useEngine } from "../contexts/EngineContext";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import {
  selectEngineState,
  setConstrainIterations,
  setGridCellSize,
} from "../modules/engine/slice";

export function PerformanceControls() {
  const dispatch = useAppDispatch();
  const engineState = useAppSelector(selectEngineState);
  const {
    setConstrainIterations: setConstrainIterationsThunk,
    setCellSize,
    toggleRuntime,
  } = useEngine();
  const { isWebGPU, constrainIterations, gridCellSize, particleCount, fps } =
    engineState;
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
        onChange={(value) => {
          dispatch(setConstrainIterations(value));
          setConstrainIterationsThunk(value);
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
          setCellSize(value);
        }}
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
