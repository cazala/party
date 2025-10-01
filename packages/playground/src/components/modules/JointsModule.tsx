import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useJoints } from "../../hooks/modules/useJoints";

export function JointsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    momentum,
    enableCollisions,
    restitution,
    separation,
    friction,
    setMomentum,
    setEnableCollisions,
    setRestitution,
    setSeparation,
    setFriction,
  } = useJoints();

  return (
    <>
      <Slider
        label="Momentum"
        value={momentum}
        min={0}
        max={1}
        step={0.01}
        onChange={setMomentum}
        disabled={!enabled}
      />

      <Checkbox
        label="Collisions"
        checked={enableCollisions}
        onChange={setEnableCollisions}
        disabled={!enabled}
      />

      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={setRestitution}
        disabled={!enabled || !enableCollisions}
      />

      <Slider
        label="Separation"
        value={separation}
        min={0}
        max={1}
        step={0.01}
        onChange={setSeparation}
        disabled={!enabled || !enableCollisions}
      />

      <Slider
        label="Friction"
        value={friction}
        min={0}
        max={1}
        step={0.01}
        onChange={setFriction}
        disabled={!enabled || !enableCollisions}
      />
    </>
  );
}
