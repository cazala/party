import { useEffect } from "react";
import { Behavior, radToDeg, degToRad } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectBehaviorModule,
  setBehaviorWander,
  setBehaviorCohesion,
  setBehaviorAlignment,
  setBehaviorRepulsion,
  setBehaviorChase,
  setBehaviorAvoid,
  setBehaviorSeparation,
  setBehaviorViewRadius,
  setBehaviorViewAngle,
} from "../../modules/modules/slice";

export function BehaviorModule({
  behavior,
  enabled = true,
}: {
  behavior: Behavior | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const behaviorState = useAppSelector(selectBehaviorModule);
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

  // Sync Redux state with behavior module when behavior is available
  useEffect(() => {
    if (behavior && enabled) {
      behavior.setWander(wander);
      behavior.setCohesion(cohesion);
      behavior.setAlignment(alignment);
      behavior.setRepulsion(repulsion);
      behavior.setChase(chase);
      behavior.setAvoid(avoid);
      behavior.setSeparation(separation);
      behavior.setViewRadius(viewRadius);
      behavior.setViewAngle(viewAngle); // viewAngle is already in radians
    }
  }, [
    behavior,
    enabled,
    wander,
    cohesion,
    alignment,
    repulsion,
    chase,
    avoid,
    separation,
    viewRadius,
    viewAngle,
  ]);

  return (
    <>
      <Slider
        label="Wander"
        value={wander}
        min={0}
        max={100}
        step={0.1}
        onChange={(v) => {
          dispatch(setBehaviorWander(v));
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
          dispatch(setBehaviorCohesion(v));
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
          dispatch(setBehaviorAlignment(v));
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
          dispatch(setBehaviorRepulsion(v));
          behavior?.setRepulsion(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="Separation"
        value={separation}
        onChange={(v) => {
          dispatch(setBehaviorSeparation(v));
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
          dispatch(setBehaviorChase(v));
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
          dispatch(setBehaviorAvoid(v));
          behavior?.setAvoid(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="View Radius"
        value={viewRadius}
        min={0}
        max={500}
        step={1}
        onChange={(v) => {
          dispatch(setBehaviorViewRadius(v));
          behavior?.setViewRadius(v);
        }}
        disabled={!enabled}
      />

      <Slider
        label="View Angle"
        value={viewAngleDegrees}
        min={0}
        max={360}
        step={1}
        formatValue={(v) => `${v.toFixed(0)}°`}
        onChange={(v) => {
          dispatch(setBehaviorViewAngle(degToRad(v)));
          behavior?.setViewAngle(degToRad(v));
        }}
        disabled={!enabled}
      />
    </>
  );
}
