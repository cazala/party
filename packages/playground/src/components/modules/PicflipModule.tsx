import { Slider } from "../ui/Slider";
import { usePicflip } from "../../hooks/modules/usePicflip";

export function PicflipModule({ enabled = true }: { enabled?: boolean }) {
  const { flipRatio, density, radius, pressure, setFlipRatio, setDensity, setRadius, setPressure } =
    usePicflip();

  return (
    <>
      <Slider
        sliderId="picflip.flipRatio"
        label="PIC/FLIP Ratio"
        value={flipRatio}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setFlipRatio}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.radius"
        label="Radius"
        value={radius}
        min={5}
        max={200}
        step={1}
        formatValue={(v) => v.toFixed(0)}
        onChange={setRadius}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.density"
        label="Target Density"
        value={density}
        min={0}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setDensity}
        disabled={!enabled}
      />
      <Slider
        sliderId="picflip.pressure"
        label="Pressure"
        value={pressure}
        min={0}
        max={3000}
        step={10}
        formatValue={(v) => v.toFixed(0)}
        onChange={setPressure}
        disabled={!enabled}
      />
    </>
  );
}
