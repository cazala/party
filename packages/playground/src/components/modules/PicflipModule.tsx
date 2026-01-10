import { Slider } from "../ui/Slider";
import { usePicflip } from "../../hooks/modules/usePicflip";

export function PicflipModule({ enabled = true }: { enabled?: boolean }) {
  const {
    flipRatio,
    gravityX,
    gravityY,
    density,
    maxVelocity,
    setFlipRatio,
    setGravityX,
    setGravityY,
    setDensity,
    setMaxVelocity,
  } = usePicflip();

  return (
    <>
      <Slider
        sliderId="picflip.flipRatio"
        label="FLIP Ratio"
        value={flipRatio}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setFlipRatio}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.gravityX"
        label="Gravity X"
        value={gravityX}
        min={0}
        max={2000}
        step={1}
        onChange={setGravityX}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.gravityY"
        label="Gravity Y"
        value={gravityY}
        min={0}
        max={2000}
        step={1}
        onChange={setGravityY}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.density"
        label="Target Density"
        value={density}
        min={0}
        max={100}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setDensity}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.maxVelocity"
        label="Max Velocity"
        value={maxVelocity}
        min={10}
        max={5000}
        step={10}
        onChange={setMaxVelocity}
        disabled={!enabled}
      />
    </>
  );
}
