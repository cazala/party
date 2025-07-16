import { useState, useEffect } from "react";

const DEFAULT_SPAWN_NUM_PARTICLES = 100;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_DRAG_THRESHOLD = 5;
const DEFAULT_SPAWN_RADIUS = 100;

interface InitColorConfig {
  colorMode: "random" | "custom";
  customColor: string;
}

interface SpawnControlsProps {
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle",
    spacing: number,
    particleSize: number,
    dragThreshold: number,
    radius?: number,
    colorConfig?: InitColorConfig
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
    radius?: number;
    colorConfig?: InitColorConfig;
  };
  onParticleSizeChange?: (size: number) => void;
  onColorConfigChange?: (colorConfig: InitColorConfig) => void;
}

export function SpawnControls({
  onSpawnParticles,
  onGetSpawnConfig,
  onParticleSizeChange,
  onColorConfigChange,
}: SpawnControlsProps) {
  const [numParticles, setNumParticles] = useState(DEFAULT_SPAWN_NUM_PARTICLES);
  const [spawnShape, setSpawnShape] = useState<"grid" | "random" | "circle">(
    DEFAULT_SPAWN_SHAPE
  );
  const [spacing, setSpacing] = useState(DEFAULT_SPAWN_SPACING);
  const [particleSize, setParticleSize] = useState(DEFAULT_SPAWN_PARTICLE_SIZE);
  const [dragThreshold, setDragThreshold] = useState(DEFAULT_DRAG_THRESHOLD);
  const [radius, setRadius] = useState(DEFAULT_SPAWN_RADIUS);
  const [colorConfig, setColorConfig] = useState<InitColorConfig>({
    colorMode: "random",
    customColor: "#F8F8F8",
  });

  useEffect(() => {
    if (onSpawnParticles) {
      onSpawnParticles(
        numParticles,
        spawnShape,
        spacing,
        particleSize,
        dragThreshold,
        radius,
        colorConfig
      );
    }
  }, [
    onSpawnParticles,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
    radius,
    colorConfig,
  ]);

  useEffect(() => {
    if (onGetSpawnConfig) {
      const getConfig = () => ({
        numParticles,
        shape: spawnShape,
        spacing,
        particleSize,
        dragThreshold,
        radius,
        colorConfig,
      });
      (window as any).__getInitConfig = getConfig;
    }
  }, [
    onGetSpawnConfig,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
    radius,
    colorConfig,
  ]);

  const handleSpawnChange = (
    newNumParticles?: number,
    newShape?: "grid" | "random" | "circle",
    newSpacing?: number,
    newParticleSize?: number,
    newDragThreshold?: number,
    newRadius?: number
  ) => {
    const particles = newNumParticles ?? numParticles;
    const shape = newShape ?? spawnShape;
    const size = newParticleSize ?? particleSize;
    const threshold = newDragThreshold ?? dragThreshold;
    const space = Math.max(newSpacing ?? spacing, size * 2);
    const rad = newRadius ?? radius;

    if (newNumParticles !== undefined) setNumParticles(newNumParticles);
    if (newShape !== undefined) setSpawnShape(newShape);
    if (newSpacing !== undefined) setSpacing(space);
    if (newParticleSize !== undefined) setParticleSize(newParticleSize);
    if (newDragThreshold !== undefined) setDragThreshold(newDragThreshold);
    if (newRadius !== undefined) setRadius(newRadius);

    if (onSpawnParticles) {
      onSpawnParticles(
        particles,
        shape,
        space,
        size,
        threshold,
        rad,
        colorConfig
      );
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Number of Particles: {numParticles}
          <input
            type="range"
            min="1"
            max="1500"
            step="1"
            value={numParticles}
            onChange={(e) => handleSpawnChange(parseInt(e.target.value))}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Particle Size: {particleSize}
          <input
            type="range"
            min="3"
            max="30"
            step="1"
            value={particleSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              const newSpacing = Math.max(spacing, newSize * 2);
              handleSpawnChange(
                undefined,
                undefined,
                newSpacing !== spacing ? newSpacing : undefined,
                newSize
              );
              // Notify parent component about particle size change
              onParticleSizeChange?.(newSize);
            }}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Shape
          <select
            value={spawnShape}
            onChange={(e) =>
              handleSpawnChange(
                undefined,
                e.target.value as "grid" | "random" | "circle"
              )
            }
            className="form-select"
          >
            <option value="grid">Grid</option>
            <option value="circle">Circle</option>
            <option value="random">Random</option>
          </select>
        </label>
      </div>

      {spawnShape === "grid" && (
        <div className="control-group">
          <label>
            Spacing: {spacing}
            <input
              type="range"
              min={particleSize * 2 + 2}
              max="150"
              step="5"
              value={spacing}
              onChange={(e) =>
                handleSpawnChange(
                  undefined,
                  undefined,
                  parseInt(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>
      )}

      {spawnShape === "circle" && (
        <div className="control-group">
          <label>
            Radius: {radius}
            <input
              type="range"
              min="20"
              max="1000"
              step="10"
              value={radius}
              onChange={(e) =>
                handleSpawnChange(
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  parseInt(e.target.value)
                )
              }
              className="slider"
            />
          </label>
        </div>
      )}

      <div className="control-group">
        <label>
          Color
          <div className="color-control-inline">
            <select
              value={colorConfig.colorMode}
              onChange={(e) => {
                const newColorConfig = {
                  ...colorConfig,
                  colorMode: e.target.value as "random" | "custom",
                };
                setColorConfig(newColorConfig);
                onColorConfigChange?.(newColorConfig);
              }}
              className="form-select"
            >
              <option value="random">Random</option>
              <option value="custom">Custom</option>
            </select>
            {colorConfig.colorMode === "custom" && (
              <input
                type="color"
                value={colorConfig.customColor}
                onChange={(e) => {
                  const newColorConfig = {
                    ...colorConfig,
                    customColor: e.target.value,
                  };
                  setColorConfig(newColorConfig);
                  onColorConfigChange?.(newColorConfig);
                }}
                className="color-picker-inline"
              />
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
