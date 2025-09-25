import { useEffect } from "react";
import { Interaction } from "@cazala/party";
import { Dropdown } from "../ui/Dropdown";
import { Slider } from "../ui/Slider";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectInteractionModule,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
} from "../../modules/modules/slice";

export function InteractionModule({
  interaction,
  enabled = true,
}: {
  interaction: Interaction | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const interactionState = useAppSelector(selectInteractionModule);
  const { mode, strength, radius } = interactionState;

  // Sync Redux state with interaction module when interaction is available
  useEffect(() => {
    if (interaction && enabled) {
      interaction.setMode(mode);
      interaction.setStrength(strength);
      interaction.setRadius(radius);
    }
  }, [interaction, enabled, mode, strength, radius]);

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => {
          dispatch(setInteractionMode(v as "attract" | "repel"));
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
        min={0}
        max={1000}
        step={1}
        onChange={(v) => {
          dispatch(setInteractionStrength(v));
          interaction?.setStrength(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Radius"
        value={radius}
        min={0}
        max={1000}
        step={1}
        onChange={(v) => {
          dispatch(setInteractionRadius(v));
          interaction?.setRadius(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
