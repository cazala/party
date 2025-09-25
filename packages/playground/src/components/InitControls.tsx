import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { MultiColorPicker } from "./ui/MultiColorPicker";
import { calculateMassFromSize } from "../utils/particle";
import { Slider } from "./ui/Slider";
import { Dropdown } from "./ui/Dropdown";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import {
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
  setState,
  selectInitState,
  InitVelocityConfig as InitVelocityConfigType,
} from "../modules/init/slice";
import "./InitControls.css";


interface InitVelocityConfig {
  speed: number;
  direction:
    | "random"
    | "in"
    | "out"
    | "custom"
    | "clockwise"
    | "counter-clockwise";
  angle: number;
}

interface InitControlsProps {
  onInitParticles?: (
    numParticles: number,
    shape: "grid" | "random" | "circle" | "donut" | "square",
    spacing: number,
    particleSize: number,
    radius?: number,
    colors?: string[],
    velocityConfig?: InitVelocityConfig,
    innerRadius?: number,
    squareSize?: number,
    cornerRadius?: number,
    particleMass?: number
  ) => void;
  onParticleSizeChange?: (size: number) => void;
  onColorsChange?: (colors: string[]) => void;
  getCurrentCamera?: () => { x: number; y: number; zoom: number };
}

export interface InitControlsRef {
  getState: () => {
    numParticles: number;
    spawnShape: "grid" | "random" | "circle" | "donut" | "square";
    spacing: number;
    particleSize: number;
    particleMass: number;
    radius: number;
    innerRadius: number;
    squareSize: number;
    cornerRadius: number;
    colors: string[];
    velocityConfig: InitVelocityConfig;
  };
  setState: (
    state: Partial<{
      numParticles: number;
      spawnShape: "grid" | "random" | "circle" | "donut" | "square";
      spacing: number;
      particleSize: number;
      particleMass: number;
      radius: number;
      innerRadius: number;
      squareSize: number;
      cornerRadius: number;
      colors: string[];
      velocityConfig: InitVelocityConfig;
    }>
  ) => void;
}

export const InitControls = forwardRef<InitControlsRef, InitControlsProps>(
  ({ onInitParticles, onColorsChange }, ref) => {
    const dispatch = useAppDispatch();
    const initState = useAppSelector(selectInitState);
    const {
      numParticles,
      spawnShape,
      spacing,
      particleSize,
      particleMass,
      radius,
      innerRadius,
      squareSize,
      cornerRadius,
      colors,
      velocityConfig,
    } = initState;

    const skipResetRef = useRef(false);

    // Expose state management methods
    useImperativeHandle(
      ref,
      () => ({
        getState: () => ({
          numParticles,
          spawnShape,
          spacing,
          particleSize,
          particleMass,
          radius,
          innerRadius,
          squareSize,
          cornerRadius,
          colors,
          velocityConfig,
        }),
        setState: (state) => {
          skipResetRef.current = true;
          dispatch(setState(state));
        },
      }),
      [
        skipResetRef,
        numParticles,
        spawnShape,
        spacing,
        particleSize,
        particleMass,
        radius,
        innerRadius,
        squareSize,
        cornerRadius,
        colors,
        velocityConfig,
      ]
    );

    // Color management handler
    const handleColorsChange = (newColors: string[]) => {
      dispatch(setColors(newColors));
      onColorsChange?.(newColors);
    };

    useEffect(() => {
      if (skipResetRef.current) {
        skipResetRef.current = false;
        return;
      }
      if (onInitParticles) {
        onInitParticles(
          numParticles,
          spawnShape,
          spacing,
          particleSize,
          radius,
          colors.length > 0 ? colors : undefined, // Use undefined to trigger default palette
          velocityConfig,
          innerRadius,
          squareSize,
          cornerRadius,
          particleMass
        );
      }
    }, [
      onInitParticles,
      numParticles,
      spawnShape,
      spacing,
      particleSize,
      particleMass,
      radius,
      innerRadius,
      squareSize,
      cornerRadius,
      colors,
      velocityConfig,
      skipResetRef,
    ]);

    const handleSpawnChange = (
      optiosn: {
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
      const particles = optiosn.newNumParticles ?? numParticles;
      const shape = optiosn.newShape ?? spawnShape;
      const size = optiosn.newParticleSize ?? particleSize;
      const mass = optiosn.newParticleSize
        ? calculateMassFromSize(optiosn.newParticleSize)
        : optiosn.newParticleMass ?? particleMass;
      const space = Math.max(optiosn.newSpacing ?? spacing, size * 2);
      const rad = optiosn.newRadius ?? radius;
      const innerRad = optiosn.newInnerRadius ?? innerRadius;
      const sqSize = optiosn.newSquareSize ?? squareSize;
      const cornRad = optiosn.newCornerRadius ?? cornerRadius;

      if (optiosn.newNumParticles !== undefined)
        dispatch(setNumParticles(optiosn.newNumParticles));
      if (optiosn.newShape !== undefined) dispatch(setSpawnShape(optiosn.newShape));
      if (optiosn.newSpacing !== undefined) dispatch(setSpacing(space));
      if (optiosn.newParticleSize !== undefined) {
        dispatch(setParticleSize(optiosn.newParticleSize));
        dispatch(setParticleMass(calculateMassFromSize(optiosn.newParticleSize)));
      }
      if (optiosn.newParticleMass !== undefined)
        dispatch(setParticleMass(optiosn.newParticleMass));
      if (optiosn.newRadius !== undefined) dispatch(setRadius(optiosn.newRadius));
      if (optiosn.newInnerRadius !== undefined)
        dispatch(setInnerRadius(optiosn.newInnerRadius));
      if (optiosn.newSquareSize !== undefined)
        dispatch(setSquareSize(optiosn.newSquareSize));
      if (optiosn.newCornerRadius !== undefined)
        dispatch(setCornerRadius(optiosn.newCornerRadius));

      if (onInitParticles) {
        onInitParticles(
          particles,
          shape,
          space,
          size,
          rad,
          colors,
          velocityConfig,
          innerRad,
          sqSize,
          cornRad,
          mass
        );
      }
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
          value={spawnShape}
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
        {spawnShape === "grid" && (
          <Slider
            label="Spacing"
            value={spacing}
            onChange={(value) => handleSpawnChange({ newSpacing: value })}
          />
        )}

        {spawnShape === "donut" && (
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

        {(spawnShape === "circle" || spawnShape === "donut") && (
          <Slider
            label={spawnShape === "circle" ? "Radius" : "Outer Radius"}
            value={radius}
            min={spawnShape === "circle" ? 10 : innerRadius}
            max={1000}
            step={1}
            onChange={(value) => handleSpawnChange({ newRadius: value })}
          />
        )}

        {spawnShape === "square" && (
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
            dispatch(updateVelocityConfig({ speed: value }));
            handleSpawnChange();
          }}
          min={0}
          max={500}
          step={1}
        />
        <Dropdown
          label="Velocity Direction"
          value={velocityConfig.direction}
          onChange={(value) => {
            dispatch(updateVelocityConfig({ 
              direction: value as InitVelocityConfigType['direction'] 
            }));
            handleSpawnChange();
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
              dispatch(updateVelocityConfig({ angle: value }));
              handleSpawnChange();
            }}
            formatValue={(v) => `${v}°`}
          />
        )}
      </div>
    );
  }
);
