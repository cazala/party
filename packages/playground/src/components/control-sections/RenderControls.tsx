import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas2DRenderer, Fluid } from "@cazala/party";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
  DEFAULT_RENDER_ROTATION_SPEED,
} from "@cazala/party/modules/render";

interface RenderControlsProps {
  renderer: Canvas2DRenderer | null;
  fluid: Fluid | null;
}

export interface RenderControlsRef {
  getState: () => {
    colorMode: "particle" | "custom" | "velocity" | "rotate";
    customColor: string;
    rotationSpeed: number;
    showDensity: boolean;
    showVelocity: boolean;
    densityFieldColor: string;
  };
  setState: (state: Partial<{
    colorMode: "particle" | "custom" | "velocity" | "rotate";
    customColor: string;
    rotationSpeed: number;
    showDensity: boolean;
    showVelocity: boolean;
    densityFieldColor: string;
  }>) => void;
}

export const RenderControls = forwardRef<RenderControlsRef, RenderControlsProps>(({ renderer, fluid }, ref) => {
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);
  const [rotationSpeed, setRotationSpeed] = useState(
    DEFAULT_RENDER_ROTATION_SPEED
  );
  const [showDensity, setShowDensity] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const [densityFieldColor, setDensityFieldColor] = useState("#FF6B35");

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getState: () => ({
      colorMode: colorMode as "particle" | "custom" | "velocity" | "rotate",
      customColor,
      rotationSpeed,
      showDensity,
      showVelocity,
      densityFieldColor,
    }),
    setState: (state) => {
      if (state.colorMode !== undefined) {
        setColorMode(state.colorMode);
        if (renderer) {
          renderer.setColorMode(state.colorMode);
        }
      }
      if (state.customColor !== undefined) {
        setCustomColor(state.customColor);
        if (renderer) {
          renderer.setCustomColor(state.customColor);
        }
      }
      if (state.rotationSpeed !== undefined) {
        setRotationSpeed(state.rotationSpeed);
        if (renderer) {
          renderer.setRotationSpeed(state.rotationSpeed);
        }
      }
      if (state.showDensity !== undefined) {
        setShowDensity(state.showDensity);
        if (renderer) {
          renderer.setShowDensity(state.showDensity);
        }
      }
      if (state.showVelocity !== undefined) {
        setShowVelocity(state.showVelocity);
        if (renderer) {
          renderer.setShowVelocity(state.showVelocity);
        }
      }
      if (state.densityFieldColor !== undefined) {
        setDensityFieldColor(state.densityFieldColor);
        if (renderer) {
          renderer.setDensityFieldColor(state.densityFieldColor);
        }
      }
    },
  }), [colorMode, customColor, rotationSpeed, showDensity, showVelocity, densityFieldColor, renderer]);

  useEffect(() => {
    if (renderer) {
      setColorMode(renderer.colorMode as "particle" | "custom" | "velocity" | "rotate");
      setCustomColor(renderer.customColor);
      setRotationSpeed(renderer.getRotationSpeed());
      setShowDensity(renderer.showDensity);
      setShowVelocity(renderer.showVelocity);
      setDensityFieldColor(renderer.densityFieldColor);
    }
  }, [renderer, fluid]);

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as "particle" | "custom" | "velocity" | "rotate");
    if (renderer) {
      renderer.setColorMode(
        mode as "particle" | "custom" | "velocity" | "rotate"
      );
    }
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (renderer) {
      renderer.setCustomColor(color);
    }
  };

  const handleRotationSpeedChange = (speed: number) => {
    setRotationSpeed(speed);
    if (renderer) {
      renderer.setRotationSpeed(speed);
    }
  };

  const handleShowDensityChange = (show: boolean) => {
    setShowDensity(show);
    if (renderer) {
      renderer.setShowDensity(show);
    }
  };

  const handleShowVelocityChange = (show: boolean) => {
    setShowVelocity(show);
    if (renderer) {
      renderer.setShowVelocity(show);
    }
  };

  const handleDensityFieldColorChange = (color: string) => {
    setDensityFieldColor(color);
    if (renderer) {
      renderer.setDensityFieldColor(color);
    }
  };

  return (
    <div className="control-section">
      <div className="control-group">
        <label>
          Color
          <div className="color-control-inline">
            <select
              value={colorMode}
              onChange={(e) => handleColorModeChange(e.target.value)}
              className="form-select"
            >
              <option value="particle">Particle</option>
              <option value="custom">Custom</option>
              <option value="velocity">Velocity</option>
              <option value="rotate">Rotate</option>
            </select>
            {colorMode === "custom" && (
              <input
                type="color"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="color-picker-inline"
              />
            )}
          </div>
        </label>
      </div>

      {colorMode === "rotate" && (
        <div className="control-group">
          <label>
            Speed: {rotationSpeed.toFixed(1)} rot/sec
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={rotationSpeed}
              onChange={(e) =>
                handleRotationSpeedChange(parseFloat(e.target.value))
              }
              className="slider"
            />
          </label>
        </div>
      )}

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={showVelocity}
            onChange={(e) => handleShowVelocityChange(e.target.checked)}
            className="checkbox"
          />
          Show Velocity
        </label>
      </div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={showDensity}
            onChange={(e) => handleShowDensityChange(e.target.checked)}
            className="checkbox"
          />
          Show Density
        </label>
      </div>

      {showDensity && (
        <div className="control-group">
          <label>
            Density Field Color
            <input
              type="color"
              value={densityFieldColor}
              onChange={(e) => handleDensityFieldColorChange(e.target.value)}
              className="color-picker"
            />
          </label>
        </div>
      )}
    </div>
  );
});
