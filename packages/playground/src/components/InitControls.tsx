import { useEffect, useRef } from "react";
import { MultiColorPicker } from "./ui/MultiColorPicker";
import { calculateMassFromSize } from "../utils/particle";
import { Slider } from "./ui/Slider";
import { Dropdown } from "./ui/Dropdown";
import { useEngine } from "../hooks/useEngine";
import { useInit } from "../hooks/useInit";
import { useJoints } from "../hooks/modules/useJoints";
import { useLines } from "../hooks/modules/useLines";
import { InitVelocityConfig as InitVelocityConfigType } from "../slices/init";
import "./InitControls.css";

export function InitControls() {
  const { spawnParticles, isInitialized } = useEngine();
  const { setJoints } = useJoints();
  const { setLines } = useLines();
  const {
    numParticles,
    shape,
    spacing,
    particleSize,
    particleMass,
    radius,
    innerRadius,
    squareSize,
    cornerRadius,
    colors,
    velocityConfig,
    setNumParticles,
    setSpawnShape,
    setSpacing,
    setParticleSize,
    setParticleMass,
    setRadius,
    setInnerRadius,
    setSquareSize,
    setCornerRadius,
    setColors,
    updateVelocityConfig,
    initState,
  } = useInit();

  const firstRenderRef = useRef(false);

  // Color management handler
  const handleColorsChange = (newColors: string[]) => {
    setColors(newColors);
  };

  // Trigger initial particle spawn when engine is initialized
  useEffect(() => {
    if (isInitialized && !firstRenderRef.current) {
      firstRenderRef.current = true;
      spawnParticles(initState);
    }
  }, [isInitialized, spawnParticles, initState]);

  // Auto-spawn particles when any setting changes
  useEffect(() => {
    spawnParticles({
      numParticles,
      shape,
      spacing,
      particleSize,
      radius,
      colors: colors && colors.length > 0 ? colors : undefined, // Use undefined to trigger default palette
      velocityConfig,
      innerRadius,
      squareSize,
      cornerRadius,
      particleMass,
    });
  }, [
    spawnParticles,
    numParticles,
    shape,
    spacing,
    particleSize,
    particleMass,
    radius,
    innerRadius,
    squareSize,
    cornerRadius,
    colors,
    velocityConfig,
  ]);

  // Reset joints and lines when particle configuration changes (but not when engine changes)
  useEffect(() => {
    setJoints([], [], []);
    setLines([], []);
  }, [
    numParticles,
    shape,
    spacing,
    particleSize,
    particleMass,
    radius,
    innerRadius,
    squareSize,
    cornerRadius,
    colors,
    velocityConfig,
  ]);

  const handleSpawnChange = (
    options: {
      newNumParticles?: number;
      newShape?: "grid" | "random" | "circle" | "donut" | "square";
      newSpacing?: number;
      newParticleSize?: number;
      newRadius?: number;
      newInnerRadius?: number;
      newSquareSize?: number;
      newCornerRadius?: number;
      newParticleMass?: number;
    } = {}
  ) => {
    const size = options.newParticleSize ?? particleSize;
    const space = Math.max(options.newSpacing ?? spacing, size * 2);

    if (options.newNumParticles !== undefined)
      setNumParticles(options.newNumParticles);
    if (options.newShape !== undefined) setSpawnShape(options.newShape);
    if (options.newSpacing !== undefined) setSpacing(space);
    if (options.newParticleSize !== undefined) {
      setParticleSize(options.newParticleSize);
      setParticleMass(calculateMassFromSize(options.newParticleSize));
      if (spacing < options.newParticleSize * 2) {
        setSpacing(options.newParticleSize * 2);
      }
    }
    if (options.newParticleMass !== undefined)
      setParticleMass(options.newParticleMass);
    if (options.newRadius !== undefined) setRadius(options.newRadius);
    if (options.newInnerRadius !== undefined)
      setInnerRadius(options.newInnerRadius);
    if (options.newSquareSize !== undefined)
      setSquareSize(options.newSquareSize);
    if (options.newCornerRadius !== undefined)
      setCornerRadius(options.newCornerRadius);

    // The useEffect will automatically trigger particle spawning when Redux state changes
  };

  return (
    <div>
      <Slider
        label="Number of Particles"
        value={numParticles}
        min={100}
        max={100000}
        step={100}
        onChange={(value) => handleSpawnChange({ newNumParticles: value })}
      />

      <Slider
        label="Particle Size"
        value={particleSize}
        min={1}
        max={10}
        step={1}
        onChange={(value) => handleSpawnChange({ newParticleSize: value })}
      />
      <Slider
        label="Particle Mass"
        value={particleMass}
        onChange={(value) => handleSpawnChange({ newParticleMass: value })}
        formatValue={(v) => v.toFixed(2)}
      />
      <Dropdown
        label="Shape"
        value={shape}
        onChange={(value) =>
          handleSpawnChange({
            newShape: value as
              | "grid"
              | "random"
              | "circle"
              | "donut"
              | "square",
          })
        }
        options={[
          { value: "grid", label: "Grid" },
          { value: "circle", label: "Circle" },
          { value: "donut", label: "Donut" },
          { value: "square", label: "Square" },
          { value: "random", label: "Random" },
        ]}
      />
      {shape === "grid" && (
        <Slider
          label="Spacing"
          value={spacing}
          min={particleSize * 2}
          onChange={(value) => handleSpawnChange({ newSpacing: value })}
        />
      )}

      {shape === "donut" && (
        <Slider
          label="Inner Radius"
          value={innerRadius}
          min={10}
          max={1000}
          step={1}
          onChange={(value) =>
            handleSpawnChange({
              newInnerRadius: value,
              newRadius: value > radius ? value : radius,
            })
          }
        />
      )}

      {(shape === "circle" || shape === "donut") && (
        <Slider
          label={shape === "circle" ? "Radius" : "Outer Radius"}
          value={radius}
          min={shape === "circle" ? 10 : innerRadius}
          max={1000}
          step={1}
          onChange={(value) => handleSpawnChange({ newRadius: value })}
        />
      )}

      {shape === "square" && (
        <>
          <Slider
            label="Square Size"
            value={squareSize}
            min={10}
            max={1000}
            step={1}
            onChange={(value) =>
              handleSpawnChange({
                newSquareSize: value,
              })
            }
          />
          <Slider
            min={0}
            max={1000}
            step={1}
            label="Corner Radius"
            value={cornerRadius}
            onChange={(value) =>
              handleSpawnChange({
                newCornerRadius: value,
              })
            }
          />
        </>
      )}
      <MultiColorPicker colors={colors} onColorsChange={handleColorsChange} />
      <Slider
        label="Velocity Speed"
        value={velocityConfig.speed}
        onChange={(value) => {
          updateVelocityConfig({ speed: value });
        }}
        min={0}
        max={500}
        step={1}
      />
      <Dropdown
        label="Velocity Direction"
        value={velocityConfig.direction}
        onChange={(value) => {
          updateVelocityConfig({
            direction: value as InitVelocityConfigType["direction"],
          });
        }}
        options={[
          { value: "random", label: "Random" },
          { value: "in", label: "In (towards center)" },
          { value: "out", label: "Out (from center)" },
          { value: "clockwise", label: "Clockwise" },
          { value: "counter-clockwise", label: "Counter-Clockwise" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {velocityConfig.direction === "custom" && (
        <Slider
          label="Velocity Angle"
          value={velocityConfig.angle}
          min={0}
          max={360}
          step={1}
          onChange={(value) => {
            updateVelocityConfig({ angle: value });
          }}
          formatValue={(v) => `${v}°`}
        />
      )}
    </div>
  );
}
