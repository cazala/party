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
    setGravityStrength,
    setInertia,
    setFriction,
    setDamping,
    setDirection,
  } = useEnvironment();

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

  return (
    <>
      <Slider
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
          let newDirX = 0,
            newDirY = 0;
          switch (dir) {
            case "down":
              newDirX = 0;
              newDirY = 1;
              break;
            case "up":
              newDirX = 0;
              newDirY = -1;
              break;
            case "left":
              newDirX = -1;
              newDirY = 0;
              break;
            case "right":
              newDirX = 1;
              newDirY = 0;
              break;
            default:
              newDirX = dirX;
              newDirY = dirY;
              break;
          }
          setDirection(newDirX, newDirY);
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
            const rad = ((deg - 90) * Math.PI) / 180; // Convert from degrees, adjust for coordinate system
            const newDirX = Math.cos(rad);
            const newDirY = Math.sin(rad);
            setDirection(newDirX, newDirY);
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
        onChange={setInertia}
        min={0}
        max={10}
        step={0.01}
        disabled={!enabled}
        formatValue={(v) => v.toFixed(2)}
      />

      <Slider
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
