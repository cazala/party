import { useEffect } from "react";
import { Trails } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectTrailsModule,
  setTrailsDecay,
  setTrailsDiffuse,
} from "../../modules/modules/slice";

export function TrailsModule({
  trails,
  enabled = true,
}: {
  trails: Trails | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const trailsState = useAppSelector(selectTrailsModule);
  const { trailDecay, trailDiffuse } = trailsState;
  
  // Sync Redux state with trails module when trails is available
  useEffect(() => {
    if (trails && enabled) {
      trails.setTrailDecay(trailDecay);
      trails.setTrailDiffuse(trailDiffuse);
    }
  }, [trails, enabled, trailDecay, trailDiffuse]);

  return (
    <>
      <Slider
        label="Trail Decay"
        value={trailDecay}
        min={2}
        max={20}
        step={1}
        onChange={(v) => {
          dispatch(setTrailsDecay(v));
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
          dispatch(setTrailsDiffuse(v));
          trails?.setTrailDiffuse(v);
        }}
        formatValue={(v) => `${v.toFixed(0)}px`}
        disabled={!enabled}
      />
    </>
  );
}
