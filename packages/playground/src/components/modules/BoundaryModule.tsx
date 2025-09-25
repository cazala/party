import { useEffect } from "react";
import { Boundary, BoundaryMode } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectBoundaryModule,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
} from "../../modules/modules/slice";

export function BoundaryModule({
  boundary,
  enabled = true,
}: {
  boundary: Boundary | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const boundaryState = useAppSelector(selectBoundaryModule);
  const { mode, restitution, friction, repelDistance, repelStrength } =
    boundaryState;

  // Sync Redux state with boundary module when boundary is available
  useEffect(() => {
    if (boundary && enabled) {
      boundary.setMode(mode as BoundaryMode);
      boundary.setRestitution(restitution);
      boundary.setFriction(friction);
      boundary.setRepelDistance(repelDistance);
      boundary.setRepelStrength(repelStrength);
    }
  }, [
    boundary,
    enabled,
    mode,
    restitution,
    friction,
    repelDistance,
    repelStrength,
  ]);

  return (
    <>
      <Dropdown
        label="Mode"
        value={mode}
        onChange={(v) => {
          dispatch(setBoundaryMode(v as BoundaryMode));
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
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => {
          dispatch(setBoundaryRestitution(v));
          boundary?.setRestitution(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Friction"
        value={friction}
        onChange={(v) => {
          dispatch(setBoundaryFriction(v));
          boundary?.setFriction(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Repel Distance"
        value={repelDistance}
        min={0}
        max={1000}
        step={1000}
        onChange={(v) => {
          dispatch(setBoundaryRepelDistance(v));
          boundary?.setRepelDistance(v);
        }}
        disabled={!enabled}
      />
      <Slider
        label="Repel Strength"
        value={repelStrength}
        min={0}
        max={1000}
        step={1000}
        onChange={(v) => {
          dispatch(setBoundaryRepelStrength(v));
          boundary?.setRepelStrength(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
