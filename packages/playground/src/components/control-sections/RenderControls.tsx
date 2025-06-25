import { useState, useEffect } from "react";
import { Canvas2DRenderer, Flock } from "@party/core";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
} from "@party/core/modules/render";

interface RenderControlsProps {
  renderer: Canvas2DRenderer | null;
  flock: Flock | null;
}

export function RenderControls({ renderer, flock }: RenderControlsProps) {
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);

  useEffect(() => {
    if (renderer) {
      setColorMode(renderer.colorMode);
      setCustomColor(renderer.customColor);
    }
  }, [renderer]);

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as "particle" | "custom" | "velocity");
    if (renderer) {
      renderer.setColorMode(mode as "particle" | "custom" | "velocity");
      if (mode === "velocity" && flock) {
        renderer.setMaxSpeed(flock.maxSpeed);
      }
    }
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (renderer) {
      renderer.setCustomColor(color);
    }
  };

  return (
    <div className="control-section">
      <h4>Render</h4>

      <div className="control-group">
        <label>
          Color Mode
          <select
            value={colorMode}
            onChange={(e) => handleColorModeChange(e.target.value)}
            className="form-select"
          >
            <option value="particle">Use Particle Color</option>
            <option value="custom">Custom Color</option>
            <option value="velocity">Velocity</option>
          </select>
        </label>
      </div>

      {colorMode === "custom" && (
        <div className="control-group">
          <label>
            Custom Color
            <input
              type="color"
              value={customColor}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="color-picker"
            />
          </label>
        </div>
      )}
    </div>
  );
}
