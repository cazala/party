import { Slider } from "../ui/Slider";
import { Checkbox } from "../ui/Checkbox";
import { useJoints } from "../../hooks/modules/useJoints";

export function JointsModule({ enabled = true }: { enabled?: boolean }) {
  const {
    momentum,
    enableParticleCollisions,
    enableJointCollisions,
    restitution,
    separation,
    steps,
    friction,
    setMomentum,
    setEnableParticleCollisions,
    setEnableJointCollisions,
    setRestitution,
    setSeparation,
    setSteps,
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
        label="Particle Collisions"
        checked={enableParticleCollisions}
        onChange={setEnableParticleCollisions}
        disabled={!enabled}
      />

      <Checkbox
        label="Joint Collisions"
        checked={enableJointCollisions}
        onChange={setEnableJointCollisions}
        disabled={!enabled}
      />

      <Slider
        label="Steps"
        value={steps}
        min={0}
        max={100}
        step={1}
        onChange={setSteps}
        disabled={
          !enabled || (!enableParticleCollisions && !enableJointCollisions)
        }
      />

      <Slider
        label="Friction"
        value={friction}
        min={0}
        max={1}
        step={0.01}
        onChange={setFriction}
        disabled={!enabled || !enableParticleCollisions}
      />

      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={setRestitution}
        disabled={!enabled || !enableParticleCollisions}
      />

      <Slider
        label="Separation"
        value={separation}
        min={0}
        max={1}
        step={0.01}
        onChange={setSeparation}
        disabled={!enabled || !enableJointCollisions}
      />
    </>
  );
}
