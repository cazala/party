import { Field } from "./Field";
import "./ColorPicker.css";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({
  label,
  value,
  onChange,
  disabled = false,
}: ColorPickerProps) {
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <Field>
      <div className="color-picker-container">
        <label className="color-picker-label">{label}:</label>
        <div className="color-picker-wrapper">
          <div
            className="color-square"
            style={{
              backgroundColor: value,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (disabled) return;
              document.getElementById(`color-picker-${label}`)?.click();
            }}
            title={`${label}: ${value}`}
          />
          <input
            id={`color-picker-${label}`}
            type="color"
            value={value}
            onChange={handleColorPickerChange}
            disabled={disabled}
            className="color-picker-input"
          />
        </div>
      </div>
    </Field>
  );
}