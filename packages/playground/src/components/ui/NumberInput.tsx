import React from 'react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export default function NumberInput({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step = 1,
  placeholder
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      // Apply min/max constraints if provided
      let constrainedValue = newValue;
      if (min !== undefined && constrainedValue < min) {
        constrainedValue = min;
      }
      if (max !== undefined && constrainedValue > max) {
        constrainedValue = max;
      }
      onChange(constrainedValue);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type="number"
        className="form-input"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={handleChange}
      />
    </div>
  );
}