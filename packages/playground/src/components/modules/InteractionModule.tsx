import { Dropdown } from "../ui/Dropdown";
import { Slider } from "../ui/Slider";
import { useInteraction } from "../../hooks/modules/useInteraction";

export function InteractionModule({ enabled = true }: { enabled?: boolean }) {
  const {
    state,
    setMode,
    setStrength,
    setRadius,
  } = useInteraction();

  const { mode, strength, radius } = state;

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => setMode(v as "attract" | "repel")}
        disabled={!enabled}
        options={[
          { value: "attract", label: "Attract" },
          { value: "repel", label: "Repel" },
        ]}
      />
      <Slider
        label="Strength"
        value={strength}
        min={0}
        max={1000}
        step={1}
        onChange={setStrength}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={radius}
        min={0}
        max={1000}
        step={1}
        onChange={setRadius}
        disabled={!enabled}
      />
    </>
  );
}
