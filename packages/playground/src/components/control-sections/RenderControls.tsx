import { useState, useEffect } from "react";
import { Canvas2DRenderer, Fluid } from "@party/core";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
} from "@party/core/modules/render";

interface RenderControlsProps {
  renderer: Canvas2DRenderer | null;
  fluid: Fluid | null;
}

export function RenderControls({ renderer, fluid }: RenderControlsProps) {
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);
  const [showDensity, setShowDensity] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);

  useEffect(() => {
    if (renderer) {
      setColorMode(renderer.colorMode);
      setCustomColor(renderer.customColor);
      setShowDensity(renderer.showDensityAtCursor);
      setShowVelocity(renderer.showVelocity);
    }
  }, [renderer, fluid]);

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as "particle" | "custom" | "velocity");
    if (renderer) {
      renderer.setColorMode(mode as "particle" | "custom" | "velocity");
    }
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (renderer) {
      renderer.setCustomColor(color);
    }
  };

  const handleShowDensityChange = (show: boolean) => {
    setShowDensity(show);
    if (renderer) {
      renderer.setShowDensityAtCursor(show);
    }
  };

  const handleShowVelocityChange = (show: boolean) => {
    setShowVelocity(show);
    if (renderer) {
      renderer.setShowVelocity(show);
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
    </div>
  );
}
