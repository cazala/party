import { useState } from "react";
import {
  DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH,
  DEFAULT_ENVIRONMENT_INERTIA,
  DEFAULT_ENVIRONMENT_FRICTION,
  DEFAULT_ENVIRONMENT_DAMPING,
  Environment,
} from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";

export function EnvironmentModule({
  environment,
  enabled = true,
}: {
  environment: Environment | null;
  enabled?: boolean;
}) {
  const [strength, setStrength] = useState(
    DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH
  );
  const [direction, setDirection] = useState<
    "up" | "down" | "left" | "right" | "inwards" | "outwards" | "custom"
  >("down");
  const [angle, setAngle] = useState(90); // degrees, for custom only
  const [inertia, setInertia] = useState(DEFAULT_ENVIRONMENT_INERTIA);
  const [friction, setFriction] = useState(DEFAULT_ENVIRONMENT_FRICTION);
  const [damping, setDamping] = useState(DEFAULT_ENVIRONMENT_DAMPING);

  return (
    <>
      <Slider
        label="Gravity Strength"
        value={strength}
        onChange={(v) => {
          setStrength(v);
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
          const newDir = dir as typeof direction;
          setDirection(newDir);
          environment?.setGravityDirection?.(newDir);
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
            setAngle(deg);
            const rad = (deg * Math.PI) / 180;
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
          setInertia(v);
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
          setFriction(v);
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
          setDamping(v);
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
