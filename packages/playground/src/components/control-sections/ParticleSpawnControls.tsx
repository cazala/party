import { useState, useEffect } from "react";

// Default spawn configuration
export const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
export const DEFAULT_SPAWN_PARTICLE_MASS = (Math.PI * DEFAULT_SPAWN_PARTICLE_SIZE * DEFAULT_SPAWN_PARTICLE_SIZE) / 100;
export const DEFAULT_SPAWN_COLOR_MODE = "random";
export const DEFAULT_SPAWN_CUSTOM_COLOR = "#F8F8F8";
export const DEFAULT_SPAWN_STREAM_MODE = false;

export interface SpawnConfig {
  defaultSize: number;
  defaultMass: number;
  colorMode: "random" | "custom";
  customColor: string;
  streamMode: boolean;
}

interface ParticleSpawnControlsProps {
  onSpawnConfigChange?: (config: SpawnConfig) => void;
  initialSize?: number; // For synchronization with Init section
}

const calculateMassFromSize = (size: number): number => {
  const radius = size;
  const area = Math.PI * radius * radius;
  return area / 100; // Same formula used throughout the app
};

export function ParticleSpawnControls({ 
  onSpawnConfigChange,
  initialSize = DEFAULT_SPAWN_PARTICLE_SIZE 
}: ParticleSpawnControlsProps) {
  const [particleSize, setParticleSize] = useState(initialSize);
  const [particleMass, setParticleMass] = useState(calculateMassFromSize(initialSize));
  const [colorMode, setColorMode] = useState<"random" | "custom">(DEFAULT_SPAWN_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_SPAWN_CUSTOM_COLOR);
  const [streamMode, setStreamMode] = useState(DEFAULT_SPAWN_STREAM_MODE);

  // Update particle size when initialSize prop changes (from Init section)
  useEffect(() => {
    setParticleSize(initialSize);
    setParticleMass(calculateMassFromSize(initialSize));
  }, [initialSize]);

  // Notify parent of config changes
  useEffect(() => {
    const config: SpawnConfig = {
      defaultSize: particleSize,
      defaultMass: particleMass,
      colorMode,
      customColor,
      streamMode,
    };
    onSpawnConfigChange?.(config);
  }, [particleSize, particleMass, colorMode, customColor, streamMode, onSpawnConfigChange]);

  const handleSizeChange = (newSize: number) => {
    setParticleSize(newSize);
    // Auto-calculate mass when size changes
    setParticleMass(calculateMassFromSize(newSize));
  };

  const handleMassChange = (newMass: number) => {
    setParticleMass(newMass);
    // Don't auto-update size when mass is manually changed
  };

  const handleColorModeChange = (mode: "random" | "custom") => {
    setColorMode(mode);
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

      <div className="control-group">
        <label>
          Color Mode
          <select
            value={colorMode}
            onChange={(e) => handleColorModeChange(e.target.value as "random" | "custom")}
            className="form-select"
          >
            <option value="random">Random</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      {colorMode === "custom" && (
        <div className="control-group">
          <label>
            Custom Color
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="color-picker"
            />
          </label>
        </div>
      )}

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
    </div>
  );
}