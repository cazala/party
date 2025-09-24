import React from "react";
import { Field } from "./Field";
import "./Slider.css";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  formatValue?: (value: number) => string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  formatValue = (v) => v.toString(),
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  return (
    <Field className="slider-field">
      <label>
        {label}: {formatValue(value)}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`slider ${disabled ? "disabled" : ""}`}
        />
      </label>
    </Field>
  );
}
