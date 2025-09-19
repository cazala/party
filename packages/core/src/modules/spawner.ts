import { Particle, ParticleOptions } from "./particle";
import { Vector } from "./webgpu/vector";

export interface VelocityConfig {
  speed: number;
  direction:
    | "random"
    | "in"
    | "out"
    | "custom"
    | "clockwise"
    | "counter-clockwise";
  /** Used when direction is "custom" (in radians) */
  angle?: number;
  center?: Vector; // Center point for directional calculations
}

// Default color palette - exported for external use
export const DEFAULT_COLOR_PALETTE = [
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

export interface GridSpawnOptions {
  particleOptions?: ParticleOptions;
  rows: number;
  cols: number;
  spacing: Vector;
  center: Vector;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
  safeSpacing?: boolean; // Ensures particles don't touch by using max(spacing, particleSize * 2)
}

export interface RandomSpawnOptions {
  particleOptions?: ParticleOptions;
  bounds: {
    min: Vector;
    max: Vector;
  };
  count: number;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
  camera?: { position: Vector; zoom: number }; // For camera-aware spawning
  canvasSize?: { width: number; height: number }; // For viewport calculations
}

export interface CircleSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector;
  radius: number;
  count: number;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
}

export interface DonutSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector;
  outerRadius: number;
  innerRadius: number;
  count: number;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
}

export interface SquareSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector;
  size: number;
  cornerRadius: number;
  count: number;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
}

export interface PolygonSpawnOptions {
  particleOptions?: ParticleOptions;
  center: Vector;
  sides: number;
  radius: number; // Distance from center to each vertex
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
}

export interface ParticleWithSide extends Particle {
  side?: "top" | "right" | "bottom" | "left" | "corner";
  cornerPosition?: "top-left" | "top-right" | "bottom-right" | "bottom-left";
  sideProgress?: number; // 0-1 progress along the side/corner
}

export function calculateVelocity(
  particlePosition: Vector,
  velocityConfig: VelocityConfig
): Vector {
  if (!velocityConfig || velocityConfig.speed === 0) {
    return new Vector(0, 0);
  }

  const speed = velocityConfig.speed;
  const center = velocityConfig.center || new Vector(0, 0);
  let angle = 0;

  switch (velocityConfig.direction) {
    case "random":
      angle = Math.random() * 2 * Math.PI;
      break;
    case "in":
      // Point towards center
      const dx = center.x - particlePosition.x;
      const dy = center.y - particlePosition.y;
      angle = Math.atan2(dy, dx);
      break;
    case "out":
      // Point away from center
      const dxOut = particlePosition.x - center.x;
      const dyOut = particlePosition.y - center.y;
      angle = Math.atan2(dyOut, dxOut);
      break;
    case "clockwise":
      // Calculate perpendicular vector for clockwise rotation around center
      const dxClock = particlePosition.x - center.x;
      const dyClock = particlePosition.y - center.y;
      // Rotate 90 degrees clockwise: (x, y) -> (y, -x)
      angle = Math.atan2(-dxClock, dyClock);
      break;
    case "counter-clockwise":
      // Calculate perpendicular vector for counter-clockwise rotation around center
      const dxCounter = particlePosition.x - center.x;
      const dyCounter = particlePosition.y - center.y;
      // Rotate 90 degrees counter-clockwise: (x, y) -> (-y, x)
      angle = Math.atan2(dxCounter, -dyCounter);
      break;
    case "custom":
      // Angle is already in radians
      angle = velocityConfig.angle || 0;
      break;
  }

  return new Vector(speed * Math.cos(angle), speed * Math.sin(angle));
}

export function getParticleColor(colors?: string[]): string {
  const palette = colors || DEFAULT_COLOR_PALETTE;
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Calculate positions for particles in a regular polygon (shape) formation
 * @param center - Center point of the polygon
 * @param sides - Number of sides (vertices) in the polygon
 * @param radius - Distance from center to each vertex
 * @returns Array of Vector2D positions
 */
export function calculatePolygonPositions(
  center: Vector,
  sides: number,
  radius: number
): Vector[] {
  const positions: Vector[] = [];
  const angleStep = (2 * Math.PI) / sides;

  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    positions.push(new Vector(x, y));
  }

  return positions;
}

export interface InitParticlesOptions {
  count: number;
  shape: "grid" | "random" | "circle" | "donut" | "square" | "polygon";
  center: Vector;
  particleOptions?: ParticleOptions;
  velocityConfig?: VelocityConfig;
  colors?: string[]; // Array of colors to randomly select from
  // Shape-specific options
  spacing?: number; // For grid spacing (uniform)
  radius?: number; // For circle/donut outer radius, or polygon radius
  innerRadius?: number; // For donut inner radius
  squareSize?: number; // For square size
  cornerRadius?: number; // For square corner radius
  sides?: number; // For polygon number of sides
  // Camera awareness for random spawning
  camera?: { position: Vector; zoom: number };
  canvasSize?: { width: number; height: number };
}

export class Spawner {
  constructor() {}

  /**
   * High-level utility to initialize particles with complex configurations.
   * This consolidates the advanced spawning logic that was previously in the playground.
   */
  initParticles(options: InitParticlesOptions): Particle[] {
    const {
      count,
      shape,
      center,
      particleOptions,
      velocityConfig,
      colors,
      spacing = 50,
      radius = 100,
      innerRadius = 50,
      squareSize = 200,
      cornerRadius = 0,
      sides = 3,
      camera,
      canvasSize,
    } = options;

    switch (shape) {
      case "grid": {
        const particlesPerRow = Math.ceil(Math.sqrt(count));
        const particlesPerCol = Math.ceil(count / particlesPerRow);

        return this.spawnGrid({
          particleOptions,
          rows: particlesPerCol,
          cols: particlesPerRow,
          spacing: new Vector(spacing, spacing),
          center,
          velocityConfig,
          colors,
          safeSpacing: true, // Enable collision prevention by default
        });
      }

      case "circle":
        return this.spawnCircle({
          particleOptions,
          center,
          radius,
          count,
          velocityConfig,
          colors,
        });

      case "donut":
        return this.spawnDonut({
          particleOptions,
          center,
          outerRadius: radius,
          innerRadius,
          count,
          velocityConfig,
          colors,
        });

      case "square":
        return this.spawnSquare({
          particleOptions,
          center,
          size: squareSize,
          cornerRadius,
          count,
          velocityConfig,
          colors,
        });

      case "polygon":
        return this.spawnPolygon({
          particleOptions,
          center,
          sides,
          radius,
          velocityConfig,
          colors,
        });

      case "random": {
        // Default bounds or camera-aware bounds
        let bounds;
        if (camera && canvasSize) {
          const { position: cameraPos, zoom } = camera;
          const { width: canvasWidth, height: canvasHeight } = canvasSize;

          const worldLeft = -cameraPos.x / zoom;
          const worldTop = -cameraPos.y / zoom;
          const worldRight = (canvasWidth - cameraPos.x) / zoom;
          const worldBottom = (canvasHeight - cameraPos.y) / zoom;

          bounds = {
            min: new Vector(worldLeft, worldTop),
            max: new Vector(worldRight, worldBottom),
          };
        } else {
          // Default bounds around center
          const defaultRadius = radius;
          bounds = {
            min: new Vector(center.x - defaultRadius, center.y - defaultRadius),
            max: new Vector(center.x + defaultRadius, center.y + defaultRadius),
          };
        }

        return this.spawnRandom({
          particleOptions,
          bounds,
          count,
          velocityConfig,
          colors,
          camera,
          canvasSize,
        });
      }

      default:
        console.warn(`Unknown particle shape: ${shape}`);
        return [];
    }
  }

  spawnGrid(options: GridSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { rows, cols, spacing, center, velocityConfig, colors, safeSpacing } =
      options;

    // Apply safe spacing if enabled
    let adjustedSpacing = spacing;
    if (safeSpacing && options.particleOptions?.size) {
      const particleSize = options.particleOptions.size;
      adjustedSpacing = new Vector(
        Math.max(spacing.x, particleSize * 2),
        Math.max(spacing.y, particleSize * 2)
      );
    }

    const totalWidth = (cols - 1) * adjustedSpacing.x;
    const totalHeight = (rows - 1) * adjustedSpacing.y;
    const startX = center.x - totalWidth / 2;
    const startY = center.y - totalHeight / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const position = new Vector(
          startX + col * adjustedSpacing.x,
          startY + row * adjustedSpacing.y
        );

        // Calculate velocity if configured
        const velocity = velocityConfig
          ? calculateVelocity(position, {
              ...velocityConfig,
              center: velocityConfig.center || center,
            })
          : new Vector(0, 0);

        // Get color
        const color = getParticleColor(colors);

        const particle = new Particle({
          ...options.particleOptions,
          position,
          velocity,
          color,
        });

        particles.push(particle);
      }
    }

    return particles;
  }

  spawnRandom(options: RandomSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { bounds, count, velocityConfig, colors, camera, canvasSize } =
      options;

    // Calculate effective bounds (camera-aware if camera info provided)
    let effectiveBounds = bounds;
    if (camera && canvasSize) {
      const { position: cameraPos, zoom } = camera;
      const { width: canvasWidth, height: canvasHeight } = canvasSize;

      // Calculate visible world bounds
      const worldLeft = -cameraPos.x / zoom;
      const worldTop = -cameraPos.y / zoom;
      const worldRight = (canvasWidth - cameraPos.x) / zoom;
      const worldBottom = (canvasHeight - cameraPos.y) / zoom;

      effectiveBounds = {
        min: new Vector(worldLeft, worldTop),
        max: new Vector(worldRight, worldBottom),
      };
    }

    const particleSize = options.particleOptions?.size || 10;

    for (let i = 0; i < count; i++) {
      // Keep particles within bounds considering their size
      const x =
        effectiveBounds.min.x +
        particleSize +
        Math.random() *
          (effectiveBounds.max.x - effectiveBounds.min.x - particleSize * 2);
      const y =
        effectiveBounds.min.y +
        particleSize +
        Math.random() *
          (effectiveBounds.max.y - effectiveBounds.min.y - particleSize * 2);

      const position = new Vector(x, y);

      // Calculate velocity if configured
      const centerForVelocity =
        velocityConfig?.center ||
        new Vector(
          (effectiveBounds.min.x + effectiveBounds.max.x) / 2,
          (effectiveBounds.min.y + effectiveBounds.max.y) / 2
        );
      const velocity = velocityConfig
        ? calculateVelocity(position, {
            ...velocityConfig,
            center: centerForVelocity,
          })
        : new Vector(0, 0);

      // Get color
      const color = getParticleColor(colors);

      const particle = new Particle({
        ...options.particleOptions,
        position,
        velocity,
        color,
      });

      particles.push(particle);
    }

    return particles;
  }

  spawnCircle(options: CircleSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, radius, count, velocityConfig, colors } = options;

    if (count === 1) {
      // Special case: single particle at center
      const velocity = velocityConfig
        ? calculateVelocity(center, {
            ...velocityConfig,
            center: velocityConfig.center || center,
          })
        : new Vector(0, 0);
      const color = getParticleColor(colors);

      const particle = new Particle({
        ...options.particleOptions,
        position: new Vector(center.x, center.y),
        velocity,
        color,
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

        const position = new Vector(
          center.x + ringRadius * Math.cos(angle),
          center.y + ringRadius * Math.sin(angle)
        );

        // Calculate velocity if configured
        const velocity = velocityConfig
          ? calculateVelocity(position, {
              ...velocityConfig,
              center: velocityConfig.center || center,
            })
          : new Vector(0, 0);

        // Get color
        const color = getParticleColor(colors);

        const particle = new Particle({
          ...options.particleOptions,
          position,
          velocity,
          color,
        });

        particles.push(particle);
        particlesPlaced++;

        if (particlesPlaced >= count) break;
      }
    }

    return particles;
  }

  spawnDonut(options: DonutSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, outerRadius, innerRadius, count, velocityConfig, colors } =
      options;

    if (count === 0) return particles;

    const particleSize = options.particleOptions?.size || 10;
    const minSpacing = particleSize * 1.5; // Minimum spacing between particles
    const ringThickness = outerRadius - innerRadius;

    if (ringThickness <= 0) {
      console.warn(
        "Invalid donut parameters: outer radius must be greater than inner radius"
      );
      return particles;
    }

    // Calculate number of rings based on available thickness and spacing
    const maxRings = Math.max(1, Math.floor(ringThickness / minSpacing));
    const actualRings = Math.min(
      maxRings,
      Math.ceil(Math.sqrt(count / (2 * Math.PI)))
    );

    let particlesPlaced = 0;

    for (let ring = 0; ring < actualRings && particlesPlaced < count; ring++) {
      // Calculate radius for this ring (distributed evenly between inner and outer)
      const ringRadius =
        innerRadius + (ringThickness * (ring + 0.5)) / actualRings;

      // Calculate circumference and maximum particles for this ring
      const circumference = 2 * Math.PI * ringRadius;
      const maxParticlesInRing = Math.max(
        1,
        Math.floor(circumference / minSpacing)
      );

      // Distribute remaining particles among remaining rings
      const remainingRings = actualRings - ring;
      const remainingParticles = count - particlesPlaced;
      const averagePerRing = Math.ceil(remainingParticles / remainingRings);

      const particlesInRing = Math.min(
        maxParticlesInRing,
        averagePerRing,
        remainingParticles
      );

      for (let p = 0; p < particlesInRing; p++) {
        const angle = (2 * Math.PI * p) / particlesInRing;

        const position = new Vector(
          center.x + ringRadius * Math.cos(angle),
          center.y + ringRadius * Math.sin(angle)
        );

        // Calculate velocity if configured
        const velocity = velocityConfig
          ? calculateVelocity(position, {
              ...velocityConfig,
              center: velocityConfig.center || center,
            })
          : new Vector(0, 0);

        // Get color
        const color = getParticleColor(colors);

        const particle = new Particle({
          ...options.particleOptions,
          position,
          velocity,
          color,
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
    const { center, size, cornerRadius, count, velocityConfig, colors } =
      options;

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

      // Calculate velocity - special handling for square perimeter movement
      let velocity: Vector;
      if (velocityConfig && velocityConfig.speed > 0) {
        if (
          velocityConfig.direction === "clockwise" ||
          velocityConfig.direction === "counter-clockwise"
        ) {
          // Create a temporary particle with side info for velocity calculation
          const tempParticle = {
            side: result.side,
            cornerPosition: result.cornerPosition,
            sideProgress: result.sideProgress,
          } as ParticleWithSide;
          velocity = calculateSquareVelocity(
            tempParticle,
            velocityConfig.direction,
            velocityConfig.speed
          );
        } else {
          // Use regular velocity calculation for other directions
          velocity = calculateVelocity(result.position, {
            ...velocityConfig,
            center: velocityConfig.center || center,
          });
        }
      } else {
        velocity = new Vector(0, 0);
      }

      // Get color
      const color = getParticleColor(colors);

      const particle = new Particle({
        ...options.particleOptions,
        position: result.position,
        velocity,
        color,
      }) as ParticleWithSide;

      // Store side information for future velocity calculations
      particle.side = result.side;
      particle.cornerPosition = result.cornerPosition;
      particle.sideProgress = result.sideProgress;

      particles.push(particle);
    }

    return particles;
  }

  spawnPolygon(options: PolygonSpawnOptions): Particle[] {
    const particles: Particle[] = [];
    const { center, sides, radius, velocityConfig, colors } = options;

    if (sides < 3) {
      console.warn("Polygon must have at least 3 sides");
      return particles;
    }

    // Calculate positions for all vertices
    const positions = calculatePolygonPositions(center, sides, radius);

    // Create particles at each vertex
    for (const position of positions) {
      // Calculate velocity if configured
      const velocity = velocityConfig
        ? calculateVelocity(position, {
            ...velocityConfig,
            center: velocityConfig.center || center,
          })
        : new Vector(0, 0);

      // Get color
      const color = getParticleColor(colors);

      const particle = new Particle({
        ...options.particleOptions,
        position,
        velocity,
        color,
      });

      particles.push(particle);
    }

    return particles;
  }

  private getSquarePositionFromDistance(
    center: Vector,
    size: number,
    cornerRadius: number,
    distance: number,
    straightSideLength: number,
    cornerArcLength: number
  ): {
    position: Vector;
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
    center: Vector,
    halfSize: number,
    cornerRadius: number,
    side: "top" | "right" | "bottom" | "left",
    progress: number
  ): {
    position: Vector;
    side: "top" | "right" | "bottom" | "left";
    sideProgress: number;
  } {
    const straightLength = 2 * halfSize - 2 * cornerRadius;
    const offset = (progress - 0.5) * straightLength;

    let position: Vector;

    switch (side) {
      case "top":
        position = new Vector(center.x + offset, center.y - halfSize);
        break;
      case "right":
        position = new Vector(center.x + halfSize, center.y + offset);
        break;
      case "bottom":
        position = new Vector(center.x - offset, center.y + halfSize);
        break;
      case "left":
        position = new Vector(center.x - halfSize, center.y - offset);
        break;
    }

    return { position, side, sideProgress: progress };
  }

  private getPositionOnCorner(
    center: Vector,
    halfSize: number,
    cornerRadius: number,
    corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
    progress: number
  ): {
    position: Vector;
    side: "corner";
    cornerPosition: "top-left" | "top-right" | "bottom-right" | "bottom-left";
    sideProgress: number;
  } {
    // Calculate corner center positions
    const cornerOffset = halfSize - cornerRadius;
    let cornerCenter: Vector;
    let startAngle: number;

    switch (corner) {
      case "top-right":
        cornerCenter = new Vector(
          center.x + cornerOffset,
          center.y - cornerOffset
        );
        startAngle = 1.5 * Math.PI; // Start from up (end of top edge)
        break;
      case "bottom-right":
        cornerCenter = new Vector(
          center.x + cornerOffset,
          center.y + cornerOffset
        );
        startAngle = 0; // Start from right (end of right edge)
        break;
      case "bottom-left":
        cornerCenter = new Vector(
          center.x - cornerOffset,
          center.y + cornerOffset
        );
        startAngle = 0.5 * Math.PI; // Start from down (end of bottom edge)
        break;
      case "top-left":
        cornerCenter = new Vector(
          center.x - cornerOffset,
          center.y - cornerOffset
        );
        startAngle = Math.PI; // Start from left (end of left edge)
        break;
    }

    // Calculate angle for this progress (quarter circle)
    const angle = startAngle + progress * (Math.PI / 2);

    const position = new Vector(
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
): Vector {
  if (!particle.side) {
    // Fallback to default if no side information
    return new Vector(0, 0);
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

  return new Vector(
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
