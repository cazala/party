import { useEffect } from "react";
import { Collisions } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectCollisionsModule,
  setCollisionsRestitution,
} from "../../modules/modules/slice";

export function CollisionsModule({
  collisions,
  enabled = true,
}: {
  collisions: Collisions | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const collisionsState = useAppSelector(selectCollisionsModule);
  const { restitution } = collisionsState;

  // Sync Redux state with collisions module when collisions is available
  useEffect(() => {
    if (collisions && enabled) {
      collisions.setRestitution(restitution);
    }
  }, [collisions, enabled, restitution]);

  return (
    <>
      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => {
          dispatch(setCollisionsRestitution(v));
          collisions?.setRestitution(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
