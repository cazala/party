import { useState } from "react";
import {
  DEFAULT_BOUNDARY_RESTITUTION,
  DEFAULT_BOUNDARY_FRICTION,
  DEFAULT_BOUNDARY_MODE,
  DEFAULT_BOUNDARY_REPEL_DISTANCE,
  DEFAULT_BOUNDARY_REPEL_STRENGTH,
  Boundary,
  BoundaryMode,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";

export function BoundaryModule({
  boundary,
  enabled = true,
}: {
  boundary: Boundary | null;
  enabled?: boolean;
}) {
  const [restitution, setRestitution] = useState(DEFAULT_BOUNDARY_RESTITUTION);
  const [friction, setFriction] = useState(DEFAULT_BOUNDARY_FRICTION);
  const [mode, setMode] = useState<BoundaryMode>(DEFAULT_BOUNDARY_MODE);
  const [repelDistance, setRepelDistance] = useState(
    DEFAULT_BOUNDARY_REPEL_DISTANCE
  );
  const [repelStrength, setRepelStrength] = useState(
    DEFAULT_BOUNDARY_REPEL_STRENGTH
  );

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => {
          setMode(v as BoundaryMode);
          boundary?.setMode(v as BoundaryMode);
        }}
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
        onChange={(v) => {
          setRestitution(v);
          boundary?.setRestitution(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Friction"
        value={friction}
        onChange={(v) => {
          setFriction(v);
          boundary?.setFriction(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Repel Distance"
        value={repelDistance}
        onChange={(v) => {
          setRepelDistance(v);
          boundary?.setRepelDistance(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Repel Strength"
        value={repelStrength}
        onChange={(v) => {
          setRepelStrength(v);
          boundary?.setRepelStrength(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
