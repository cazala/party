import { useState } from "react";
import {
  DEFAULT_TRAILS_TRAIL_DECAY,
  DEFAULT_TRAILS_TRAIL_DIFFUSE,
  Trails,
} from "@cazala/party";
import { Slider } from "../ui/Slider";

export function TrailsModule({
  trails,
  enabled = true,
}: {
  trails: Trails | null;
  enabled?: boolean;
}) {
  const [trailDecay, setTrailDecay] = useState(DEFAULT_TRAILS_TRAIL_DECAY);
  const [trailDiffuse, setTrailDiffuse] = useState(
    DEFAULT_TRAILS_TRAIL_DIFFUSE
  );

  return (
    <>
      <Slider
        label="Trail Decay"
        value={trailDecay}
        min={2}
        max={20}
        step={1}
        onChange={(v) => {
          setTrailDecay(v);
          trails?.setTrailDecay(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Trail Diffuse"
        value={trailDiffuse}
        min={0}
        max={5}
        step={1}
        onChange={(v) => {
          setTrailDiffuse(v);
          trails?.setTrailDiffuse(v);
        }}
        formatValue={(v) => `${v.toFixed(0)}px`}
        disabled={!enabled}
      />
    </>
  );
}
