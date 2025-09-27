import { BoundaryMode } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useBoundary } from "../../hooks/modules/useBoundary";

export function BoundaryModule({ enabled = true }: { enabled?: boolean }) {
  const {
    mode,
    restitution,
    friction,
    repelDistance,
    repelStrength,
    setMode,
    setRestitution,
    setFriction,
    setRepelDistance,
    setRepelStrength,
  } = useBoundary();

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => setMode(v as BoundaryMode)}
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
        onChange={setRestitution}
        disabled={!enabled}
      />
      <Slider
        label="Friction"
        value={friction}
        onChange={setFriction}
        disabled={!enabled}
      />
      <Slider
        label="Repel Distance"
        value={repelDistance}
        min={0}
        max={1000}
        step={1}
        onChange={setRepelDistance}
        disabled={!enabled}
      />
      <Slider
        label="Repel Strength"
        value={repelStrength}
        min={0}
        max={1000}
        step={1}
        onChange={setRepelStrength}
        disabled={!enabled}
      />
    </>
  );
}
