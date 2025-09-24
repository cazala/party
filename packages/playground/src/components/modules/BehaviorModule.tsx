import { useState } from "react";
import {
  DEFAULT_BEHAVIOR_WANDER_WEIGHT,
  DEFAULT_BEHAVIOR_COHESION_WEIGHT,
  DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_WEIGHT,
  DEFAULT_BEHAVIOR_CHASE_WEIGHT,
  DEFAULT_BEHAVIOR_AVOID_WEIGHT,
  DEFAULT_BEHAVIOR_SEPARATION_RANGE,
  DEFAULT_BEHAVIOR_VIEW_RADIUS,
  DEFAULT_BEHAVIOR_VIEW_ANGLE,
  Behavior,
} from "@cazala/party";
import { Slider } from "../ui/Slider";

export function BehaviorModule({
  behavior,
  enabled = true,
}: {
  behavior: Behavior | null;
  enabled?: boolean;
}) {
  const [wander, setWander] = useState(DEFAULT_BEHAVIOR_WANDER_WEIGHT);
  const [cohesion, setCohesion] = useState(DEFAULT_BEHAVIOR_COHESION_WEIGHT);
  const [alignment, setAlignment] = useState(DEFAULT_BEHAVIOR_ALIGNMENT_WEIGHT);
  const [separation, setSeparation] = useState(
    DEFAULT_BEHAVIOR_SEPARATION_WEIGHT
  );
  const [chase, setChase] = useState(DEFAULT_BEHAVIOR_CHASE_WEIGHT);
  const [avoid, setAvoid] = useState(DEFAULT_BEHAVIOR_AVOID_WEIGHT);
  const [sepRange, setSepRange] = useState(DEFAULT_BEHAVIOR_SEPARATION_RANGE);
  const [viewRadius, setVR] = useState(DEFAULT_BEHAVIOR_VIEW_RADIUS);
  const [viewAngle, setVA] = useState(DEFAULT_BEHAVIOR_VIEW_ANGLE);

  return (
    <>
      <Slider
        label="Wander"
        value={wander}
        onChange={(v) => {
          setWander(v);
          behavior?.setWanderWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Cohesion"
        value={cohesion}
        onChange={(v) => {
          setCohesion(v);
          behavior?.setCohesionWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Alignment"
        value={alignment}
        onChange={(v) => {
          setAlignment(v);
          behavior?.setAlignmentWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Repulsion"
        value={separation}
        onChange={(v) => {
          setSeparation(v);
          behavior?.setSeparationWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Chase"
        value={chase}
        onChange={(v) => {
          setChase(v);
          behavior?.setChaseWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Avoid"
        value={avoid}
        onChange={(v) => {
          setAvoid(v);
          behavior?.setAvoidWeight(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Separation"
        value={sepRange}
        onChange={(v) => {
          setSepRange(v);
          behavior?.setSeparationRange(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="View Radius"
        value={viewRadius}
        onChange={(v) => {
          setVR(v);
          behavior?.setViewRadius(v);
        }}
      />

      <Slider
        label="View Angle"
        value={viewAngle}
        formatValue={(v) => `${v.toFixed(0)}°`}
        onChange={(v) => {
          setVA(v);
          behavior?.setViewAngle(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
