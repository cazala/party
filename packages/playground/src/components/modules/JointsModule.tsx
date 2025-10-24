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
        sliderId="joints.momentum"
        label="Momentum"
        value={momentum}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
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
        sliderId="joints.steps"
        label="Steps"
        value={steps}
        min={1}
        max={100}
        step={1}
        onChange={setSteps}
        disabled={
          !enabled || (!enableParticleCollisions && !enableJointCollisions)
        }
      />

      <Slider
        sliderId="joints.friction"
        label="Friction"
        value={friction}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setFriction}
        disabled={!enabled || !enableParticleCollisions}
      />

      <Slider
        sliderId="joints.restitution"
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setRestitution}
        disabled={!enabled || !enableParticleCollisions}
      />

      <Slider
        sliderId="joints.separation"
        label="Separation"
        value={separation}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setSeparation}
        disabled={!enabled || !enableJointCollisions}
      />
    </>
  );
}
