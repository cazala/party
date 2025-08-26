import {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { ColorSelector } from "../ColorSelector";
import { calculateMassFromSize } from "../../utils/particle";

const DEFAULT_SPAWN_NUM_PARTICLES = 3000;
const DEFAULT_SPAWN_SHAPE = "grid";
const DEFAULT_SPAWN_SPACING = 25;
const DEFAULT_SPAWN_PARTICLE_SIZE = 10;
const DEFAULT_SPAWN_RADIUS = 100;
const DEFAULT_INNER_RADIUS = 50;
const DEFAULT_SQUARE_SIZE = 200;
const DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_VELOCITY_SPEED = 0;
const DEFAULT_VELOCITY_DIRECTION = "random";
const DEFAULT_VELOCITY_ANGLE = 0;
const DEFAULT_ENABLE_JOINTS = false;

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
    particleMass?: number,
    enableJoints?: boolean
  ) => void;
  onGetInitConfig?: () => {
    numParticles: number;
    shape: "grid" | "random" | "circle" | "donut" | "square";
    spacing: number;
    particleSize: number;
    radius?: number;
    colors?: string[];
    velocityConfig?: InitVelocityConfig;
    camera?: { x: number; y: number; zoom: number };
    innerRadius?: number;
    squareSize?: number;
    cornerRadius?: number;
    particleMass?: number;
    enableJoints?: boolean;
  };
  onParticleSizeChange?: (size: number) => void;
  onColorsChange?: (colors: string[]) => void;
  onGravityStrengthChange?: (strength: number) => void;
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
    enableJoints: boolean;
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
      enableJoints: boolean;
    }>
  ) => void;
}

export const InitControls = forwardRef<InitControlsRef, InitControlsProps>(
  (
    {
      onInitParticles,
      onGetInitConfig,
      onParticleSizeChange,
      onColorsChange,
      onGravityStrengthChange,
      getCurrentCamera,
    },
    ref
  ) => {
    const [numParticles, setNumParticles] = useState(
      DEFAULT_SPAWN_NUM_PARTICLES
    );
    const [spawnShape, setSpawnShape] = useState<
      "grid" | "random" | "circle" | "donut" | "square"
    >(DEFAULT_SPAWN_SHAPE);
    const [spacing, setSpacing] = useState(DEFAULT_SPAWN_SPACING);
    const [particleSize, setParticleSize] = useState(
      DEFAULT_SPAWN_PARTICLE_SIZE
    );
    const [particleMass, setParticleMass] = useState(
      calculateMassFromSize(DEFAULT_SPAWN_PARTICLE_SIZE)
    );
    const [radius, setRadius] = useState(DEFAULT_SPAWN_RADIUS);
    const [innerRadius, setInnerRadius] = useState(DEFAULT_INNER_RADIUS);
    const [squareSize, setSquareSize] = useState(DEFAULT_SQUARE_SIZE);
    const [cornerRadius, setCornerRadius] = useState(DEFAULT_CORNER_RADIUS);
    const [colors, setColors] = useState<string[]>([]); // Start with empty array, use default palette when empty
    const [velocityConfig, setVelocityConfig] = useState<InitVelocityConfig>({
      speed: DEFAULT_VELOCITY_SPEED,
      direction: DEFAULT_VELOCITY_DIRECTION,
      angle: DEFAULT_VELOCITY_ANGLE,
    });
    const [enableJoints, setEnableJoints] = useState(DEFAULT_ENABLE_JOINTS);
    const [gravityStrength, setGravityStrength] = useState(0);

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
          enableJoints,
        }),
        setState: (state) => {
          skipResetRef.current = true;
          if (state.numParticles !== undefined)
            setNumParticles(state.numParticles);
          if (state.spawnShape !== undefined) setSpawnShape(state.spawnShape);
          if (state.spacing !== undefined) setSpacing(state.spacing);
          if (state.particleSize !== undefined)
            setParticleSize(state.particleSize);
          if (state.particleMass !== undefined)
            setParticleMass(state.particleMass);
          if (state.radius !== undefined) setRadius(state.radius);
          if (state.innerRadius !== undefined)
            setInnerRadius(state.innerRadius);
          if (state.squareSize !== undefined) setSquareSize(state.squareSize);
          if (state.cornerRadius !== undefined)
            setCornerRadius(state.cornerRadius);
          if (state.colors !== undefined) setColors(state.colors);
          if (state.velocityConfig !== undefined)
            setVelocityConfig(state.velocityConfig);
          if (state.enableJoints !== undefined)
            setEnableJoints(state.enableJoints);
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
        enableJoints,
      ]
    );

    // Color management handler
    const handleColorsChange = (newColors: string[]) => {
      setColors(newColors);
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
          particleMass,
          enableJoints
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
      enableJoints,
      skipResetRef,
    ]);

    useEffect(() => {
      if (onGetInitConfig) {
        const getConfig = () => ({
          numParticles,
          shape: spawnShape,
          spacing,
          particleSize,
          particleMass,
          radius,
          colors: colors.length > 0 ? colors : undefined,
          velocityConfig,
          camera: getCurrentCamera ? getCurrentCamera() : undefined,
          innerRadius,
          squareSize,
          cornerRadius,
          enableJoints,
        });
        (window as any).__getInitConfig = getConfig;
      }
    }, [
      onGetInitConfig,
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
      enableJoints,
      getCurrentCamera,
    ]);

    const handleSpawnChange = (
      newNumParticles?: number,
      newShape?: "grid" | "random" | "circle" | "donut" | "square",
      newSpacing?: number,
      newParticleSize?: number,
      newRadius?: number,
      newInnerRadius?: number,
      newSquareSize?: number,
      newCornerRadius?: number,
      newParticleMass?: number,
      newEnableJoints?: boolean
    ) => {
      const particles = newNumParticles ?? numParticles;
      const shape = newShape ?? spawnShape;
      const size = newParticleSize ?? particleSize;
      const mass = newParticleMass ?? particleMass;
      const space = Math.max(newSpacing ?? spacing, size * 2);
      const rad = newRadius ?? radius;
      const innerRad = newInnerRadius ?? innerRadius;
      const sqSize = newSquareSize ?? squareSize;
      const cornRad = newCornerRadius ?? cornerRadius;
      const cloth = newEnableJoints ?? enableJoints;

      if (newNumParticles !== undefined) setNumParticles(newNumParticles);
      if (newShape !== undefined) setSpawnShape(newShape);
      if (newSpacing !== undefined) setSpacing(space);
      if (newParticleSize !== undefined) setParticleSize(newParticleSize);
      if (newParticleMass !== undefined) setParticleMass(newParticleMass);
      if (newRadius !== undefined) setRadius(newRadius);
      if (newInnerRadius !== undefined) setInnerRadius(newInnerRadius);
      if (newSquareSize !== undefined) setSquareSize(newSquareSize);
      if (newCornerRadius !== undefined) setCornerRadius(newCornerRadius);
      if (newEnableJoints !== undefined) setEnableJoints(newEnableJoints);

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
          mass,
          cloth
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
              min="0"
              max="2000000"
              step="100"
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
                const newMass = calculateMassFromSize(newSize);
                handleSpawnChange(
                  undefined,
                  undefined,
                  newSpacing !== spacing ? newSpacing : undefined,
                  newSize,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  newMass
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
            Particle Mass: {particleMass.toFixed(1)}
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={particleMass}
              onChange={(e) => {
                const newMass = parseFloat(e.target.value);
                handleSpawnChange(
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  newMass
                );
              }}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Gravity Strength: {gravityStrength.toFixed(1)}
            <input
              type="range"
              min="0"
              max="500"
              step="1"
              value={gravityStrength}
              onChange={(e) => {
                const newGravity = parseFloat(e.target.value);
                setGravityStrength(newGravity);
                onGravityStrengthChange?.(newGravity);
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
                  e.target.value as
                    | "grid"
                    | "random"
                    | "circle"
                    | "donut"
                    | "square"
                )
              }
              className="form-select"
            >
              <option value="grid">Grid</option>
              <option value="circle">Circle</option>
              <option value="donut">Donut</option>
              <option value="square">Square</option>
              <option value="random">Random</option>
            </select>
          </label>
        </div>

        {spawnShape === "grid" && (
          <>
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
            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={enableJoints}
                  onChange={(e) =>
                    handleSpawnChange(
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      e.target.checked
                    )
                  }
                />
                Joints
              </label>
            </div>
          </>
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

        {spawnShape === "donut" && (
          <>
            <div className="control-group">
              <label>
                Outer Radius: {radius}
                <input
                  type="range"
                  min="30"
                  max="1000"
                  step="10"
                  value={radius}
                  onChange={(e) => {
                    const newOuterRadius = parseInt(e.target.value);
                    // Ensure inner radius is smaller than outer radius
                    const adjustedInnerRadius = Math.min(
                      innerRadius,
                      newOuterRadius - 20
                    );
                    handleSpawnChange(
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      newOuterRadius,
                      adjustedInnerRadius !== innerRadius
                        ? adjustedInnerRadius
                        : undefined
                    );
                  }}
                  className="slider"
                />
              </label>
            </div>
            <div className="control-group">
              <label>
                Inner Radius: {innerRadius}
                <input
                  type="range"
                  min="10"
                  max={Math.max(10, radius - 20)}
                  step="5"
                  value={innerRadius}
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
          </>
        )}

        {spawnShape === "square" && (
          <>
            <div className="control-group">
              <label>
                Size: {squareSize}
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="10"
                  value={squareSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value);
                    // Ensure corner radius doesn't exceed half the size
                    const adjustedCornerRadius = Math.min(
                      cornerRadius,
                      newSize / 2
                    );
                    handleSpawnChange(
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      undefined,
                      newSize,
                      adjustedCornerRadius !== cornerRadius
                        ? adjustedCornerRadius
                        : undefined
                    );
                  }}
                  className="slider"
                />
              </label>
            </div>
            <div className="control-group">
              <label>
                Corner Radius: {cornerRadius}
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, squareSize / 2)}
                  step="5"
                  value={cornerRadius}
                  onChange={(e) =>
                    handleSpawnChange(
                      undefined,
                      undefined,
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
          </>
        )}

        <ColorSelector colors={colors} onColorsChange={handleColorsChange} />

        <div className="control-group">
          <label>
            Velocity Speed: {velocityConfig.speed}
            <input
              type="range"
              min="0"
              max="500"
              step="1"
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
                  direction: e.target.value as
                    | "random"
                    | "in"
                    | "out"
                    | "custom"
                    | "clockwise"
                    | "counter-clockwise",
                };
                setVelocityConfig(newVelocityConfig);
              }}
              className="form-select"
            >
              <option value="random">Random</option>
              <option value="in">In (towards center)</option>
              <option value="out">Out (from center)</option>
              <option value="clockwise">Clockwise</option>
              <option value="counter-clockwise">Counter-Clockwise</option>
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
);
