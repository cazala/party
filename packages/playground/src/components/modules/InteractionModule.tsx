import { Dropdown } from "../ui/Dropdown";
import { Slider } from "../ui/Slider";
import { useModules } from "../../hooks/useModules";

export function InteractionModule({ enabled = true }: { enabled?: boolean }) {
  const {
    interactionState,
    setInteractionMode,
    setInteractionStrength,
    setInteractionRadius,
  } = useModules();

  const { mode, strength, radius } = interactionState;

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => setInteractionMode(v as "attract" | "repel")}
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
        onChange={setInteractionStrength}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={radius}
        min={0}
        max={1000}
        step={1}
        onChange={setInteractionRadius}
        disabled={!enabled}
      />
    </>
  );
}
