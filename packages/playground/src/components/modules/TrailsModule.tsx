import { Slider } from "../ui/Slider";
import { useModules } from "../../hooks/useModules";

export function TrailsModule({ enabled = true }: { enabled?: boolean }) {
  const { trailsState, setTrailsDecay, setTrailsDiffuse } = useModules();

  const { trailDecay, trailDiffuse } = trailsState;

  return (
    <>
      <Slider
        label="Trail Decay"
        value={trailDecay}
        min={2}
        max={20}
        step={1}
        onChange={setTrailsDecay}
        disabled={!enabled}
      />
      <Slider
        label="Trail Diffuse"
        value={trailDiffuse}
        min={0}
        max={5}
        step={1}
        onChange={setTrailsDiffuse}
        formatValue={(v) => `${v.toFixed(0)}px`}
        disabled={!enabled}
      />
    </>
  );
}
