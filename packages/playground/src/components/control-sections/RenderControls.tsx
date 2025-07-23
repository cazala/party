import { useState, useEffect } from "react";
import { Canvas2DRenderer, Fluid } from "@party/core";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
  DEFAULT_RENDER_ROTATION_SPEED,
} from "@party/core/modules/render";

interface RenderControlsProps {
  renderer: Canvas2DRenderer | null;
  fluid: Fluid | null;
}

export function RenderControls({ renderer, fluid }: RenderControlsProps) {
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);
  const [rotationSpeed, setRotationSpeed] = useState(
    DEFAULT_RENDER_ROTATION_SPEED
  );
  const [showDensity, setShowDensity] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const [densityFieldColor, setDensityFieldColor] = useState("#FF6B35");

  useEffect(() => {
    if (renderer) {
      setColorMode(renderer.colorMode);
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
}
