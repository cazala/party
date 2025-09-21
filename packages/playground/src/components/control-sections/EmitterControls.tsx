import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { calculateMassFromSize } from "../../utils/particle";
import { ColorSelector } from "../ColorSelector";
import {
  DEFAULT_EMITTER_RATE,
  DEFAULT_EMITTER_DIRECTION,
  DEFAULT_EMITTER_SPEED,
  DEFAULT_EMITTER_AMPLITUDE,
  DEFAULT_EMITTER_PARTICLE_SIZE,
  DEFAULT_EMITTER_FOLLOW_MOUSE,
  DEFAULT_EMITTER_LIFETIME,
  DEFAULT_EMITTER_DURATION,
  DEFAULT_EMITTER_END_SIZE_MULTIPLIER,
  DEFAULT_EMITTER_END_ALPHA,
  DEFAULT_EMITTER_END_COLORS,
  DEFAULT_EMITTER_END_SPEED_MULTIPLIER,
} from "@cazala/party/legacy";

export interface EmitterConfig {
  particleSize: number;
  particleMass: number;
  rate: number; // particles per second
  direction: number; // angle in radians
  speed: number; // scalar velocity
  amplitude: number; // spread angle in radians
  colors: string[]; // Array of colors to use for spawning
  zIndex: number; // rendering depth (0-10)
  followMouse: boolean; // whether emitter follows mouse cursor

  // Lifetime properties
  lifetime: boolean; // whether particles have a limited lifetime
  duration?: number; // particle lifetime in ms
  endSizeMultiplier?: number; // final size multiplier
  endAlpha?: number; // final alpha value
  endColors?: string[]; // array of possible end colors
  endSpeedMultiplier?: number; // final speed multiplier
}

interface EmitterControlsProps {
  onEmitterConfigChange?: (config: EmitterConfig) => void;
  initialSize?: number; // For synchronization with Init section
  initialColors?: string[]; // For synchronization with Init section
}

export interface EmitterControlsRef {
  getState: () => EmitterConfig;
  setState: (state: Partial<EmitterConfig>) => void;
}

export const EmitterControls = forwardRef<
  EmitterControlsRef,
  EmitterControlsProps
>(
  (
    {
      onEmitterConfigChange,
      initialSize = DEFAULT_EMITTER_PARTICLE_SIZE,
      initialColors = [],
    },
    ref
  ) => {
    const [particleSize, setParticleSize] = useState(initialSize);
    const [particleMass, setParticleMass] = useState(
      calculateMassFromSize(initialSize)
    );
    const [rate, setRate] = useState(DEFAULT_EMITTER_RATE);
    const [direction, setDirection] = useState(DEFAULT_EMITTER_DIRECTION);
    const [speed, setSpeed] = useState(DEFAULT_EMITTER_SPEED);
    const [amplitude, setAmplitude] = useState(DEFAULT_EMITTER_AMPLITUDE);
    const [colors, setColors] = useState<string[]>(initialColors);
    const [zIndex, setZIndex] = useState(0);
    const [followMouse, setFollowMouse] = useState(
      DEFAULT_EMITTER_FOLLOW_MOUSE
    );

    // Lifetime state
    const [lifetime, setLifetime] = useState(DEFAULT_EMITTER_LIFETIME);
    const [duration, setDuration] = useState(DEFAULT_EMITTER_DURATION);
    const [endSizeMultiplier, setEndSizeMultiplier] = useState(
      DEFAULT_EMITTER_END_SIZE_MULTIPLIER
    );
    const [endAlpha, setEndAlpha] = useState(DEFAULT_EMITTER_END_ALPHA);
    const [endColors, setEndColors] = useState<string[]>([
      ...DEFAULT_EMITTER_END_COLORS,
    ]);
    const [endSpeedMultiplier, setEndSpeedMultiplier] = useState(
      DEFAULT_EMITTER_END_SPEED_MULTIPLIER
    );

    // Expose state management methods
    useImperativeHandle(
      ref,
      () => ({
        getState: () => ({
          particleSize,
          particleMass,
          rate,
          direction,
          speed,
          amplitude,
          colors,
          zIndex,
          followMouse,
          lifetime,
          duration,
          endSizeMultiplier,
          endAlpha,
          endColors,
          endSpeedMultiplier,
        }),
        setState: (state) => {
          if (state.particleSize !== undefined)
            setParticleSize(state.particleSize);
          if (state.particleMass !== undefined)
            setParticleMass(state.particleMass);
          if (state.rate !== undefined) setRate(state.rate);
          if (state.direction !== undefined) setDirection(state.direction);
          if (state.speed !== undefined) setSpeed(state.speed);
          if (state.amplitude !== undefined) setAmplitude(state.amplitude);
          if (state.colors !== undefined) setColors(state.colors);
          if (state.zIndex !== undefined) setZIndex(state.zIndex);
          if (state.followMouse !== undefined)
            setFollowMouse(state.followMouse);
          if (state.lifetime !== undefined) setLifetime(state.lifetime);
          if (state.duration !== undefined) setDuration(state.duration);
          if (state.endSizeMultiplier !== undefined)
            setEndSizeMultiplier(state.endSizeMultiplier);
          if (state.endAlpha !== undefined) setEndAlpha(state.endAlpha);
          if (state.endColors !== undefined) setEndColors(state.endColors);
          if (state.endSpeedMultiplier !== undefined)
            setEndSpeedMultiplier(state.endSpeedMultiplier);
        },
      }),
      [
        particleSize,
        particleMass,
        rate,
        direction,
        speed,
        amplitude,
        colors,
        zIndex,
        followMouse,
        lifetime,
        duration,
        endSizeMultiplier,
        endAlpha,
        endColors,
        endSpeedMultiplier,
      ]
    );

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
      const config: EmitterConfig = {
        particleSize,
        particleMass,
        rate,
        direction,
        speed,
        amplitude,
        colors,
        zIndex,
        followMouse,
        lifetime,
        duration,
        endSizeMultiplier,
        endAlpha,
        endColors,
        endSpeedMultiplier,
      };
      onEmitterConfigChange?.(config);
    }, [
      particleSize,
      particleMass,
      rate,
      direction,
      speed,
      amplitude,
      colors,
      zIndex,
      followMouse,
      lifetime,
      duration,
      endSizeMultiplier,
      endAlpha,
      endColors,
      endSpeedMultiplier,
      onEmitterConfigChange,
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

    // Convert radians to degrees for display
    const directionDegrees = (direction * 180) / Math.PI;
    const amplitudeDegrees = (amplitude * 180) / Math.PI;

    const handleDirectionChange = (degrees: number) => {
      setDirection((degrees * Math.PI) / 180);
    };

    const handleAmplitudeChange = (degrees: number) => {
      setAmplitude((degrees * Math.PI) / 180);
    };

    return (
      <div className="control-section">
        <div className="control-group">
          <label>
            Particle Size: {particleSize.toFixed(0)}
            <input
              type="range"
              min="3"
              max="50"
              step="1"
              value={particleSize}
              onChange={(e) => handleSizeChange(parseFloat(e.target.value))}
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
            Rate: {rate} particles/sec
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Direction: {directionDegrees.toFixed(0)}°
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={directionDegrees}
              onChange={(e) =>
                handleDirectionChange(parseFloat(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Speed: {speed.toFixed(0)}px/s
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Spread: {amplitudeDegrees.toFixed(0)}°
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={amplitudeDegrees}
              onChange={(e) =>
                handleAmplitudeChange(parseFloat(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Z-Index: {zIndex}
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={zIndex}
              onChange={(e) => setZIndex(parseInt(e.target.value))}
              className="slider"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={followMouse}
              onChange={(e) => setFollowMouse(e.target.checked)}
              className="checkbox"
            />
            Follow Mouse
          </label>
        </div>

        {/* Lifetime Controls */}
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={lifetime}
              onChange={(e) => setLifetime(e.target.checked)}
              className="checkbox"
            />
            Lifetime
          </label>
        </div>

        {lifetime && (
          <>
            <div className="control-group">
              <label>
                Duration: {(duration! / 1000).toFixed(1)}s
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={duration!}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="slider"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Size multiplier: {endSizeMultiplier!.toFixed(1)}x
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={endSizeMultiplier!}
                  onChange={(e) =>
                    setEndSizeMultiplier(parseFloat(e.target.value))
                  }
                  className="slider"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Speed multiplier: {endSpeedMultiplier!.toFixed(1)}x
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={endSpeedMultiplier!}
                  onChange={(e) =>
                    setEndSpeedMultiplier(parseFloat(e.target.value))
                  }
                  className="slider"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Alpha over lifetime: {endAlpha!.toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={endAlpha!}
                  onChange={(e) => setEndAlpha(parseFloat(e.target.value))}
                  className="slider"
                />
              </label>
            </div>

            <ColorSelector
              colors={endColors!}
              onColorsChange={setEndColors}
              label="Color over lifetime"
            />
          </>
        )}
      </div>
    );
  }
);
