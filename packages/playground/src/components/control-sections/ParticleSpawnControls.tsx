import { useState, useEffect } from "react";
import { calculateMassFromSize } from "../../utils/particle";
import { ColorSelector } from "../ColorSelector";

// Default spawn configuration
export const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
export const DEFAULT_SPAWN_PARTICLE_MASS = calculateMassFromSize(
  DEFAULT_SPAWN_PARTICLE_SIZE
);
export const DEFAULT_SPAWN_STREAM_MODE = false;
export const DEFAULT_SPAWN_STREAM_RATE = 10; // particles per second
export const DEFAULT_SPAWN_STATIC = false;

export interface SpawnConfig {
  defaultSize: number;
  defaultMass: number;
  colors: string[]; // Array of colors to use for spawning
  streamMode: boolean;
  streamRate: number; // particles per second
  static: boolean; // Whether to spawn static particles
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
  const [streamMode, setStreamMode] = useState(DEFAULT_SPAWN_STREAM_MODE);
  const [streamRate, setStreamRate] = useState(DEFAULT_SPAWN_STREAM_RATE);
  const [isStatic, setIsStatic] = useState(DEFAULT_SPAWN_STATIC);

  // Update particle size when initialSize prop changes (from Init section)
  useEffect(() => {
    setParticleSize(initialSize);
    setParticleMass(calculateMassFromSize(initialSize));
  }, [initialSize]);

  // Update colors when initialColors prop changes (from Init section)
  useEffect(() => {
    setColors(initialColors);
  }, [initialColors]);

  // Notify parent of config changes
  useEffect(() => {
    const config: SpawnConfig = {
      defaultSize: particleSize,
      defaultMass: particleMass,
      colors,
      streamMode,
      streamRate,
      static: isStatic,
    };
    onSpawnConfigChange?.(config);
  }, [
    particleSize,
    particleMass,
    colors,
    streamMode,
    streamRate,
    isStatic,
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
            checked={streamMode}
            onChange={(e) => setStreamMode(e.target.checked)}
            className="checkbox"
          />
          Stream Mode
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={isStatic}
            onChange={(e) => setIsStatic(e.target.checked)}
            className="checkbox"
          />
          Static Particles
        </label>
      </div>

      {streamMode && (
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
    </div>
  );
}
