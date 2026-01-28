import { Slider } from "../ui/Slider";
import { useElementaryCA } from "../../hooks/modules/useElementaryCA";

export function ElementaryCAModule({ enabled = true }: { enabled?: boolean }) {
  const { rule, setRule } = useElementaryCA();

  return (
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
  );
}
