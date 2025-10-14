import { Slider } from "../ui/Slider";
import { useTrails } from "../../hooks/modules/useTrails";

export function TrailsModule({ enabled = true }: { enabled?: boolean }) {
  const { trailDecay, trailDiffuse, setDecay, setDiffuse } = useTrails();

  return (
    <>
      <Slider
        sliderId="trails.trailDecay"
        label="Trail Decay"
        value={trailDecay}
        min={2}
        max={20}
        step={1}
        onChange={setDecay}
        disabled={!enabled}
      />
      <Slider
        sliderId="trails.trailDiffuse"
        label="Trail Diffuse"
        value={trailDiffuse}
        min={0}
        max={5}
        step={1}
        onChange={setDiffuse}
        formatValue={(v) => `${v.toFixed(0)}px`}
        disabled={!enabled}
      />
    </>
  );
}
