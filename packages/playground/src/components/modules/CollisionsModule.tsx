import { useState } from "react";
import { DEFAULT_COLLISIONS_RESTITUTION, Collisions } from "@cazala/party";
import { Slider } from "../ui/Slider";

export function CollisionsModule({
  collisions,
  enabled = true,
}: {
  collisions: Collisions | null;
  enabled?: boolean;
}) {
  const [restitution, setRestitution] = useState(
    DEFAULT_COLLISIONS_RESTITUTION
  );

  return (
    <>
      <Slider
        label="Restitution"
        value={restitution}
        onChange={(v) => {
          setRestitution(v);
          collisions?.setRestitution(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
