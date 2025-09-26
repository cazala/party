import { Slider } from "../ui/Slider";
import { useCollisions } from "../../hooks/modules/useCollisions";

export function CollisionsModule({ enabled = true }: { enabled?: boolean }) {
  const { restitution, setRestitution } = useCollisions();

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
