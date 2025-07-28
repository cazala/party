import { Particle, Vector2D } from "@party/core";
import { SpawnConfig } from "src/components/control-sections/ParticleSpawnControls";

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

export const calculateMassFromSize = (size: number): number => {
  const radius = size;
  const area = Math.PI * radius * radius;
  return area / 100; // Scale factor keeps default reasonable
};

export const calculateParticleSize = (
  distance: number,
  isDragging: boolean,
  dragThreshold: number,
  zoomScale: number = 1,
  spawnConfig: SpawnConfig
) => {
  const baseSize = spawnConfig.defaultSize;

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

export const calculateParticleMass = (
  distance: number,
  isDragging: boolean,
  dragThreshold: number,
  zoomScale: number = 1,
  spawnConfig: SpawnConfig
) => {
  // Calculate size first using the existing function
  const size = calculateParticleSize(
    distance,
    isDragging,
    dragThreshold,
    zoomScale,
    spawnConfig
  );

  // Convert size to mass using the utility function
  const mass = calculateMassFromSize(size);

  return mass;
};

export const createParticle = (
  x: number,
  y: number,
  size: number,
  color?: string,
  velocity?: { x: number; y: number },
  mass?: number,
  isPinned?: boolean
) => {
  // Use provided mass or calculate from size
  let finalMass = mass;
  if (finalMass === undefined) {
    finalMass = calculateMassFromSize(size);
  }

  return new Particle({
    position: new Vector2D(x, y),
    velocity: new Vector2D(velocity?.x || 0, velocity?.y || 0),
    acceleration: new Vector2D(0, 0),
    mass: finalMass,
    size,
    color: color || getRandomColor(),
    pinned: isPinned || false,
  });
};
