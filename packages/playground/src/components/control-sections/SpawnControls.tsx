import { useState, useEffect } from "react";

const DEFAULT_SPAWN_NUM_PARTICLES = 100;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_DRAG_THRESHOLD = 5;

interface SpawnControlsProps {
  onSpawnParticles?: (
    numParticles: number,
    shape: "grid" | "random",
    spacing: number,
    particleSize: number,
    dragThreshold: number
  ) => void;
  onGetSpawnConfig?: () => {
    numParticles: number;
    shape: "grid" | "random";
    spacing: number;
    particleSize: number;
    dragThreshold: number;
  };
}

export function SpawnControls({
  onSpawnParticles,
  onGetSpawnConfig,
}: SpawnControlsProps) {
  const [numParticles, setNumParticles] = useState(DEFAULT_SPAWN_NUM_PARTICLES);
  const [spawnShape, setSpawnShape] = useState<"grid" | "random">(
    DEFAULT_SPAWN_SHAPE
  );
  const [spacing, setSpacing] = useState(DEFAULT_SPAWN_SPACING);
  const [particleSize, setParticleSize] = useState(DEFAULT_SPAWN_PARTICLE_SIZE);
  const [dragThreshold, setDragThreshold] = useState(DEFAULT_DRAG_THRESHOLD);

  useEffect(() => {
    if (onSpawnParticles) {
      onSpawnParticles(
        numParticles,
        spawnShape,
        spacing,
        particleSize,
        dragThreshold
      );
    }
  }, [
    onSpawnParticles,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
  ]);

  useEffect(() => {
    if (onGetSpawnConfig) {
      const getConfig = () => ({
        numParticles,
        shape: spawnShape,
        spacing,
        particleSize,
        dragThreshold,
      });
      (window as any).__getSpawnConfig = getConfig;
    }
  }, [
    onGetSpawnConfig,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    dragThreshold,
  ]);

  const handleSpawnChange = (
    newNumParticles?: number,
    newShape?: "grid" | "random",
    newSpacing?: number,
    newParticleSize?: number,
    newDragThreshold?: number
  ) => {
    const particles = newNumParticles ?? numParticles;
    const shape = newShape ?? spawnShape;
    const size = newParticleSize ?? particleSize;
    const threshold = newDragThreshold ?? dragThreshold;
    const space = Math.max(newSpacing ?? spacing, size * 2);

    if (newNumParticles !== undefined) setNumParticles(newNumParticles);
    if (newShape !== undefined) setSpawnShape(newShape);
    if (newSpacing !== undefined) setSpacing(space);
    if (newParticleSize !== undefined) setParticleSize(newParticleSize);
    if (newDragThreshold !== undefined) setDragThreshold(newDragThreshold);

    if (onSpawnParticles) {
      onSpawnParticles(particles, shape, space, size, threshold);
    }
  };

  return (
    <div className="control-section">
      <h4>Spawn</h4>

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
              handleSpawnChange(undefined, e.target.value as "grid" | "random")
            }
            className="form-select"
          >
            <option value="grid">Grid</option>
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
    </div>
  );
}
