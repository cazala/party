import { radToDeg, degToRad } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { useModules } from "../../hooks/useModules";

export function BehaviorModule({ enabled = true }: { enabled?: boolean }) {
  const {
    behaviorState,
    setBehaviorWander,
    setBehaviorCohesion,
    setBehaviorAlignment,
    setBehaviorRepulsion,
    setBehaviorChase,
    setBehaviorAvoid,
    setBehaviorSeparation,
    setBehaviorViewRadius,
    setBehaviorViewAngle,
  } = useModules();

  const {
    wander,
    cohesion,
    alignment,
    repulsion,
    chase,
    avoid,
    separation,
    viewRadius,
    viewAngle,
  } = behaviorState;

  // Convert radians to degrees for display
  const viewAngleDegrees = radToDeg(viewAngle);

  return (
    <>
      <Slider
        label="Wander"
        value={wander}
        min={0}
        max={100}
        step={0.1}
        onChange={setBehaviorWander}
        disabled={!enabled}
      />

      <Slider
        label="Cohesion"
        value={cohesion}
        min={0}
        max={10}
        step={0.1}
        onChange={setBehaviorCohesion}
        disabled={!enabled}
      />

      <Slider
        label="Alignment"
        value={alignment}
        min={0}
        max={10}
        step={0.1}
        onChange={setBehaviorAlignment}
        disabled={!enabled}
      />

      <Slider
        label="Repulsion"
        value={repulsion}
        min={0}
        max={10}
        step={0.1}
        onChange={setBehaviorRepulsion}
        disabled={!enabled}
      />

      <Slider
        label="Separation"
        value={separation}
        onChange={setBehaviorSeparation}
        disabled={!enabled}
      />

      <Slider
        label="Chase"
        value={chase}
        min={0}
        max={10}
        step={0.1}
        onChange={setBehaviorChase}
        disabled={!enabled}
      />

      <Slider
        label="Avoid"
        value={avoid}
        min={0}
        max={10}
        step={0.1}
        onChange={setBehaviorAvoid}
        disabled={!enabled}
      />

      <Slider
        label="View Radius"
        value={viewRadius}
        min={0}
        max={500}
        step={1}
        onChange={setBehaviorViewRadius}
        disabled={!enabled}
      />

      <Slider
        label="View Angle"
        value={viewAngleDegrees}
        min={0}
        max={360}
        step={1}
        formatValue={(v) => `${v.toFixed(0)}°`}
        onChange={(v) => setBehaviorViewAngle(degToRad(v))}
        disabled={!enabled}
      />
    </>
  );
}
