import { radToDeg, degToRad } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { useBehavior } from "../../hooks/modules/useBehavior";

export function BehaviorModule({ enabled = true }: { enabled?: boolean }) {
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
    setWander,
    setCohesion,
    setAlignment,
    setRepulsion,
    setChase,
    setAvoid,
    setSeparation,
    setViewRadius,
    setViewAngle,
  } = useBehavior();

  // Convert radians to degrees for display
  const viewAngleDegrees = radToDeg(viewAngle);

  return (
    <>
      <Slider
        sliderId="behavior.wander"
        label="Wander"
        value={wander}
        min={0}
        max={100}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setWander}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.cohesion"
        label="Cohesion"
        value={cohesion}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setCohesion}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.alignment"
        label="Alignment"
        value={alignment}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setAlignment}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.repulsion"
        label="Repulsion"
        value={repulsion}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setRepulsion}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.separation"
        label="Separation"
        value={separation}
        onChange={setSeparation}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.chase"
        label="Chase"
        value={chase}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setChase}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.avoid"
        label="Avoid"
        value={avoid}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setAvoid}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.viewRadius"
        label="View Radius"
        value={viewRadius}
        min={0}
        max={500}
        step={1}
        onChange={setViewRadius}
        disabled={!enabled}
      />

      <Slider
        sliderId="behavior.viewAngle"
        label="View Angle"
        value={viewAngleDegrees}
        min={0}
        max={360}
        step={1}
        formatValue={(v) => `${v.toFixed(0)}°`}
        onChange={(v) => setViewAngle(degToRad(v))}
        disabled={!enabled}
      />
    </>
  );
}
