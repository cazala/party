import React, { useState, useEffect, useRef, useCallback } from "react";
import { Field } from "./Field";
import { useOscillators } from "../../hooks/useOscillators";
import { useEngine } from "../../hooks/useEngine";
import { OscillationSpeed } from "../../slices/oscillators";
import "./Slider.css";

const MULTIPLIER = 2;

type ExtendedOscillationSpeed = OscillationSpeed | "none";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label: string;
  formatValue?: (value: number) => string;
  sliderId?: string; // Optional - enables oscillator when provided
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
  sliderId,
}: SliderProps) {
  // Oscillator hook - only works if sliderId is provided
  const {
    speed: reduxOscillationSpeed,
    customMin: reduxCustomMin,
    customMax: reduxCustomMax,
    isOscillating,
    setOscillator,
    removeOscillator,
    updateMin,
    updateMax,
  } = useOscillators(sliderId);

  // Local state for animation and UI
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const phaseOffsetRef = useRef<number>(0);
  const lastValueRef = useRef<number>(value);
  const lastDirectionRef = useRef<-1 | 0 | 1>(0);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const isDraggingHandleRef = useRef<"min" | "max" | null>(null);
  const pausedOscillationSpeedRef = useRef<ExtendedOscillationSpeed>("none");
  const activePointerIdRef = useRef<number | null>(null);

  // Local dragging state for handles (using state to trigger re-renders)
  const [draggingMin, setDraggingMin] = useState<number | null>(null);
  const [draggingMax, setDraggingMax] = useState<number | null>(null);

  // Current oscillation state (from Redux or 'none' if no sliderId)
  const oscillationSpeed: ExtendedOscillationSpeed = sliderId
    ? reduxOscillationSpeed
    : "none";
  // Use dragging values if they exist, otherwise use Redux values
  const oscillationMin =
    draggingMin !== null ? draggingMin : reduxCustomMin ?? min;
  const oscillationMax =
    draggingMax !== null ? draggingMax : reduxCustomMax ?? max;

  // Initialize bounds in Redux when slider mounts
  useEffect(() => {
    if (
      sliderId &&
      !isOscillating &&
      (reduxCustomMin === undefined || reduxCustomMax === undefined)
    ) {
      // Set initial bounds but don't start oscillating
      if (reduxCustomMin === undefined) updateMin(min);
      if (reduxCustomMax === undefined) updateMax(max);
    }
  }, [
    sliderId,
    min,
    max,
    isOscillating,
    reduxCustomMin,
    reduxCustomMax,
    updateMin,
    updateMax,
  ]);

  // Clear dragging state when Redux has updated and we're not actively dragging
  useEffect(() => {
    if (!isDraggingHandleRef.current) {
      // Only clear if Redux values match what we were dragging
      if (
        draggingMin !== null &&
        Math.abs((reduxCustomMin ?? min) - draggingMin) < 0.01
      ) {
        setDraggingMin(null);
      }
      if (
        draggingMax !== null &&
        Math.abs((reduxCustomMax ?? max) - draggingMax) < 0.01
      ) {
        setDraggingMax(null);
      }
    }
  }, [reduxCustomMin, reduxCustomMax, draggingMin, draggingMax, min, max]);

  // Keep a ref of the isPlaying state to avoid re-rendering when it changes
  const { isPlaying } = useEngine();

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
    lastValueRef.current = newValue;
    onChange(newValue);
  };

  const stopOscillation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sliderId) {
      removeOscillator();
    }
    startTimeRef.current = null;
  }, [sliderId, removeOscillator]);

  const startOscillation = useCallback(
    (speed: OscillationSpeed) => {
      if (!sliderId) return;

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

      // Calculate phase based on desired direction (preserve current direction)
      const asinVal = Math.asin(targetSin);
      const candidate0 = asinVal; // in [-pi/2, pi/2]
      const candidate1 = Math.PI - asinVal; // the other sine solution
      const desiredDir = lastDirectionRef.current;
      const cos0 = Math.cos(candidate0);
      if (desiredDir < 0) {
        // choose decreasing branch (cos negative)
        phaseOffsetRef.current = cos0 < 0 ? candidate0 : candidate1;
      } else if (desiredDir > 0) {
        // choose increasing branch (cos positive)
        phaseOffsetRef.current = cos0 >= 0 ? candidate0 : candidate1;
      } else {
        // no prior direction info, keep principal value
        phaseOffsetRef.current = candidate0;
      }
      // Nudge away from extrema to avoid zero derivative stalls
      if (Math.abs(Math.cos(phaseOffsetRef.current)) < 1e-6) {
        const epsilon = 1e-3;
        phaseOffsetRef.current += (desiredDir >= 0 ? 1 : -1) * epsilon;
      }

      startTimeRef.current = null;

      // Update Redux state
      setOscillator({
        speed,
        customMin: oscillationMin,
        customMax: oscillationMax,
      });
    },
    [value, sliderId, oscillationMin, oscillationMax, setOscillator]
  );

  const cycleOscillationSpeed = useCallback(() => {
    if (!sliderId) return;

    const speeds: OscillationSpeed[] = ["slow", "normal", "fast"];

    if (oscillationSpeed === "none") {
      // If not oscillating, start with slow
      startOscillation("slow");
    } else {
      // Cycle through the speeds
      const currentIndex = speeds.indexOf(oscillationSpeed as OscillationSpeed);
      const nextIndex = (currentIndex + 1) % speeds.length;
      const nextSpeed = speeds[nextIndex];
      startOscillation(nextSpeed);
    }
  }, [sliderId, oscillationSpeed, startOscillation]);

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

  const getSliderPosition = useCallback(
    (value: number) => {
      const percentage = ((value - min) / (max - min)) * 100;
      return Math.max(0, Math.min(100, percentage));
    },
    [min, max]
  );

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return min;

      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = (clientX - rect.left) / rect.width;
      const rawValue = min + percentage * (max - min);

      // Round to nearest step
      const steppedValue = Math.round((rawValue - min) / step) * step + min;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step]
  );

  const handleHandlePointerDown = useCallback(
    (handleType: "min" | "max") => {
      return (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Capture the pointer so we don't lose events
        const target = e.currentTarget as HTMLElement;
        try {
          target.setPointerCapture(e.pointerId);
        } catch {}
        activePointerIdRef.current = e.pointerId;

        // Pause oscillation while dragging
        if (oscillationSpeed !== "none") {
          pausedOscillationSpeedRef.current = oscillationSpeed;
          if (sliderId) {
            removeOscillator();
          }
        }

        isDraggingHandleRef.current = handleType;

        // Snapshot both bounds at drag start so UI does not depend on Redux while dragging
        const snapshotMin = reduxCustomMin ?? min;
        const snapshotMax = reduxCustomMax ?? max;
        setDraggingMin(snapshotMin);
        setDraggingMax(snapshotMax);

        // Initialize dragging state for the handle being dragged at the pointer position
        const newValue = getValueFromPosition(e.clientX);
        if (handleType === "min") {
          const newMin = Math.min(newValue, snapshotMax - step);
          setDraggingMin(newMin);
        } else {
          const newMax = Math.max(newValue, snapshotMin + step);
          setDraggingMax(newMax);
        }
      };
    },
    [
      getValueFromPosition,
      reduxCustomMax,
      reduxCustomMin,
      min,
      max,
      step,
      oscillationSpeed,
      sliderId,
      removeOscillator,
    ]
  );

  const handleHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingHandleRef.current) return;
      if (activePointerIdRef.current !== e.pointerId) return;

      const handleType = isDraggingHandleRef.current;
      const newValue = getValueFromPosition(e.clientX);

      if (handleType === "min") {
        const currentMax = draggingMax ?? reduxCustomMax ?? max;
        const newMin = Math.min(newValue, currentMax - step);
        setDraggingMin(newMin);
      } else {
        const currentMin = draggingMin ?? reduxCustomMin ?? min;
        const newMax = Math.max(newValue, currentMin + step);
        setDraggingMax(newMax);
      }
    },
    [
      getValueFromPosition,
      draggingMin,
      draggingMax,
      reduxCustomMax,
      reduxCustomMin,
      min,
      max,
      step,
    ]
  );

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      const target = e.currentTarget as HTMLElement;
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}

      // Get final bounds from dragging
      const finalMin = draggingMin ?? reduxCustomMin ?? min;
      const finalMax = draggingMax ?? reduxCustomMax ?? max;

      // Check if current value is outside new bounds and snap if needed
      let adjustedValue = value;
      let needsSnap = false;

      if (value < finalMin) {
        adjustedValue = finalMin;
        needsSnap = true;
      } else if (value > finalMax) {
        adjustedValue = finalMax;
        needsSnap = true;
      }

      if (needsSnap) {
        onChange(adjustedValue);
      }

      // Resume oscillation with new bounds if it was previously oscillating
      if (pausedOscillationSpeedRef.current !== "none") {
        const range = finalMax - finalMin;
        const center = finalMin + range / 2;
        const amplitude = range / 2;
        const normalizedValue = (adjustedValue - center) / amplitude;
        const clampedNormalized = Math.max(-1, Math.min(1, normalizedValue));

        let targetSin;
        if (Math.abs(clampedNormalized) < 1e-10) {
          targetSin = 0;
        } else {
          targetSin =
            Math.sign(clampedNormalized) *
            Math.pow(Math.abs(clampedNormalized), 1 / MULTIPLIER);
        }
        targetSin = Math.max(-1, Math.min(1, targetSin));

        // choose phase to preserve direction when resuming
        const asinVal = Math.asin(targetSin);
        const candidate0 = asinVal;
        const candidate1 = Math.PI - asinVal;
        const desiredDir = lastDirectionRef.current;
        const cos0 = Math.cos(candidate0);
        if (desiredDir < 0) {
          phaseOffsetRef.current = cos0 < 0 ? candidate0 : candidate1;
        } else if (desiredDir > 0) {
          phaseOffsetRef.current = cos0 >= 0 ? candidate0 : candidate1;
        } else {
          phaseOffsetRef.current = candidate0;
        }
        if (Math.abs(Math.cos(phaseOffsetRef.current)) < 1e-6) {
          const epsilon = 1e-3;
          phaseOffsetRef.current += (desiredDir >= 0 ? 1 : -1) * epsilon;
        }

        // Reset timing to restart smooth oscillation
        startTimeRef.current = null;

        const resumeSpeed = pausedOscillationSpeedRef.current;
        pausedOscillationSpeedRef.current = "none";

        if (sliderId) {
          setOscillator({
            speed: resumeSpeed as OscillationSpeed,
            customMin: finalMin,
            customMax: finalMax,
          });
        }
      }

      // Update Redux with final bounds
      if (sliderId) {
        const currentMin = reduxCustomMin ?? min;
        const currentMax = reduxCustomMax ?? max;

        if (finalMin !== currentMin) {
          updateMin(finalMin);
        }
        if (finalMax !== currentMax) {
          updateMax(finalMax);
        }
      }

      // Clear dragging state refs
      isDraggingHandleRef.current = null;
      activePointerIdRef.current = null;
      setDraggingMin(null);
      setDraggingMax(null);
    },
    [
      draggingMin,
      draggingMax,
      reduxCustomMin,
      reduxCustomMax,
      min,
      max,
      value,
      onChange,
      sliderId,
      setOscillator,
      updateMin,
      updateMax,
    ]
  );

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
      const clampedValue = Math.max(
        oscillationMin,
        Math.min(oscillationMax, oscillatedValue)
      );

      // Round to nearest step
      const steppedValue = Math.round((clampedValue - min) / step) * step + min;
      const finalValue = Math.max(min, Math.min(max, steppedValue));

      // track direction for phase selection on future restarts
      const delta = finalValue - lastValueRef.current;
      if (Math.abs(delta) > 1e-9) {
        lastDirectionRef.current = delta > 0 ? 1 : -1;
      }
      lastValueRef.current = finalValue;
      onChange(finalValue);

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [
      oscillationSpeed,
      oscillationMin,
      oscillationMax,
      min,
      max,
      step,
      onChange,
      speedMultipliers,
    ]
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
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      // reset timing so resume doesn't include paused time
      startTimeRef.current = null;
      return;
    }

    // Only resume animation if oscillation is active
    if (oscillationSpeed !== "none") {
      // Recompute phase to continue from current value and prior direction
      const range = oscillationMax - oscillationMin;
      const center = oscillationMin + range / 2;
      const amplitude = range / 2;
      const normalizedValue =
        amplitude === 0 ? 0 : (value - center) / amplitude;
      const clampedNormalized = Math.max(-1, Math.min(1, normalizedValue));

      let targetSin;
      if (Math.abs(clampedNormalized) < 1e-10) {
        targetSin = 0;
      } else {
        targetSin =
          Math.sign(clampedNormalized) *
          Math.pow(Math.abs(clampedNormalized), 1 / MULTIPLIER);
      }
      targetSin = Math.max(-1, Math.min(1, targetSin));

      const asinVal = Math.asin(targetSin);
      const candidate0 = asinVal;
      const candidate1 = Math.PI - asinVal;
      const desiredDir = lastDirectionRef.current;
      const cos0 = Math.cos(candidate0);
      if (desiredDir < 0) {
        phaseOffsetRef.current = cos0 < 0 ? candidate0 : candidate1;
      } else if (desiredDir > 0) {
        phaseOffsetRef.current = cos0 >= 0 ? candidate0 : candidate1;
      } else {
        phaseOffsetRef.current = candidate0;
      }
      // Nudge away from extrema to avoid zero-derivative stalls on resume
      if (Math.abs(Math.cos(phaseOffsetRef.current)) < 1e-6) {
        const epsilon = 1e-3;
        phaseOffsetRef.current += (desiredDir >= 0 ? 1 : -1) * epsilon;
      }

      // Reset timing and sync last value before scheduling
      startTimeRef.current = null;
      lastValueRef.current = value;

      // Cancel any pending RAF before starting
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying]);

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
          {sliderId &&
            (oscillationSpeed !== "none" ||
              isDraggingHandleRef.current ||
              pausedOscillationSpeedRef.current !== "none") && (
              <>
                <div
                  className="oscillation-handle oscillation-handle-min"
                  style={{ left: `${getSliderPosition(oscillationMin)}%` }}
                  onPointerDown={handleHandlePointerDown("min")}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                  onPointerCancel={handleHandlePointerUp}
                  onLostPointerCapture={handleHandlePointerUp}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  title={`Min: ${formatValue(oscillationMin)}`}
                />
                <div
                  className="oscillation-handle oscillation-handle-max"
                  style={{ left: `${getSliderPosition(oscillationMax)}%` }}
                  onPointerDown={handleHandlePointerDown("max")}
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                  onPointerCancel={handleHandlePointerUp}
                  onLostPointerCapture={handleHandlePointerUp}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  title={`Max: ${formatValue(oscillationMax)}`}
                />
              </>
            )}
        </div>
      </label>
    </Field>
  );
}
