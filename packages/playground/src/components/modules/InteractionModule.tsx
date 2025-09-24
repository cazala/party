import { useState } from "react";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_INTERACTION_STRENGTH,
  DEFAULT_INTERACTION_RADIUS,
  Interaction,
} from "@cazala/party";
import { Dropdown } from "../ui/Dropdown";
import { Slider } from "../ui/Slider";

export function WebGPUInteractionControls({
  interaction,
  enabled = true,
}: {
  interaction: Interaction | null;
  enabled?: boolean;
}) {
  const [mode, setMode] = useState<"attract" | "repel">(
    DEFAULT_INTERACTION_MODE
  );
  const [strength, setStrength] = useState(DEFAULT_INTERACTION_STRENGTH);
  const [radius, setRadius] = useState(DEFAULT_INTERACTION_RADIUS);

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => {
          setMode(v as "attract" | "repel");
          interaction?.setMode(v as "attract" | "repel");
        }}
        disabled={!enabled}
        options={[
          { value: "attract", label: "Attract" },
          { value: "repel", label: "Repel" },
        ]}
      />
      <Slider
        label="Strength"
        value={strength}
        onChange={(v) => {
          setStrength(v);
          interaction?.setStrength(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={radius}
        onChange={(v) => {
          setRadius(v);
          interaction?.setRadius(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
