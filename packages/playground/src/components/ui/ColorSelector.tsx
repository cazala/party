import { useRef, useState } from "react";
import { DEFAULT_COLOR_PALETTE } from "@cazala/party/legacy";
import { Field } from "./Field";
import "./ColorSelector.css";

interface ColorSelectorProps {
  colors: string[];
  onColorsChange: (colors: string[]) => void;
  label?: string;
}

export function ColorSelector({
  colors,
  onColorsChange,
  label = "Colors",
}: ColorSelectorProps) {
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null); // Index of square being picked
  const [tempColor, setTempColor] = useState("#ffffff");

  const handleAddColorClick = () => {
    // Add a new color to the array and start picking it
    const newIndex = colors.length;
    const defaultColor = "#ffffff";
    const updatedColors = [...colors, defaultColor];
    onColorsChange(updatedColors);

    // Start picking the newly added color
    setPickingIndex(newIndex);
    setTempColor(defaultColor);
    colorPickerRef.current?.click();
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
  };

  const handleRemoveColor = (index: number) => {
    const updatedColors = colors.filter((_, i) => i !== index);
    onColorsChange(updatedColors);
  };

  const handleClearAll = () => {
    onColorsChange([]);
  };

  return (
    <Field className="color-selector-field">
      <label className="color-selector-label">
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
        style={{ display: "none" }}
        value={tempColor}
        onChange={handleColorChange}
        onBlur={handleColorCommit}
      />

      {colors.length === 0 ? (
        <div className="default-palette-notice">
          Using default palette ({DEFAULT_COLOR_PALETTE.length} colors)
        </div>
      ) : null}
    </Field>
  );
}
