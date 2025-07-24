import { Particle, ParticleOptions } from "./particle";
import { Vector2D } from "./vector";

export interface GridSpawnOptions {
  particleOptions?: ParticleOptions;
  rows: number;
  cols: number;
  spacing: Vector2D;
  center: Vector2D;
}

export interface RandomSpawnOptions {
  particleOptions?: ParticleOptions;
  bounds: {
    min: Vector2D;
    max: Vector2D;
  };
  count: number;
}

export interface CircleSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector2D;
  radius: number;
  count: number;
}

export interface SquareSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector2D;
  size: number;
  cornerRadius: number;
  count: number;
}

export interface ParticleWithSide extends Particle {
  side?: "top" | "right" | "bottom" | "left" | "corner";
  cornerPosition?: "top-left" | "top-right" | "bottom-right" | "bottom-left";
  sideProgress?: number; // 0-1 progress along the side/corner
}

export class Spawner {
  constructor() {}

  spawnGrid(options: GridSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { rows, cols, spacing, center } = options;

    const totalWidth = (cols - 1) * spacing.x;
    const totalHeight = (rows - 1) * spacing.y;
    const startX = center.x - totalWidth / 2;
    const startY = center.y - totalHeight / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = new Vector2D(
          startX + col * spacing.x,
          startY + row * spacing.y
        );

        const particle = new Particle({
          ...options.particleOptions,
          position,
        });

        particles.push(particle);
      }
    }

    return particles;
  }

  spawnRandom(options: RandomSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { bounds, count } = options;

    for (let i = 0; i < count; i++) {
      const position = new Vector2D(
        Math.random() * (bounds.max.x - bounds.min.x) + bounds.min.x,
        Math.random() * (bounds.max.y - bounds.min.y) + bounds.min.y
      );

      const particle = new Particle({
        ...options.particleOptions,
        position,
      });

      particles.push(particle);
    }

    return particles;
  }

  spawnCircle(options: CircleSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, radius, count } = options;

    if (count === 1) {
      // Special case: single particle at center
      const particle = new Particle({
        ...options.particleOptions,
        position: new Vector2D(center.x, center.y),
      });
      particles.push(particle);
      return particles;
    }

    // Calculate optimal number of rings to fill the entire radius
    const particleSize = options.particleOptions?.size || 10;
    const minSpacing = particleSize * 1.5; // Minimum spacing between particles

    // Estimate number of rings needed to distribute particles evenly
    const estimatedRings = Math.max(1, Math.ceil(Math.sqrt(count / Math.PI)));

    let particlesPlaced = 0;

    for (
      let ring = 0;
      ring < estimatedRings && particlesPlaced < count;
      ring++
    ) {
      const ringRadius =
        ring === 0 ? 0 : (radius * (ring + 1)) / estimatedRings;

      // Calculate particles for this ring
      let particlesInRing;
      if (ring === 0) {
        // Center ring gets 1 particle
        particlesInRing = 1;
      } else {
        // Calculate based on circumference and remaining particles
        const circumference = 2 * Math.PI * ringRadius;
        const maxParticlesInRing = Math.max(
          1,
          Math.floor(circumference / minSpacing)
        );

        // Distribute remaining particles among remaining rings
        const remainingRings = estimatedRings - ring;
        const remainingParticles = count - particlesPlaced;
        const averagePerRing = Math.ceil(remainingParticles / remainingRings);

        particlesInRing = Math.min(
          maxParticlesInRing,
          averagePerRing,
          remainingParticles
        );
      }

      for (let p = 0; p < particlesInRing; p++) {
        const angle = (2 * Math.PI * p) / particlesInRing;

        const position = new Vector2D(
          center.x + ringRadius * Math.cos(angle),
          center.y + ringRadius * Math.sin(angle)
        );

        const particle = new Particle({
          ...options.particleOptions,
          position,
        });

        particles.push(particle);
        particlesPlaced++;

        if (particlesPlaced >= count) break;
      }
    }

    return particles;
  }

  spawnSquare(options: SquareSpawnOptions): ParticleWithSide[] {
    const particles: ParticleWithSide[] = [];
    const { center, size, cornerRadius, count } = options;

    if (count === 0) return particles;

    // Clamp cornerRadius to valid range (0 to size/2)
    const clampedCornerRadius = Math.max(0, Math.min(cornerRadius, size / 2));

    // Calculate perimeter segments
    const straightSideLength = size - 2 * clampedCornerRadius;
    const cornerArcLength =
      clampedCornerRadius > 0 ? (Math.PI * clampedCornerRadius) / 2 : 0;
    const totalPerimeter = 4 * straightSideLength + 4 * cornerArcLength;

    if (totalPerimeter === 0) return particles;

    // Distribute particles along perimeter
    const spacing = totalPerimeter / count;

    for (let i = 0; i < count; i++) {
      const distanceAlongPerimeter = (i * spacing) % totalPerimeter;
      const result = this.getSquarePositionFromDistance(
        center,
        size,
        clampedCornerRadius,
        distanceAlongPerimeter,
        straightSideLength,
        cornerArcLength
      );

      const particle = new Particle({
        ...options.particleOptions,
        position: result.position,
      }) as ParticleWithSide;

      // Store side information for velocity calculation
      particle.side = result.side;
      particle.cornerPosition = result.cornerPosition;
      particle.sideProgress = result.sideProgress;

      particles.push(particle);
    }

    return particles;
  }

  private getSquarePositionFromDistance(
    center: Vector2D,
    size: number,
    cornerRadius: number,
    distance: number,
    straightSideLength: number,
    cornerArcLength: number
  ): {
    position: Vector2D;
    side: "top" | "right" | "bottom" | "left" | "corner";
    cornerPosition?: "top-left" | "top-right" | "bottom-right" | "bottom-left";
    sideProgress: number;
  } {
    const halfSize = size / 2;
    let currentDistance = distance;

    // Define segment lengths
    const segments: Array<
      | {
          type: "side";
          length: number;
          side: "top" | "right" | "bottom" | "left";
        }
      | {
          type: "corner";
          length: number;
          corner: "top-left" | "top-right" | "bottom-right" | "bottom-left";
        }
    > = [
      { type: "side", length: straightSideLength, side: "top" },
      { type: "corner", length: cornerArcLength, corner: "top-right" },
      { type: "side", length: straightSideLength, side: "right" },
      { type: "corner", length: cornerArcLength, corner: "bottom-right" },
      { type: "side", length: straightSideLength, side: "bottom" },
      { type: "corner", length: cornerArcLength, corner: "bottom-left" },
      { type: "side", length: straightSideLength, side: "left" },
      { type: "corner", length: cornerArcLength, corner: "top-left" },
    ];

    // Find which segment we're in
    for (const segment of segments) {
      if (currentDistance <= segment.length) {
        const progress =
          segment.length > 0 ? currentDistance / segment.length : 0;

        if (segment.type === "side") {
          return this.getPositionOnSide(
            center,
            halfSize,
            cornerRadius,
            segment.side,
            progress
          );
        } else {
          return this.getPositionOnCorner(
            center,
            halfSize,
            cornerRadius,
            segment.corner,
            progress
          );
        }
      }
      currentDistance -= segment.length;
    }

    // Fallback to start position
    return this.getPositionOnSide(center, halfSize, cornerRadius, "top", 0);
  }

  private getPositionOnSide(
    center: Vector2D,
    halfSize: number,
    cornerRadius: number,
    side: "top" | "right" | "bottom" | "left",
    progress: number
  ): {
    position: Vector2D;
    side: "top" | "right" | "bottom" | "left";
    sideProgress: number;
  } {
    const straightLength = 2 * halfSize - 2 * cornerRadius;
    const offset = (progress - 0.5) * straightLength;

    let position: Vector2D;

    switch (side) {
      case "top":
        position = new Vector2D(center.x + offset, center.y - halfSize);
        break;
      case "right":
        position = new Vector2D(center.x + halfSize, center.y + offset);
        break;
      case "bottom":
        position = new Vector2D(center.x - offset, center.y + halfSize);
        break;
      case "left":
        position = new Vector2D(center.x - halfSize, center.y - offset);
        break;
    }

    return { position, side, sideProgress: progress };
  }

  private getPositionOnCorner(
    center: Vector2D,
    halfSize: number,
    cornerRadius: number,
    corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
    progress: number
  ): {
    position: Vector2D;
    side: "corner";
    cornerPosition: "top-left" | "top-right" | "bottom-right" | "bottom-left";
    sideProgress: number;
  } {
    // Calculate corner center positions
    const cornerOffset = halfSize - cornerRadius;
    let cornerCenter: Vector2D;
    let startAngle: number;

    switch (corner) {
      case "top-right":
        cornerCenter = new Vector2D(
          center.x + cornerOffset,
          center.y - cornerOffset
        );
        startAngle = 1.5 * Math.PI; // Start from up (end of top edge)
        break;
      case "bottom-right":
        cornerCenter = new Vector2D(
          center.x + cornerOffset,
          center.y + cornerOffset
        );
        startAngle = 0; // Start from right (end of right edge)
        break;
      case "bottom-left":
        cornerCenter = new Vector2D(
          center.x - cornerOffset,
          center.y + cornerOffset
        );
        startAngle = 0.5 * Math.PI; // Start from down (end of bottom edge)
        break;
      case "top-left":
        cornerCenter = new Vector2D(
          center.x - cornerOffset,
          center.y - cornerOffset
        );
        startAngle = Math.PI; // Start from left (end of left edge)
        break;
    }

    // Calculate angle for this progress (quarter circle)
    const angle = startAngle + progress * (Math.PI / 2);

    const position = new Vector2D(
      cornerCenter.x + cornerRadius * Math.cos(angle),
      cornerCenter.y + cornerRadius * Math.sin(angle)
    );

    return {
      position,
      side: "corner",
      cornerPosition: corner,
      sideProgress: progress,
    };
  }
}

export function calculateSquareVelocity(
  particle: ParticleWithSide,
  direction: "clockwise" | "counter-clockwise",
  speed: number
): Vector2D {
  if (!particle.side) {
    // Fallback to default if no side information
    return new Vector2D(0, 0);
  }

  let velocityAngle: number;

  if (particle.side === "corner" && particle.cornerPosition) {
    // For corners, calculate tangent direction based on corner arc
    velocityAngle = calculateCornerVelocityAngle(
      particle.cornerPosition,
      particle.sideProgress || 0,
      direction
    );
  } else if (
    particle.side === "top" ||
    particle.side === "right" ||
    particle.side === "bottom" ||
    particle.side === "left"
  ) {
    // For straight sides, use fixed directions
    velocityAngle = calculateSideVelocityAngle(particle.side, direction);
  } else {
    // Fallback
    velocityAngle = 0;
  }

  return new Vector2D(
    Math.cos(velocityAngle) * speed,
    Math.sin(velocityAngle) * speed
  );
}

function calculateSideVelocityAngle(
  side: "top" | "right" | "bottom" | "left",
  direction: "clockwise" | "counter-clockwise"
): number {
  // Define base angles for clockwise movement around square perimeter
  const clockwiseAngles = {
    top: 0, // Right (0°)
    right: Math.PI / 2, // Down (90°)
    bottom: Math.PI, // Left (180°)
    left: (3 * Math.PI) / 2, // Up (270°)
  };

  let angle = clockwiseAngles[side];

  if (direction === "counter-clockwise") {
    // Reverse direction for counter-clockwise
    angle += Math.PI;
  }

  return angle;
}

function calculateCornerVelocityAngle(
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
  progress: number,
  direction: "clockwise" | "counter-clockwise"
): number {
  // Base angles for the start of each corner arc (must match positioning function)
  const cornerStartAngles = {
    "top-right": 1.5 * Math.PI, // Start from up (end of top edge)
    "bottom-right": 0, // Start from right (end of right edge)
    "bottom-left": 0.5 * Math.PI, // Start from down (end of bottom edge)
    "top-left": Math.PI, // Start from left (end of left edge)
  };

  const startAngle = cornerStartAngles[corner];

  // Calculate the current angle on the arc
  const arcAngle = startAngle + progress * (Math.PI / 2);

  // For clockwise motion, tangent is 90° ahead of the radius direction
  // For counter-clockwise motion, tangent is 90° behind the radius direction
  let tangentAngle;
  if (direction === "clockwise") {
    tangentAngle = arcAngle + Math.PI / 2;
  } else {
    tangentAngle = arcAngle - Math.PI / 2;
  }

  return tangentAngle;
}
