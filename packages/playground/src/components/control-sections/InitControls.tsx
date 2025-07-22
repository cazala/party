import { useState, useEffect } from "react";

const DEFAULT_SPAWN_NUM_PARTICLES = 100;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_SPAWN_RADIUS = 100;
const DEFAULT_VELOCITY_SPEED = 0;
const DEFAULT_VELOCITY_DIRECTION = "random";
const DEFAULT_VELOCITY_ANGLE = 0;

interface InitColorConfig {
  colorMode: "random" | "custom";
  customColor: string;
}

interface InitVelocityConfig {
  speed: number;
  direction: "random" | "in" | "out" | "custom";
  angle: number;
}

interface InitControlsProps {
  onInitParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle",
    spacing: number,
    particleSize: number,
    radius?: number,
    colorConfig?: InitColorConfig,
    velocityConfig?: InitVelocityConfig
  ) => void;
  onGetInitConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle";
    spacing: number;
    particleSize: number;
    radius?: number;
    colorConfig?: InitColorConfig;
    velocityConfig?: InitVelocityConfig;
    camera?: { x: number; y: number; zoom: number };
  };
  onParticleSizeChange?: (size: number) => void;
  onColorConfigChange?: (colorConfig: InitColorConfig) => void;
  getCurrentCamera?: () => { x: number; y: number; zoom: number };
}

export function InitControls({
  onInitParticles,
  onGetInitConfig,
  onParticleSizeChange,
  onColorConfigChange,
  getCurrentCamera,
}: InitControlsProps) {
  const [numParticles, setNumParticles] = useState(DEFAULT_SPAWN_NUM_PARTICLES);
  const [spawnShape, setSpawnShape] = useState<"grid" | "random" | "circle">(
    DEFAULT_SPAWN_SHAPE
  );
  const [spacing, setSpacing] = useState(DEFAULT_SPAWN_SPACING);
  const [particleSize, setParticleSize] = useState(DEFAULT_SPAWN_PARTICLE_SIZE);
  const [radius, setRadius] = useState(DEFAULT_SPAWN_RADIUS);
  const [colorConfig, setColorConfig] = useState<InitColorConfig>({
    colorMode: "random",
    customColor: "#F8F8F8",
  });
  const [velocityConfig, setVelocityConfig] = useState<InitVelocityConfig>({
    speed: DEFAULT_VELOCITY_SPEED,
    direction: DEFAULT_VELOCITY_DIRECTION,
    angle: DEFAULT_VELOCITY_ANGLE,
  });

  useEffect(() => {
    if (onInitParticles) {
      onInitParticles(
        numParticles,
        spawnShape,
        spacing,
        particleSize,
        radius,
        colorConfig,
        velocityConfig
      );
    }
  }, [
    onInitParticles,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    radius,
    colorConfig,
    velocityConfig,
  ]);

  useEffect(() => {
    if (onGetInitConfig) {
      const getConfig = () => ({
        numParticles,
        shape: spawnShape,
        spacing,
        particleSize,
        radius,
        colorConfig,
        velocityConfig,
        camera: getCurrentCamera ? getCurrentCamera() : undefined,
      });
      (window as any).__getInitConfig = getConfig;
    }
  }, [
    onGetInitConfig,
    numParticles,
    spawnShape,
    spacing,
    particleSize,
    radius,
    colorConfig,
    velocityConfig,
    getCurrentCamera,
  ]);

  const handleSpawnChange = (
    newNumParticles?: number,
    newShape?: "grid" | "random" | "circle",
    newSpacing?: number,
    newParticleSize?: number,
    newRadius?: number
  ) => {
    const particles = newNumParticles ?? numParticles;
    const shape = newShape ?? spawnShape;
    const size = newParticleSize ?? particleSize;
    const space = Math.max(newSpacing ?? spacing, size * 2);
    const rad = newRadius ?? radius;

    if (newNumParticles !== undefined) setNumParticles(newNumParticles);
    if (newShape !== undefined) setSpawnShape(newShape);
    if (newSpacing !== undefined) setSpacing(space);
    if (newParticleSize !== undefined) setParticleSize(newParticleSize);
    if (newRadius !== undefined) setRadius(newRadius);

    if (onInitParticles) {
      onInitParticles(
        particles,
        shape,
        space,
        size,
        rad,
        colorConfig,
        velocityConfig
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
            max="3500"
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

      <div className="control-group">
        <label>
          Velocity Speed: {velocityConfig.speed}
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={velocityConfig.speed}
            onChange={(e) => {
              const newVelocityConfig = {
                ...velocityConfig,
                speed: parseInt(e.target.value),
              };
              setVelocityConfig(newVelocityConfig);
            }}
            className="slider"
          />
        </label>
      </div>

      <div className="control-group">
        <label>
          Velocity Direction
          <select
            value={velocityConfig.direction}
            onChange={(e) => {
              const newVelocityConfig = {
                ...velocityConfig,
                direction: e.target.value as "random" | "in" | "out" | "custom",
              };
              setVelocityConfig(newVelocityConfig);
            }}
            className="form-select"
          >
            <option value="random">Random</option>
            <option value="in">In (towards center)</option>
            <option value="out">Out (from center)</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      {velocityConfig.direction === "custom" && (
        <div className="control-group">
          <label>
            Angle: {velocityConfig.angle}°
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={velocityConfig.angle}
              onChange={(e) => {
                const newVelocityConfig = {
                  ...velocityConfig,
                  angle: parseInt(e.target.value),
                };
                setVelocityConfig(newVelocityConfig);
              }}
              className="slider"
            />
          </label>
        </div>
      )}
    </div>
  );
}
