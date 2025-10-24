import React from "react";
import { Field } from "./Field";
import "./Dropdown.css";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  label: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  disabled = false,
  label,
}: DropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <Field className="dropdown-field">
      <label>
        {label}
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`form-select ${disabled ? "disabled" : ""}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </Field>
  );
}
