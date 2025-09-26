import { BoundaryMode } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useModules } from "../../hooks/useModules";

export function BoundaryModule({ enabled = true }: { enabled?: boolean }) {
  const {
    boundaryState,
    setBoundaryMode,
    setBoundaryRestitution,
    setBoundaryFriction,
    setBoundaryRepelDistance,
    setBoundaryRepelStrength,
  } = useModules();

  const { mode, restitution, friction, repelDistance, repelStrength } =
    boundaryState;

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => setBoundaryMode(v as BoundaryMode)}
        disabled={!enabled}
        options={[
          { value: "bounce", label: "Bounce" },
          { value: "warp", label: "Warp" },
          { value: "kill", label: "Kill" },
          { value: "none", label: "None" },
        ]}
      />
      <Slider
        label="Restitution"
        value={restitution}
        min={0}
        max={1}
        step={0.01}
        onChange={setBoundaryRestitution}
        disabled={!enabled}
      />
      <Slider
        label="Friction"
        value={friction}
        onChange={setBoundaryFriction}
        disabled={!enabled}
      />
      <Slider
        label="Repel Distance"
        value={repelDistance}
        min={0}
        max={1000}
        step={1000}
        onChange={setBoundaryRepelDistance}
        disabled={!enabled}
      />
      <Slider
        label="Repel Strength"
        value={repelStrength}
        min={0}
        max={1000}
        step={1000}
        onChange={setBoundaryRepelStrength}
        disabled={!enabled}
      />
    </>
  );
}
