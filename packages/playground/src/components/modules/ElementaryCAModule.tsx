import { Slider } from "../ui/Slider";
import { useElementaryCA } from "../../hooks/modules/useElementaryCA";

export function ElementaryCAModule({ enabled = true }: { enabled?: boolean }) {
  const { rule, cellSize, setRule, setCellSize } = useElementaryCA();

  return (
    <>
      <Slider
        sliderId="eca.rule"
        label="Rule"
        value={rule}
        min={0}
        max={128}
        step={1}
        formatValue={(v) => `${Math.floor(v)}`}
        onChange={(v) => setRule(Math.floor(v))}
        disabled={!enabled}
      />
      <Slider
        sliderId="eca.cellSize"
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
