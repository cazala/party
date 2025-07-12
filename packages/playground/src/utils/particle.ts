import { Particle, Vector2D } from "@party/core";

export const getRandomColor = () => {
  const colors = [
    "#F8F8F8", // Bright White
    "#FF3C3C", // Neon Red
    "#00E0FF", // Cyber Cyan
    "#C85CFF", // Electric Purple
    "#AFFF00", // Lime Neon
    "#FF2D95", // Hot Magenta
    "#FF6A00", // Sunset Orange
    "#3B82F6", // Deep Blue Glow
    "#00FFC6", // Turquoise Mint
  ];
  return colors[(Math.random() * colors.length) | 0];
};

export const calculateParticleSize = (
  distance: number,
  isDragging: boolean,
  dragThreshold: number,
  zoomScale: number = 1
) => {
  const spawnConfig = (window as any).__getSpawnConfig?.();
  const baseSize = spawnConfig?.particleSize || 10;

  // If user hasn't entered drag mode yet, use default size for small movements
  if (!isDragging && distance < dragThreshold) {
    return baseSize;
  }

  // Scale max size based on zoom - when zoomed out, allow larger particles
  const maxSize = 50 / zoomScale;

  // Once in drag mode, always calculate size based on distance (no clamping to default)
  const calculatedSize = Math.max(3, Math.min(maxSize, distance / 2));
  return calculatedSize;
};

export const createParticle = (
  x: number,
  y: number,
  size: number,
  color?: string,
  velocity?: { x: number; y: number }
) => {
  // Make mass proportional to area: mass = π * (radius)² / scale_factor
  // radius = size (since size IS the radius), scale_factor keeps default reasonable
  const radius = size;
  const area = Math.PI * radius * radius;
  const mass = area / 100; // Use same scale factor as spawnParticles to ensure consistent collision behavior

  return new Particle({
    position: new Vector2D(x, y),
    velocity: new Vector2D(velocity?.x || 0, velocity?.y || 0),
    acceleration: new Vector2D(0, 0),
    mass,
    size,
    color: color || getRandomColor(),
  });
};
