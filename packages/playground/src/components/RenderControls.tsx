import { ColorPicker } from "./ui/ColorPicker";
import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { useEngine } from "../hooks/useEngine";
import { useLines } from "../hooks/modules/useLines";

interface RenderControlsProps {
  disabled?: boolean;
}

export function RenderControls({ disabled = false }: RenderControlsProps = {}) {
  const { clearColor, setClearColor } = useEngine();
  const { enabled: linesEnabled, lineWidth, setEnabled: setLinesEnabled, setLineWidth } = useLines();

  // Convert RGBA to hex
  const rgbaToHex = (color: { r: number; g: number; b: number; a: number }) => {
    const toHex = (value: number) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  // Convert hex to RGBA
  const hexToRgba = (hex: string, alpha: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
          a: alpha,
        }
      : { r: 0, g: 0, b: 0, a: 1 };
  };

  const clearColorHex = rgbaToHex(clearColor);
  return (
    <div>
      <ColorPicker
        label="Clear Color"
        value={clearColorHex}
        onChange={(hex) => {
          const rgba = hexToRgba(hex, 1);
          setClearColor(rgba);
        }}
        disabled={disabled}
      />
      
      <Checkbox
        label="Show Lines"
        checked={linesEnabled}
        onChange={setLinesEnabled}
        disabled={disabled}
      />
      
      {linesEnabled && (
        <Slider
          label="Line Width"
          value={lineWidth}
          min={0.1}
          max={10}
          step={0.1}
          onChange={setLineWidth}
          disabled={disabled}
          formatValue={(v) => v.toFixed(1)}
        />
      )}
    </div>
  );
}
