import { useState, useEffect } from "react";
import { calculateMassFromSize } from "../../utils/particle";
import { ColorSelector } from "../ColorSelector";
import { Particle } from "@party/core";

// Default spawn configuration
export const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
export const DEFAULT_SPAWN_PARTICLE_MASS = calculateMassFromSize(
  DEFAULT_SPAWN_PARTICLE_SIZE
);
export const DEFAULT_SPAWN_MODE = "single" as const;
export const DEFAULT_SPAWN_STREAM_RATE = 10; // particles per second
export const DEFAULT_SPAWN_DRAW_STEP_SIZE = 20; // pixels between particles in draw mode
export const DEFAULT_SPAWN_PINNED = false;
export const DEFAULT_SPAWN_SHAPE_SIDES = 3;
export const DEFAULT_SPAWN_SHAPE_LENGTH = 50;

export type SpawnMode = "single" | "stream" | "draw" | "shape";

export interface SpawnConfig {
  defaultSize: number;
  defaultMass: number;
  colors: string[]; // Array of colors to use for spawning
  spawnMode: SpawnMode;
  streamRate: number; // particles per second
  drawStepSize: number; // pixels between particles in draw mode
  pinned: boolean; // Whether to spawn pinned particles
  shapeSides: number; // number of sides for shape mode (3-9)
  shapeLength: number; // distance between particles in shape mode (10-100)
}

interface SpawnControlsProps {
  onSpawnConfigChange?: (config: SpawnConfig) => void;
  initialSize?: number; // For synchronization with Init section
  initialColors?: string[]; // For synchronization with Init section
  currentlyGrabbedParticle: Particle | null;
}

export function SpawnControls({
  onSpawnConfigChange,
  initialSize = DEFAULT_SPAWN_PARTICLE_SIZE,
  initialColors = [],
  currentlyGrabbedParticle,
}: SpawnControlsProps) {
  const [particleSize, setParticleSize] = useState(initialSize);
  const [particleMass, setParticleMass] = useState(
    calculateMassFromSize(initialSize)
  );
  const [colors, setColors] = useState<string[]>(initialColors);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>(DEFAULT_SPAWN_MODE);
  const [streamRate, setStreamRate] = useState(DEFAULT_SPAWN_STREAM_RATE);
  const [drawStepSize, setDrawStepSize] = useState(
    DEFAULT_SPAWN_DRAW_STEP_SIZE
  );
  const [isPinned, setIsPinned] = useState(DEFAULT_SPAWN_PINNED);
  const [shapeSides, setShapeSides] = useState(DEFAULT_SPAWN_SHAPE_SIDES);
  const [shapeLength, setShapeLength] = useState(DEFAULT_SPAWN_SHAPE_LENGTH);

  // Update particle size when initialSize prop changes (from Init section)
  useEffect(() => {
    setParticleSize(initialSize);
    setParticleMass(calculateMassFromSize(initialSize));
  }, [initialSize]);

  // Update colors when initialColors prop changes (from Init section)
  useEffect(() => {
    setColors(initialColors);
  }, [initialColors]);

  // Add keyboard shortcut for toggling Pin checkbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (PC) + A
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        if (currentlyGrabbedParticle) {
          currentlyGrabbedParticle.pinned = !currentlyGrabbedParticle.pinned;
        } else {
          setIsPinned((prev) => !prev);
        }
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        setSpawnMode(
          spawnMode === "single"
            ? "stream"
            : spawnMode === "stream"
            ? "draw"
            : spawnMode === "draw"
            ? "shape"
            : "single"
        );
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [spawnMode, setSpawnMode, currentlyGrabbedParticle]);

  // Notify parent of config changes
  useEffect(() => {
    const config: SpawnConfig = {
      defaultSize: particleSize,
      defaultMass: particleMass,
      colors,
      spawnMode,
      streamRate,
      drawStepSize,
      pinned: isPinned,
      shapeSides,
      shapeLength,
    };
    onSpawnConfigChange?.(config);
  }, [
    particleSize,
    particleMass,
    colors,
    spawnMode,
    streamRate,
    drawStepSize,
    isPinned,
    shapeSides,
    shapeLength,
    onSpawnConfigChange,
  ]);

  const handleSizeChange = (newSize: number) => {
    setParticleSize(newSize);
    // Auto-calculate mass when size changes
    setParticleMass(calculateMassFromSize(newSize));
  };

  const handleMassChange = (newMass: number) => {
    setParticleMass(newMass);
    // Don't auto-update size when mass is manually changed
  };

  const handleColorsChange = (newColors: string[]) => {
    setColors(newColors);
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Particle Size: {particleSize.toFixed(1)}
          <input
            type="range"
            min="1"
            max="50"
            step="0.5"
            value={particleSize}
            onChange={(e) => handleSizeChange(parseFloat(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Particle Mass: {particleMass.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={particleMass}
            onChange={(e) => handleMassChange(parseFloat(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <ColorSelector
        colors={colors}
        onColorsChange={handleColorsChange}
        label="Colors"
      />

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="checkbox"
          />
          Pin
        </label>
      </div>

      <div className="control-group">
        <label>
          Mode
          <select
            value={spawnMode}
            onChange={(e) => setSpawnMode(e.target.value as SpawnMode)}
            className="form-select"
          >
            <option value="single">Single</option>
            <option value="stream">Stream</option>
            <option value="draw">Draw</option>
            <option value="shape">Shape</option>
          </select>
        </label>
      </div>

      {spawnMode === "stream" && (
        <div className="control-group">
          <label>
            Stream Rate: {streamRate} particles/sec
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={streamRate}
              onChange={(e) => setStreamRate(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      )}

      {spawnMode === "draw" && (
        <div className="control-group">
          <label>
            Draw Step Size: {drawStepSize}px
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={drawStepSize}
              onChange={(e) => setDrawStepSize(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>
      )}

      {spawnMode === "shape" && (
        <>
          <div className="control-group">
            <label>
              Sides: {shapeSides}
              <input
                type="range"
                min="3"
                max="6"
                step="1"
                value={shapeSides}
                onChange={(e) => setShapeSides(parseInt(e.target.value))}
                className="slider"
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              Length: {shapeLength}
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={shapeLength}
                onChange={(e) => setShapeLength(parseInt(e.target.value))}
                className="slider"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
