import { useRef, useState } from "react";
import { Field } from "./Field";
import "./MultiColorPicker.css";

interface MultiColorPickerProps {
  colors: string[];
  onColorsChange: (colors: string[]) => void;
  label?: string;
}

export function MultiColorPicker({
  colors,
  onColorsChange,
  label = "Colors",
}: MultiColorPickerProps) {
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null); // Index of square being picked
  const [tempColor, setTempColor] = useState("#ffffff");
  const [pickerPosition, setPickerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleAddColorClick = (e: React.MouseEvent) => {
    // Add a new color to the array and start picking it
    const newIndex = colors.length;
    const defaultColor = "#ffffff";
    const updatedColors = [...colors, defaultColor];
    onColorsChange(updatedColors);

    // Start picking the newly added color
    setPickingIndex(newIndex);
    setTempColor(defaultColor);

    // Position the color picker near the clicked element
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPosition({
      x: rect.left,
      y: rect.top + 27, // Position slightly above the clicked square
    });

    // Small delay to ensure position is set before opening
    setTimeout(() => {
      colorPickerRef.current?.click();
    }, 10);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setTempColor(newColor);

    if (pickingIndex !== null) {
      // Update the color being picked in real-time
      const updatedColors = [...colors];
      updatedColors[pickingIndex] = newColor;
      onColorsChange(updatedColors);
    }
  };

  const handleColorCommit = () => {
    // When the picker closes, we're done picking
    setPickingIndex(null);
    setPickerPosition(null);
  };

  const handleRemoveColor = (index: number) => {
    const updatedColors = colors.filter((_, i) => i !== index);
    onColorsChange(updatedColors);
  };

  const handleClearAll = () => {
    onColorsChange([]);
  };

  return (
    <Field className="multi-color-picker-field">
      <label className="color-picker-label">
        {label}
        {colors.length > 0 && (
          <button onClick={handleClearAll} className="clear-colors-btn">
            Clear
          </button>
        )}
      </label>

      <div className="color-grid">
        {/* Color squares */}
        {colors.map((color, index) => (
          <div
            key={index}
            className={`color-square ${
              index === pickingIndex ? "picking" : ""
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handleRemoveColor(index)}
            title={
              index === pickingIndex ? `Picking color...` : `Remove ${color}`
            }
          />
        ))}

        {/* Add color button - always at the end */}
        <div
          className="color-square add-color-square"
          onClick={handleAddColorClick}
          title="Add new color"
        >
          <span className="add-color-icon">+</span>
        </div>
      </div>

      <input
        ref={colorPickerRef}
        type="color"
        style={{
          position: "fixed",
          left: pickerPosition?.x ?? -9999,
          top: pickerPosition?.y ?? -9999,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        value={tempColor}
        onChange={handleColorChange}
        onBlur={handleColorCommit}
      />
    </Field>
  );
}
