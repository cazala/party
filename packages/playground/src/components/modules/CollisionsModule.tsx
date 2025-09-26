import { Slider } from "../ui/Slider";
import { useCollisions } from "../../hooks/modules/useCollisions";

export function CollisionsModule({ enabled = true }: { enabled?: boolean }) {
  const { state, setRestitution } = useCollisions();
  const { restitution } = state;

  return (
    <>
      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={setRestitution}
        disabled={!enabled}
      />
    </>
  );
}
