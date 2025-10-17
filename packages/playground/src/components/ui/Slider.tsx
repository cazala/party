import React, { useState, useEffect, useRef, useCallback } from "react";
import { Field } from "./Field";
import { useOscillators } from "../../hooks/useOscillators";
import { OscillationSpeed } from "../../slices/oscillators";
import { useEngine } from "../../hooks/useEngine";
import "./Slider.css";

// Engine owns oscillation; Slider only updates Redux and shows UI affordances

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
  // Legacy refs kept only for drag/hint logic; RAF removed
  const lastValueRef = useRef<number>(value);
  const [displayValue, setDisplayValue] = useState<number>(value);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const isDraggingHandleRef = useRef<"min" | "max" | null>(null);
  const pausedOscillationSpeedRef = useRef<ExtendedOscillationSpeed>("none");
  const activePointerIdRef = useRef<number | null>(null);
  const { engine: engineInstance } = useEngine();

  // Local dragging state for handles (using state to trigger re-renders)
  const [draggingMin, setDraggingMin] = useState<number | null>(null);
  const [draggingMax, setDraggingMax] = useState<number | null>(null);

  // Current oscillation state (from Redux or 'none' if no sliderId)
  const oscillationSpeed: ExtendedOscillationSpeed = sliderId
    ? reduxOscillationSpeed ?? "none"
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

  // Indicator color by speed preset for legacy UI; engine owns motion
  const speedColors = {
    slow: "#4ade80",
    normal: "#fbbf24",
    fast: "#ef4444",
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    // Stop oscillation when user manually changes value
    if (oscillationSpeed !== "none") {
      stopOscillation();
    }
    lastValueRef.current = newValue;
    setDisplayValue(newValue);
    onChange(newValue);
  };

  const stopOscillation = useCallback(() => {
    if (sliderId) {
      removeOscillator();
    }
  }, [sliderId, removeOscillator]);

  const startOscillation = useCallback(
    (speed: OscillationSpeed) => {
      if (!sliderId) return;
      // Update Redux state; engine owns motion
      setOscillator({
        speedHz: speed === "slow" ? 0.01 : speed === "fast" ? 0.2 : 0.05,
        customMin: oscillationMin,
        customMax: oscillationMax,
      });
    },
    [sliderId, oscillationMin, oscillationMax, setOscillator]
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
        const resumeSpeed = pausedOscillationSpeedRef.current;
        pausedOscillationSpeedRef.current = "none";

        if (sliderId) {
          const speedHz =
            resumeSpeed === "slow" ? 0.01 : resumeSpeed === "fast" ? 0.2 : 0.05;
          setOscillator({
            speedHz,
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

  // Sync slider value via engine oscillator listeners
  useEffect(() => {
    if (!isOscillating || !sliderId || !engineInstance) return;
    const parts = sliderId.split(/[:./_\-]/).filter(Boolean);
    if (parts.length < 2) return;
    const [moduleName, inputName] = parts;

    const handler = (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const stepped = Math.round((clamped - min) / step) * step + min;
      if (stepped !== lastValueRef.current) {
        lastValueRef.current = stepped;
        setDisplayValue(stepped);
      }
    };

    try {
      engineInstance.addOscillatorListener(moduleName, inputName, handler);
      return () => {
        engineInstance.removeOscillatorListener(moduleName, inputName, handler);
      };
    } catch {
      return;
    }
  }, [isOscillating, sliderId, engineInstance, min, max, step, onChange]);

  // Sync internal display when Redux value changes (e.g., external actions)
  useEffect(() => {
    if (typeof value === "number" && !Number.isNaN(value)) {
      lastValueRef.current = value;
      setDisplayValue(value);
    }
  }, [value]);

  return (
    <Field className="slider-field">
      <label style={{ position: "relative" }}>
        <div className="slider-label-container">
          <span>
            {label}: {formatValue(displayValue)}
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
        <div className="slider-container" style={{ position: "relative" }}>
          <input
            ref={sliderRef}
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onChange={handleChange}
            onClick={handleSliderClick}
            disabled={disabled}
            className={`slider ${disabled ? "disabled" : ""}`}
          />
          {disabled && sliderId && oscillationSpeed !== "none" && (
            <div
              className="slider-oscillation-overlay"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stopOscillation();
              }}
              title="Click to stop oscillator"
            />
          )}
          {sliderId &&
            (oscillationSpeed !== "none" ||
              isDraggingHandleRef.current ||
              pausedOscillationSpeedRef.current !== "none") && (
              <>
                <div
                  className={`oscillation-handle oscillation-handle-min ${
                    disabled ? "disabled" : ""
                  }`}
                  style={{
                    left: `${getSliderPosition(oscillationMin)}%`,
                    pointerEvents: disabled ? "none" : undefined,
                  }}
                  {...(!disabled
                    ? {
                        onPointerDown: handleHandlePointerDown("min"),
                        onPointerMove: handleHandlePointerMove,
                        onPointerUp: handleHandlePointerUp,
                        onPointerCancel: handleHandlePointerUp,
                        onLostPointerCapture: handleHandlePointerUp,
                      }
                    : {})}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-disabled={disabled}
                  title={`Min: ${formatValue(oscillationMin)}`}
                />
                <div
                  className={`oscillation-handle oscillation-handle-max ${
                    disabled ? "disabled" : ""
                  }`}
                  style={{
                    left: `${getSliderPosition(oscillationMax)}%`,
                    pointerEvents: disabled ? "none" : undefined,
                  }}
                  {...(!disabled
                    ? {
                        onPointerDown: handleHandlePointerDown("max"),
                        onPointerMove: handleHandlePointerMove,
                        onPointerUp: handleHandlePointerUp,
                        onPointerCancel: handleHandlePointerUp,
                        onLostPointerCapture: handleHandlePointerUp,
                      }
                    : {})}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-disabled={disabled}
                  title={`Max: ${formatValue(oscillationMax)}`}
                />
              </>
            )}
        </div>
        {disabled && sliderId && oscillationSpeed !== "none" && (
          <div
            className="slider-oscillation-overlay-all"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              stopOscillation();
            }}
            title="Click to stop oscillator"
          />
        )}
      </label>
    </Field>
  );
}
