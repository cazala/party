import { ColorPicker } from "./ui/ColorPicker";

interface RenderControlsProps {
  clearColor: string;
  onClearColorChange: (hex: string) => void;
  disabled: boolean;
}

export function RenderControls({
  clearColor,
  onClearColorChange,
  disabled,
}: RenderControlsProps) {
  return (
    <ColorPicker
      label="Clear Color"
      value={clearColor}
      onChange={onClearColorChange}
      disabled={disabled}
    />
  );
}