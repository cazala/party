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
  const [oscillationMin, setOscillationMin] = useState<number>(min);
  const [oscillationMax, setOscillationMax] = useState<number>(max);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const phaseOffsetRef = useRef<number>(0);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const isDraggingHandleRef = useRef<'min' | 'max' | null>(null);
  const pausedOscillationSpeedRef = useRef<OscillationSpeed>('none');

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
      const range = oscillationMax - oscillationMin;
      const center = oscillationMin + range / 2;
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
      // Don't handle clicks if we're dragging a handle
      if (isDraggingHandleRef.current) {
        return;
      }
      
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

  const getSliderPosition = useCallback((value: number) => {
    const percentage = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percentage));
  }, [min, max]);

  const getValueFromPosition = useCallback((clientX: number) => {
    if (!sliderRef.current) return min;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = (clientX - rect.left) / rect.width;
    const rawValue = min + percentage * (max - min);
    
    // Round to nearest step
    const steppedValue = Math.round((rawValue - min) / step) * step + min;
    return Math.max(min, Math.min(max, steppedValue));
  }, [min, max, step]);

  const handleHandleMouseDown = useCallback((handleType: 'min' | 'max') => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Pause oscillation while dragging
      if (oscillationSpeed !== 'none') {
        pausedOscillationSpeedRef.current = oscillationSpeed;
        setOscillationSpeed('none'); // Actually pause the oscillation
      }
      isDraggingHandleRef.current = handleType;
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newValue = getValueFromPosition(moveEvent.clientX);
        
        if (handleType === 'min') {
          const newMin = Math.min(newValue, oscillationMax - step);
          setOscillationMin(newMin);
        } else {
          const newMax = Math.max(newValue, oscillationMin + step);
          setOscillationMax(newMax);
        }
      };
      
      const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        
        // Check if current value is outside new bounds and snap if needed
        let adjustedValue = value;
        let needsSnap = false;
        
        if (value < oscillationMin) {
          adjustedValue = oscillationMin;
          needsSnap = true;
        } else if (value > oscillationMax) {
          adjustedValue = oscillationMax;
          needsSnap = true;
        }
        
        if (needsSnap) {
          onChange(adjustedValue);
        }
        
        // Resume oscillation with new bounds if it was previously oscillating
        if (pausedOscillationSpeedRef.current !== 'none') {
          // Recalculate phase offset for current position within new bounds
          const range = oscillationMax - oscillationMin;
          const center = oscillationMin + range / 2;
          const amplitude = range / 2;
          const normalizedValue = (adjustedValue - center) / amplitude;
          const clampedNormalized = Math.max(-1, Math.min(1, normalizedValue));
          
          let targetSin;
          if (Math.abs(clampedNormalized) < 1e-10) {
            targetSin = 0;
          } else {
            targetSin = Math.sign(clampedNormalized) * Math.pow(Math.abs(clampedNormalized), 1 / MULTIPLIER);
          }
          targetSin = Math.max(-1, Math.min(1, targetSin));
          
          if (targetSin >= 0) {
            phaseOffsetRef.current = Math.asin(targetSin);
          } else {
            phaseOffsetRef.current = -Math.asin(-targetSin);
          }
          
          // Reset timing to restart smooth oscillation
          startTimeRef.current = null;
          
          // Actually resume the oscillation by setting the speed back
          const resumeSpeed = pausedOscillationSpeedRef.current;
          pausedOscillationSpeedRef.current = 'none';
          
          // Resume oscillation immediately
          setOscillationSpeed(resumeSpeed);
        }
        
        isDraggingHandleRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
  }, [getValueFromPosition, oscillationMin, oscillationMax, step, value, onChange, oscillationSpeed]);

  const animate = useCallback(
    (timestamp: number) => {
      // Don't animate if dragging handles or oscillation is off
      if (oscillationSpeed === "none" || isDraggingHandleRef.current) return;

      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const speedMultiplier = speedMultipliers[oscillationSpeed];
      const frequency = speedMultiplier * 0.001; // Convert to Hz
      const range = oscillationMax - oscillationMin;
      const center = oscillationMin + range / 2;
      const amplitude = range / 2;

      // Apply phase offset to start from current position
      const phase = elapsed * frequency * 2 * Math.PI + phaseOffsetRef.current;

      // Custom curve that whips through extremes and dwells in middle
      // Uses sign(sin(x)) * sin⁶(x) which creates a very sharp whip at extremes
      const sinValue = Math.sin(phase);
      const customCurve =
        Math.sign(sinValue) * Math.pow(Math.abs(sinValue), MULTIPLIER);
      const oscillatedValue = center + customCurve * amplitude;
      const clampedValue = Math.max(oscillationMin, Math.min(oscillationMax, oscillatedValue));

      // Round to nearest step
      const steppedValue = Math.round((clampedValue - min) / step) * step + min;
      const finalValue = Math.max(min, Math.min(max, steppedValue));

      onChange(finalValue);

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [oscillationSpeed, oscillationMin, oscillationMax, min, max, step, onChange, speedMultipliers]
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

  // Initialize oscillation bounds when slider props change
  useEffect(() => {
    setOscillationMin(min);
    setOscillationMax(max);
  }, [min, max]);

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
        <div className="slider-container">
          <input
            ref={sliderRef}
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
          {(oscillationSpeed !== "none" || isDraggingHandleRef.current || pausedOscillationSpeedRef.current !== 'none') && (
            <>
              <div
                className="oscillation-handle oscillation-handle-min"
                style={{ left: `${getSliderPosition(oscillationMin)}%` }}
                onMouseDown={handleHandleMouseDown('min')}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                title={`Min: ${formatValue(oscillationMin)}`}
              />
              <div
                className="oscillation-handle oscillation-handle-max"
                style={{ left: `${getSliderPosition(oscillationMax)}%` }}
                onMouseDown={handleHandleMouseDown('max')}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                title={`Max: ${formatValue(oscillationMax)}`}
              />
            </>
          )}
        </div>
      </label>
    </Field>
  );
}
