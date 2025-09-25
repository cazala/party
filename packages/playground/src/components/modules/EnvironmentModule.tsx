import { useEffect } from "react";
import { Environment } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useAppDispatch, useAppSelector } from "../../modules/hooks";
import {
  selectEnvironmentModule,
  setEnvironmentGravityStrength,
  setEnvironmentInertia,
  setEnvironmentFriction,
  setEnvironmentDamping,
  setEnvironmentDirection,
} from "../../modules/modules/slice";

export function EnvironmentModule({
  environment,
  enabled = true,
}: {
  environment: Environment | null;
  enabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const environmentState = useAppSelector(selectEnvironmentModule);
  const { gravityStrength, dirX, dirY, inertia, friction, damping } = environmentState;
  
  // Calculate direction and angle from dirX, dirY
  const getDirectionFromVector = (x: number, y: number): string => {
    if (x === 0 && y === 1) return "down";
    if (x === 0 && y === -1) return "up";
    if (x === -1 && y === 0) return "left";
    if (x === 1 && y === 0) return "right";
    // For inwards/outwards we'd need center point logic, simplified for now
    return "custom";
  };
  
  const direction = getDirectionFromVector(dirX, dirY);
  const angle = Math.atan2(dirY, dirX) * (180 / Math.PI) + 90; // Convert to degrees
  
  // Sync Redux state with environment module when environment is available
  useEffect(() => {
    if (environment && enabled) {
      environment.setGravityStrength(gravityStrength);
      environment.setInertia(inertia);
      environment.setFriction(friction);
      environment.setDamping(damping);
      // Set direction vector
      environment.setGravityDirection?.(direction as any);
    }
  }, [environment, enabled, gravityStrength, inertia, friction, damping, direction]);

  return (
    <>
      <Slider
        label="Gravity Strength"
        value={gravityStrength}
        onChange={(v) => {
          dispatch(setEnvironmentGravityStrength(v));
          environment?.setGravityStrength(v);
        }}
        min={0}
        max={3000}
        step={1}
        disabled={!enabled}
      />

      <Dropdown
        label="Gravity Direction"
        value={direction}
        onChange={(dir) => {
          let newDirX = 0, newDirY = 0;
          switch (dir) {
            case "down": newDirX = 0; newDirY = 1; break;
            case "up": newDirX = 0; newDirY = -1; break;
            case "left": newDirX = -1; newDirY = 0; break;
            case "right": newDirX = 1; newDirY = 0; break;
            default: newDirX = dirX; newDirY = dirY; break;
          }
          dispatch(setEnvironmentDirection({ dirX: newDirX, dirY: newDirY }));
          environment?.setGravityDirection?.(dir as any);
        }}
        options={[
          { value: "down", label: "Down" },
          { value: "up", label: "Up" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "inwards", label: "Inwards" },
          { value: "outwards", label: "Outwards" },
          { value: "custom", label: "Custom" },
        ]}
        disabled={!enabled}
      />

      {direction === "custom" && (
        <Slider
          label="Gravity Angle"
          value={angle}
          onChange={(deg) => {
            const rad = (deg - 90) * Math.PI / 180; // Convert from degrees, adjust for coordinate system
            const newDirX = Math.cos(rad);
            const newDirY = Math.sin(rad);
            dispatch(setEnvironmentDirection({ dirX: newDirX, dirY: newDirY }));
            environment?.setGravityAngle?.(rad);
          }}
          min={0}
          max={360}
          step={1}
          disabled={!enabled}
          formatValue={(v) => `${v}°`}
        />
      )}

      <Slider
        label="Inertia"
        value={inertia}
        onChange={(v) => {
          dispatch(setEnvironmentInertia(v));
          environment?.setInertia?.(v);
        }}
        min={0}
        max={10}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />

      <Slider
        label="Friction"
        value={friction}
        onChange={(v) => {
          dispatch(setEnvironmentFriction(v));
          environment?.setFriction?.(v);
        }}
        min={0}
        max={10}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />

      <Slider
        label="Damping"
        value={damping}
        onChange={(v) => {
          dispatch(setEnvironmentDamping(v));
          environment?.setDamping?.(v);
        }}
        min={0}
        max={1}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />
    </>
  );
}
