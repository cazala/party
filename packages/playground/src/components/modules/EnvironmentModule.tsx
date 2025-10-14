import { radToDeg, GravityDirection } from "@cazala/party";
import { Slider } from "../ui/Slider";
import { Dropdown } from "../ui/Dropdown";
import { useEnvironment } from "../../hooks/modules/useEnvironment";

export function EnvironmentModule({ enabled = true }: { enabled?: boolean }) {
  const {
    gravityStrength,
    dirX,
    dirY,
    inertia,
    friction,
    damping,
    mode,
    setGravityStrength,
    setInertia,
    setFriction,
    setDamping,
    setMode,
    setCustomAngleDegrees,
  } = useEnvironment();

  // Use mode directly from the state
  const direction = mode;

  // Calculate angle properly for custom mode
  let angle = 90; // Default to 90° (right) for custom mode
  if (direction === "custom") {
    // If we have valid dirX/dirY values (not both 0), calculate angle from them
    if (dirX !== 0 || dirY !== 0) {
      // Convert from dirX, dirY to degrees (0° = up, 90° = right, 180° = down, 270° = left)
      angle = (radToDeg(Math.atan2(dirX, -dirY)) + 360) % 360;
    }
  }

  return (
    <>
      <Slider
        sliderId="environment.gravityStrength"
        label="Gravity Strength"
        value={gravityStrength}
        onChange={setGravityStrength}
        min={0}
        max={3000}
        step={1}
        disabled={!enabled}
      />

      <Dropdown
        label="Gravity Direction"
        value={direction}
        onChange={(dir) => {
          setMode(dir as GravityDirection);
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
          sliderId="environment.gravityAngle"
          label="Gravity Angle"
          value={angle}
          onChange={setCustomAngleDegrees}
          min={0}
          max={360}
          step={1}
          disabled={!enabled}
          formatValue={(v) => `${v.toFixed(0)}°`}
        />
      )}

      <Slider
        sliderId="environment.inertia"
        label="Inertia"
        value={inertia}
        onChange={setInertia}
        min={0}
        max={10}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />

      <Slider
        sliderId="environment.friction"
        label="Friction"
        value={friction}
        onChange={setFriction}
        min={0}
        max={10}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />

      <Slider
        sliderId="environment.damping"
        label="Damping"
        value={damping}
        onChange={setDamping}
        min={0}
        max={1}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />
    </>
  );
}
