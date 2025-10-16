import { ParticlesColorType } from "@cazala/party";
import { ColorPicker } from "./ui/ColorPicker";
import { Checkbox } from "./ui/Checkbox";
import { Slider } from "./ui/Slider";
import { Dropdown } from "./ui/Dropdown";
import { useEngine } from "../hooks/useEngine";
import { useLines } from "../hooks/modules/useLines";
import { useParticles } from "../hooks/modules/useParticles";
import { useTrails } from "../hooks/modules/useTrails";

interface RenderControlsProps {
  disabled?: boolean;
}

export function RenderControls({ disabled = false }: RenderControlsProps = {}) {
  const { clearColor, setClearColor } = useEngine();
  const {
    enabled: linesEnabled,
    lineWidth,
    setEnabled: setLinesEnabled,
    setLineWidth,
    lineColor,
    setLineColor,
  } = useLines();
  const {
    isEnabled: particlesEnabled,
    colorType,
    customColor,
    hue,
    setEnabled: setParticlesEnabled,
    setColorType,
    setCustomColor,
    setHue,
  } = useParticles();
  const {
    isEnabled: trailsEnabled,
    trailDecay,
    trailDiffuse,
    setEnabled: setTrailsEnabled,
    setDecay,
    setDiffuse,
  } = useTrails();

  // Convert RGBA to hex
  const rgbaToHex = (color: { r: number; g: number; b: number; a: number }) => {
    const toHex = (value: number) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  // Convert hex to RGBA
  const hexToRgba = (hex: string, alpha: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
          a: alpha,
        }
      : { r: 0, g: 0, b: 0, a: 1 };
  };

  const clearColorHex = rgbaToHex(clearColor);
  const particleCustomColorHex = rgbaToHex(customColor);
  const lineColorHex = lineColor
    ? rgbaToHex(lineColor)
    : rgbaToHex({ r: 1, g: 1, b: 1, a: 1 });
  return (
    <div>
      {/* Particle controls first */}
      <Checkbox
        label="Show Particles"
        checked={particlesEnabled}
        onChange={setParticlesEnabled}
        disabled={disabled}
      />

      {particlesEnabled && (
        <Dropdown
          label="Particle Color Type"
          value={String(colorType)}
          onChange={(v) => setColorType(Number(v) as ParticlesColorType)}
          options={[
            { value: String(ParticlesColorType.Default), label: "Default" },
            { value: String(ParticlesColorType.Custom), label: "Custom" },
            { value: String(ParticlesColorType.Hue), label: "Hue" },
          ]}
          disabled={disabled}
        />
      )}

      {particlesEnabled && colorType === ParticlesColorType.Custom && (
        <ColorPicker
          label="Particle Color"
          value={particleCustomColorHex}
          onChange={(hex) => setCustomColor(hexToRgba(hex, 1))}
          disabled={disabled}
        />
      )}

      {particlesEnabled && colorType === ParticlesColorType.Hue && (
        <Slider
          sliderId="render.particleHue"
          label="Particle Hue"
          value={hue * 100}
          min={0}
          max={100}
          step={1}
          onChange={(val) => setHue(val / 100)}
          disabled={disabled}
          formatValue={(v) => v.toFixed(0)}
        />
      )}

      {/* Lines controls after particles */}
      <Checkbox
        label="Show Lines"
        checked={linesEnabled}
        onChange={setLinesEnabled}
        disabled={disabled}
      />

      {linesEnabled && (
        <ColorPicker
          label="Line Color"
          value={lineColorHex}
          onChange={(hex) => {
            const rgba = hexToRgba(hex, 1);
            setLineColor(rgba);
          }}
          disabled={disabled}
        />
      )}

      {linesEnabled && (
        <Slider
          sliderId="render.lineWidth"
          label="Line Width"
          value={lineWidth}
          min={0.1}
          max={10}
          step={0.1}
          onChange={setLineWidth}
          disabled={disabled}
          formatValue={(v) => v.toFixed(1)}
        />
      )}

      {/* Trails controls after lines */}
      <Checkbox
        label="Show Trails"
        checked={trailsEnabled}
        onChange={setTrailsEnabled}
        disabled={disabled}
      />

      {trailsEnabled && (
        <Slider
          sliderId="trails.trailDecay"
          label="Trail Decay"
          value={trailDecay}
          min={2}
          max={20}
          step={1}
          onChange={setDecay}
          disabled={disabled}
        />
      )}

      {trailsEnabled && (
        <Slider
          sliderId="trails.trailDiffuse"
          label="Trail Diffuse"
          value={trailDiffuse}
          min={0}
          max={5}
          step={1}
          onChange={setDiffuse}
          formatValue={(v) => `${v.toFixed(0)}px`}
          disabled={disabled}
        />
      )}

      {/* Clear color stays at bottom */}
      <ColorPicker
        label="Clear Color"
        value={clearColorHex}
        onChange={(hex) => {
          const rgba = hexToRgba(hex, 1);
          setClearColor(rgba);
        }}
        disabled={disabled}
      />
    </div>
  );
}
