import { Slider } from "../ui/Slider";
import { useModules } from "../../hooks/useModules";

export function CollisionsModule({ enabled = true }: { enabled?: boolean }) {
  const { collisionsState, setCollisionsRestitution } = useModules();
  const { restitution } = collisionsState;

  return (
    <>
      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={setCollisionsRestitution}
        disabled={!enabled}
      />
    </>
  );
}
