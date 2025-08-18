import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Canvas2DRenderer, Fluid } from "@cazala/party";
import {
  DEFAULT_RENDER_COLOR_MODE,
  DEFAULT_RENDER_CUSTOM_COLOR,
  DEFAULT_RENDER_HUE_SPEED,
  DEFAULT_RENDER_GLOW_EFFECTS,
} from "@cazala/party/modules/render";

interface RenderControlsProps {
  renderer: Canvas2DRenderer | null;
  fluid: Fluid | null;
}

export interface RenderControlsRef {
  getState: () => {
    colorMode: "particle" | "custom" | "velocity" | "hue";
    customColor: string;
    hueSpeed: number;
    showDensity: boolean;
    showVelocity: boolean;
    densityFieldColor: string;
    glowEffects: boolean;
  };
  setState: (state: Partial<{
    colorMode: "particle" | "custom" | "velocity" | "hue";
    customColor: string;
    hueSpeed: number;
    showDensity: boolean;
    showVelocity: boolean;
    densityFieldColor: string;
    glowEffects: boolean;
  }>) => void;
}

export const RenderControls = forwardRef<RenderControlsRef, RenderControlsProps>(({ renderer, fluid }, ref) => {
  const [colorMode, setColorMode] = useState(DEFAULT_RENDER_COLOR_MODE);
  const [customColor, setCustomColor] = useState(DEFAULT_RENDER_CUSTOM_COLOR);
  const [hueSpeed, setHueSpeed] = useState(
    DEFAULT_RENDER_HUE_SPEED
  );
  const [showDensity, setShowDensity] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const [densityFieldColor, setDensityFieldColor] = useState("#FF6B35");
  const [glowEffects, setGlowEffects] = useState(DEFAULT_RENDER_GLOW_EFFECTS);

  // Expose state management methods
  useImperativeHandle(ref, () => ({
    getState: () => ({
      colorMode: colorMode as "particle" | "custom" | "velocity" | "hue",
      customColor,
      hueSpeed,
      showDensity,
      showVelocity,
      densityFieldColor,
      glowEffects,
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
      if (state.hueSpeed !== undefined) {
        setHueSpeed(state.hueSpeed);
        if (renderer) {
          renderer.setHueSpeed(state.hueSpeed);
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
      if (state.glowEffects !== undefined) {
        setGlowEffects(state.glowEffects);
        if (renderer) {
          renderer.setGlowEffects(state.glowEffects);
        }
      }
    },
  }), [colorMode, customColor, hueSpeed, showDensity, showVelocity, densityFieldColor, glowEffects, renderer]);

  useEffect(() => {
    if (renderer) {
      setColorMode(renderer.colorMode as "particle" | "custom" | "velocity" | "hue");
      setCustomColor(renderer.customColor);
      setHueSpeed(renderer.getHueSpeed());
      setShowDensity(renderer.showDensity);
      setShowVelocity(renderer.showVelocity);
      setDensityFieldColor(renderer.densityFieldColor);
      setGlowEffects(renderer.getGlowEffects());
    }
  }, [renderer, fluid]);

  const handleColorModeChange = (mode: string) => {
    setColorMode(mode as "particle" | "custom" | "velocity" | "hue");
    if (renderer) {
      renderer.setColorMode(
        mode as "particle" | "custom" | "velocity" | "hue"
      );
    }
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    if (renderer) {
      renderer.setCustomColor(color);
    }
  };

  const handleHueSpeedChange = (speed: number) => {
    setHueSpeed(speed);
    if (renderer) {
      renderer.setHueSpeed(speed);
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

  const handleGlowEffectsChange = (enabled: boolean) => {
    setGlowEffects(enabled);
    if (renderer) {
      renderer.setGlowEffects(enabled);
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
              <option value="hue">Hue</option>
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

      {colorMode === "hue" && (
        <div className="control-group">
          <label>
            Speed: {hueSpeed.toFixed(1)} hue/sec
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={hueSpeed}
              onChange={(e) =>
                handleHueSpeedChange(parseFloat(e.target.value))
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

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={glowEffects}
            onChange={(e) => handleGlowEffectsChange(e.target.checked)}
            className="checkbox"
          />
          Glow Effects
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
