import { Slider } from "../ui/Slider";
import { useReactionDiffusion } from "../../hooks/modules/useReactionDiffusion";

export function ReactionDiffusionModule({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const {
    feed,
    kill,
    diffusionA,
    diffusionB,
    dt,
    cellSize,
    setFeed,
    setKill,
    setDiffusionA,
    setDiffusionB,
    setDt,
    setCellSize,
  } = useReactionDiffusion();

  return (
    <>
      <Slider
        sliderId="rd.feed"
        label="Feed"
        value={feed}
        min={0}
        max={0.1}
        step={0.0001}
        formatValue={(v) => v.toFixed(4)}
        onChange={setFeed}
        disabled={!enabled}
      />
      <Slider
        sliderId="rd.kill"
        label="Kill"
        value={kill}
        min={0}
        max={0.1}
        step={0.0001}
        formatValue={(v) => v.toFixed(4)}
        onChange={setKill}
        disabled={!enabled}
      />
      <Slider
        sliderId="rd.diffusionA"
        label="Diffusion A"
        value={diffusionA}
        min={0}
        max={2}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setDiffusionA}
        disabled={!enabled}
      />
      <Slider
        sliderId="rd.diffusionB"
        label="Diffusion B"
        value={diffusionB}
        min={0}
        max={2}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setDiffusionB}
        disabled={!enabled}
      />
      <Slider
        sliderId="rd.dt"
        label="Time Step"
        value={dt}
        min={0}
        max={2}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setDt}
        disabled={!enabled}
      />
      <Slider
        sliderId="rd.cellSize"
        label="Cell Size"
        value={cellSize}
        min={0.5}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setCellSize}
        disabled={!enabled}
      />
    </>
  );
}
