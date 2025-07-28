import { useState, useEffect } from "react";
import { calculateMassFromSize } from "../../utils/particle";
import { ColorSelector } from "../ColorSelector";

// Default spawn configuration
export const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
export const DEFAULT_SPAWN_PARTICLE_MASS = calculateMassFromSize(
  DEFAULT_SPAWN_PARTICLE_SIZE
);
export const DEFAULT_SPAWN_MODE = "single" as const;
export const DEFAULT_SPAWN_STREAM_RATE = 10; // particles per second
export const DEFAULT_SPAWN_DRAW_STEP_SIZE = 20; // pixels between particles in draw mode
export const DEFAULT_SPAWN_PINNED = false;

export type SpawnMode = "single" | "stream" | "draw";

export interface SpawnConfig {
  defaultSize: number;
  defaultMass: number;
  colors: string[]; // Array of colors to use for spawning
  spawnMode: SpawnMode;
  streamRate: number; // particles per second
  drawStepSize: number; // pixels between particles in draw mode
  pinned: boolean; // Whether to spawn pinned particles
}

interface ParticleSpawnControlsProps {
  onSpawnConfigChange?: (config: SpawnConfig) => void;
  initialSize?: number; // For synchronization with Init section
  initialColors?: string[]; // For synchronization with Init section
}

export function ParticleSpawnControls({
  onSpawnConfigChange,
  initialSize = DEFAULT_SPAWN_PARTICLE_SIZE,
  initialColors = [],
}: ParticleSpawnControlsProps) {
  const [particleSize, setParticleSize] = useState(initialSize);
  const [particleMass, setParticleMass] = useState(
    calculateMassFromSize(initialSize)
  );
  const [colors, setColors] = useState<string[]>(initialColors);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>(DEFAULT_SPAWN_MODE);
  const [streamRate, setStreamRate] = useState(DEFAULT_SPAWN_STREAM_RATE);
  const [drawStepSize, setDrawStepSize] = useState(DEFAULT_SPAWN_DRAW_STEP_SIZE);
  const [isPinned, setIsPinned] = useState(DEFAULT_SPAWN_PINNED);

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
        setIsPinned((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
            min="3"
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
        label="Spawn Colors"
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
          Spawn Mode:
          <select
            value={spawnMode}
            onChange={(e) => setSpawnMode(e.target.value as SpawnMode)}
            className="dropdown"
          >
            <option value="single">Single</option>
            <option value="stream">Stream</option>
            <option value="draw">Draw</option>
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
    </div>
  );
}
