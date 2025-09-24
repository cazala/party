import { useState } from "react";
import {
  DEFAULT_BEHAVIOR_WANDER,
  DEFAULT_BEHAVIOR_COHESION,
  DEFAULT_BEHAVIOR_ALIGNMENT,
  DEFAULT_BEHAVIOR_REPULSION,
  DEFAULT_BEHAVIOR_CHASE,
  DEFAULT_BEHAVIOR_AVOID,
  DEFAULT_BEHAVIOR_SEPARATION,
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
  const [wander, setWander] = useState(DEFAULT_BEHAVIOR_WANDER);
  const [cohesion, setCohesion] = useState(DEFAULT_BEHAVIOR_COHESION);
  const [alignment, setAlignment] = useState(DEFAULT_BEHAVIOR_ALIGNMENT);
  const [repulsion, setRepulsion] = useState(DEFAULT_BEHAVIOR_REPULSION);
  const [chase, setChase] = useState(DEFAULT_BEHAVIOR_CHASE);
  const [avoid, setAvoid] = useState(DEFAULT_BEHAVIOR_AVOID);
  const [separation, setSeparation] = useState(DEFAULT_BEHAVIOR_SEPARATION);
  const [viewRadius, setViewRadius] = useState(DEFAULT_BEHAVIOR_VIEW_RADIUS);
  const [viewAngle, setViewAngle] = useState(DEFAULT_BEHAVIOR_VIEW_ANGLE);

  return (
    <>
      <Slider
        label="Wander"
        value={wander}
        min={0}
        max={100}
        step={0.1}
        onChange={(v) => {
          setWander(v);
          behavior?.setWander(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Cohesion"
        value={cohesion}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => {
          setCohesion(v);
          behavior?.setCohesion(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Alignment"
        value={alignment}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => {
          setAlignment(v);
          behavior?.setAlignment(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Repulsion"
        value={repulsion}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => {
          setRepulsion(v);
          behavior?.setRepulsion(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Separation"
        value={separation}
        onChange={(v) => {
          setSeparation(v);
          behavior?.setSeparation(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Chase"
        value={chase}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => {
          setChase(v);
          behavior?.setChase(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Avoid"
        value={avoid}
        min={0}
        max={10}
        step={0.1}
        onChange={(v) => {
          setAvoid(v);
          behavior?.setAvoid(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="View Radius"
        value={viewRadius}
        onChange={(v) => {
          setViewRadius(v);
          behavior?.setViewRadius(v);
        }}
      />

      <Slider
        label="View Angle"
        value={viewAngle}
        formatValue={(v) => `${v.toFixed(0)}°`}
        onChange={(v) => {
          setViewAngle(v);
          behavior?.setViewAngle(v);
        }}
        disabled={!enabled}
      />
    </>
  );
}
