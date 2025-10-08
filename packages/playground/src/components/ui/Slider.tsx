import React, { useState, useEffect, useRef, useCallback } from "react";
import { Field } from "./Field";
import "./Slider.css";

type OscillationSpeed = "none" | "slow" | "normal" | "fast";

const MULTIPLIER = 2;

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
  const [oscillationSpeed, setOscillationSpeed] =
    useState<OscillationSpeed>("none");
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const phaseOffsetRef = useRef<number>(0);

  const speedMultipliers = {
    none: 0,
    slow: 0.01,
    normal: 0.05,
    fast: 0.2,
  };

  const speedColors = {
    slow: "#4ade80", // green
    normal: "#fbbf24", // yellow
    fast: "#ef4444", // red
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    // Stop oscillation when user manually changes value
    if (oscillationSpeed !== "none") {
      stopOscillation();
    }
    onChange(newValue);
  };

  const stopOscillation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setOscillationSpeed("none");
    startTimeRef.current = null;
  }, []);

  const startOscillation = useCallback(
    (speed: OscillationSpeed) => {
      if (speed === "none") {
        stopOscillation();
        return;
      }

      // Calculate phase offset to start from current value
      const range = max - min;
      const center = min + range / 2;
      const amplitude = range / 2;

      // Find the phase that would give us the current value
      // Using inverse of our custom curve: y = center + amplitude * sign(sin(x)) * sin⁶(x)
      const normalizedValue = (value - center) / amplitude;
      const clampedNormalized = Math.max(-1, Math.min(1, normalizedValue));

      // For our custom curve f(x) = sign(sin(x)) * sin⁶(x)
      // We need to find x such that f(x) = normalizedValue
      // Since sin⁶(x) = normalizedValue when sin(x) = ⁶√|normalizedValue|
      let targetSin;
      if (Math.abs(clampedNormalized) < 1e-10) {
        // Very close to zero, start from center
        targetSin = 0;
      } else {
        targetSin =
          Math.sign(clampedNormalized) *
          Math.pow(Math.abs(clampedNormalized), 1 / MULTIPLIER);
      }

      // Clamp targetSin to valid range [-1, 1]
      targetSin = Math.max(-1, Math.min(1, targetSin));

      // Calculate phase based on which half of the sine wave we want
      if (targetSin >= 0) {
        phaseOffsetRef.current = Math.asin(targetSin);
      } else {
        phaseOffsetRef.current = -Math.asin(-targetSin);
      }

      startTimeRef.current = null;
      setOscillationSpeed(speed);
    },
    [value, stopOscillation, min, max]
  );

  const cycleOscillationSpeed = useCallback(() => {
    const speeds: OscillationSpeed[] = ["none", "slow", "normal", "fast"];
    const currentIndex = speeds.indexOf(oscillationSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];

    startOscillation(nextSpeed);
  }, [oscillationSpeed, startOscillation]);

  const handleSliderClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        cycleOscillationSpeed();
      } else if (oscillationSpeed !== "none") {
        // Stop oscillation on regular click to allow manual control
        stopOscillation();
      }
    },
    [cycleOscillationSpeed, oscillationSpeed, stopOscillation]
  );

  const animate = useCallback(
    (timestamp: number) => {
      if (oscillationSpeed === "none") return;

      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const speedMultiplier = speedMultipliers[oscillationSpeed];
      const frequency = speedMultiplier * 0.001; // Convert to Hz
      const range = max - min;
      const center = min + range / 2;
      const amplitude = range / 2;

      // Apply phase offset to start from current position
      const phase = elapsed * frequency * 2 * Math.PI + phaseOffsetRef.current;

      // Custom curve that whips through extremes and dwells in middle
      // Uses sign(sin(x)) * sin⁶(x) which creates a very sharp whip at extremes
      const sinValue = Math.sin(phase);
      const customCurve =
        Math.sign(sinValue) * Math.pow(Math.abs(sinValue), MULTIPLIER);
      const oscillatedValue = center + customCurve * amplitude;
      const clampedValue = Math.max(min, Math.min(max, oscillatedValue));

      // Round to nearest step
      const steppedValue = Math.round((clampedValue - min) / step) * step + min;
      const finalValue = Math.max(min, Math.min(max, steppedValue));

      onChange(finalValue);

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [oscillationSpeed, min, max, step, onChange, speedMultipliers]
  );

  useEffect(() => {
    if (oscillationSpeed !== "none") {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [oscillationSpeed]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Field className="slider-field">
      <label>
        <div className="slider-label-container">
          <span>
            {label}: {formatValue(value)}
          </span>
          {oscillationSpeed !== "none" && (
            <div
              className="oscillation-indicator"
              style={{
                backgroundColor:
                  speedColors[oscillationSpeed as keyof typeof speedColors],
              }}
              onClick={stopOscillation}
              title={`Oscillating at ${oscillationSpeed} speed (click to stop)`}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onClick={handleSliderClick}
          disabled={disabled}
          className={`slider ${disabled ? "disabled" : ""}`}
        />
      </label>
    </Field>
  );
}
