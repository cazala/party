import { Force } from "../system";
import { Particle } from "../particle";
import { SpatialGrid } from "../spatial-grid";
import { Vector2D } from "../vector";

// Default constants for Trail
export const DEFAULT_TRAIL_ENABLED = false;
export const DEFAULT_TRAIL_DECAY = 0.1;
export const DEFAULT_TRAIL_DIFFUSE = 1;

// Default constants for Sensors
export const DEFAULT_SENSORS_ENABLED = false;
export const DEFAULT_SENSOR_DISTANCE = 30;
export const DEFAULT_SENSOR_ANGLE = Math.PI / 6; // 30 degrees in radians
export const DEFAULT_SENSOR_RADIUS = 3;
export const DEFAULT_SENSOR_THRESHOLD = 0.1;
export const DEFAULT_SENSOR_STRENGTH = 1000;

// Default constants for new behaviors
export const DEFAULT_FOLLOW_BEHAVIOR: SensorBehavior = "any";
export const DEFAULT_FLEE_BEHAVIOR: SensorBehavior = "none";

export type SensorBehavior = "any" | "same" | "different" | "none";

export interface SensorsOptions {
  enableTrail?: boolean;
  trailDecay?: number;
  trailDiffuse?: number;
  enableSensors?: boolean;
  sensorDistance?: number;
  /** Sensor angle in radians */
  sensorAngle?: number;
  sensorRadius?: number;
  sensorThreshold?: number;
  sensorStrength?: number;
  followBehavior?: SensorBehavior;
  fleeBehavior?: SensorBehavior;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Helper function to calculate color similarity (0-1, where 1 is identical)
function calculateColorSimilarity(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const rDiff = Math.abs(color1.r - color2.r);
  const gDiff = Math.abs(color1.g - color2.g);
  const bDiff = Math.abs(color1.b - color2.b);

  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);

  // Convert to similarity (max distance in RGB space is ~441.67)
  const maxDistance = Math.sqrt(255 * 255 * 3);
  return 1 - distance / maxDistance;
}

export class Sensors implements Force {
  // Trail configuration
  public enableTrail: boolean;
  public trailDecay: number;
  public trailDiffuse: number;

  // Sensor configuration
  public enableSensors: boolean;
  public sensorDistance: number;
  /** Sensor angle in radians */
  public sensorAngle: number;
  public sensorRadius: number;
  public sensorThreshold: number;
  public sensorStrength: number;

  // New behavior properties
  public followBehavior: SensorBehavior;
  public fleeBehavior: SensorBehavior;

  // Renderer reference for pixel reading
  private renderer: any = null;

  constructor(options: SensorsOptions = {}) {
    // Trail configuration
    this.enableTrail = options.enableTrail ?? DEFAULT_TRAIL_ENABLED;
    this.trailDecay = options.trailDecay ?? DEFAULT_TRAIL_DECAY;
    this.trailDiffuse = options.trailDiffuse ?? DEFAULT_TRAIL_DIFFUSE;

    // Sensor configuration
    this.enableSensors = options.enableSensors ?? DEFAULT_SENSORS_ENABLED;
    this.sensorDistance = options.sensorDistance ?? DEFAULT_SENSOR_DISTANCE;
    this.sensorAngle = options.sensorAngle ?? DEFAULT_SENSOR_ANGLE;
    this.sensorRadius = options.sensorRadius ?? DEFAULT_SENSOR_RADIUS;
    this.sensorThreshold = options.sensorThreshold ?? DEFAULT_SENSOR_THRESHOLD;
    this.sensorStrength = options.sensorStrength ?? DEFAULT_SENSOR_STRENGTH;

    // New behavior configuration
    this.followBehavior = options.followBehavior ?? DEFAULT_FOLLOW_BEHAVIOR;
    this.fleeBehavior = options.fleeBehavior ?? DEFAULT_FLEE_BEHAVIOR;
  }

  setEnableTrail(enableTrail: boolean): void {
    this.enableTrail = enableTrail;
  }

  setTrailDecay(trailDecay: number): void {
    this.trailDecay = trailDecay;
  }

  setTrailDiffuse(trailDiffuse: number): void {
    this.trailDiffuse = trailDiffuse;
  }

  setEnableSensors(enableSensors: boolean): void {
    this.enableSensors = enableSensors;
  }

  setSensorDistance(sensorDistance: number): void {
    this.sensorDistance = sensorDistance;
  }

  /**
   * Set sensor angle in radians
   * @param sensorAngle Sensor angle in radians
   */
  setSensorAngle(sensorAngle: number): void {
    this.sensorAngle = sensorAngle;
  }

  setSensorRadius(sensorRadius: number): void {
    this.sensorRadius = sensorRadius;
  }

  setSensorThreshold(sensorThreshold: number): void {
    this.sensorThreshold = sensorThreshold;
  }

  setSensorStrength(sensorStrength: number): void {
    this.sensorStrength = sensorStrength;
  }

  setFollowBehavior(followBehavior: SensorBehavior): void {
    this.followBehavior = followBehavior;
  }

  setFleeBehavior(fleeBehavior: SensorBehavior): void {
    this.fleeBehavior = fleeBehavior;
  }

  setRenderer(renderer: any): void {
    this.renderer = renderer;
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    // Only apply sensor logic if sensors are enabled
    if (!this.enableSensors || !this.renderer || particle.pinned) {
      return;
    }

    // Get velocity magnitude
    const velocityMagnitude = particle.velocity.magnitude();

    // Calculate the direction the particle is moving
    const velocityDirection =
      velocityMagnitude < 0.01
        ? Vector2D.random().normalize()
        : particle.velocity.clone().normalize();

    // Calculate positions of the 3 sensors
    // Center sensor: straight ahead
    const centerSensorPos = particle.position
      .clone()
      .add(velocityDirection.clone().multiply(this.sensorDistance));

    // Left sensor: rotated by -sensorAngle (sensorAngle is already in radians)
    const leftDirection = new Vector2D(
      velocityDirection.x * Math.cos(-this.sensorAngle) -
        velocityDirection.y * Math.sin(-this.sensorAngle),
      velocityDirection.x * Math.sin(-this.sensorAngle) +
        velocityDirection.y * Math.cos(-this.sensorAngle)
    );
    const leftSensorPos = particle.position
      .clone()
      .add(leftDirection.multiply(this.sensorDistance));

    // Right sensor: rotated by +sensorAngle (sensorAngle is already in radians)
    const rightDirection = new Vector2D(
      velocityDirection.x * Math.cos(this.sensorAngle) -
        velocityDirection.y * Math.sin(this.sensorAngle),
      velocityDirection.x * Math.sin(this.sensorAngle) +
        velocityDirection.y * Math.cos(this.sensorAngle)
    );
    const rightSensorPos = particle.position
      .clone()
      .add(rightDirection.multiply(this.sensorDistance));

    // Process follow behavior
    let followForce: Vector2D | null = null;
    if (this.followBehavior !== "none") {
      followForce = this.calculateBehaviorForce(
        particle,
        centerSensorPos,
        leftSensorPos,
        rightSensorPos,
        leftDirection,
        rightDirection,
        this.followBehavior,
        false
      );
    }

    // Process flee behavior
    let fleeForce: Vector2D | null = null;
    if (this.fleeBehavior !== "none") {
      fleeForce = this.calculateBehaviorForce(
        particle,
        centerSensorPos,
        leftSensorPos,
        rightSensorPos,
        leftDirection,
        rightDirection,
        this.fleeBehavior,
        true
      );
    }

    // Combine forces if both are present
    let finalForce: Vector2D | null = null;
    if (followForce && fleeForce) {
      finalForce = followForce.add(fleeForce);
    } else if (followForce) {
      finalForce = followForce;
    } else if (fleeForce) {
      finalForce = fleeForce;
    }

    // Apply final force
    if (finalForce) {
      particle.velocity = finalForce
        .normalize()
        .multiply(this.sensorStrength / 5);
    }
  }

  private calculateBehaviorForce(
    particle: Particle,
    centerSensorPos: Vector2D,
    leftSensorPos: Vector2D,
    rightSensorPos: Vector2D,
    leftDirection: Vector2D,
    rightDirection: Vector2D,
    behavior: SensorBehavior,
    isFleeMode: boolean
  ): Vector2D | null {
    // Get sensor readings
    const centerData = this.getSensorData(centerSensorPos.x, centerSensorPos.y);
    const leftData = this.getSensorData(leftSensorPos.x, leftSensorPos.y);
    const rightData = this.getSensorData(rightSensorPos.x, rightSensorPos.y);

    // Determine activation based on behavior type
    const centerActivated = this.isSensorActivated(
      particle,
      centerData,
      behavior
    );
    const leftActivated = this.isSensorActivated(particle, leftData, behavior);
    const rightActivated = this.isSensorActivated(
      particle,
      rightData,
      behavior
    );

    // Find the winning sensor (highest intensity among activated sensors)
    let winningDirection: Vector2D | null = null;

    if (
      (centerActivated && !leftActivated && !rightActivated) ||
      (leftActivated && rightActivated)
    ) {
      winningDirection = null;
    } else if (leftActivated) {
      winningDirection = leftDirection.clone();
    } else if (rightActivated) {
      winningDirection = rightDirection.clone();
    }

    // Apply force in the direction of the winning sensor (or opposite for flee mode)
    if (winningDirection) {
      if (isFleeMode) {
        // For flee mode, reverse the direction
        winningDirection = winningDirection.multiply(-1);
      }
      return winningDirection;
    }

    return null;
  }

  private getSensorData(
    x: number,
    y: number
  ): { intensity: number; color: { r: number; g: number; b: number } } {
    // Read pixel intensity (for 'any' behavior compatibility)
    const intensity = this.renderer.readPixelIntensity(x, y, this.sensorRadius);

    // Read pixel color (for 'same' and 'different' behaviors)
    const color = this.renderer.readPixelColor
      ? this.renderer.readPixelColor(x, y, this.sensorRadius)
      : { r: 255, g: 255, b: 255 }; // fallback to white if method not available

    return { intensity, color };
  }

  private isSensorActivated(
    particle: Particle,
    sensorData: {
      intensity: number;
      color: { r: number; g: number; b: number };
    },
    behavior: SensorBehavior
  ): boolean {
    const { intensity, color } = sensorData;

    // First check if intensity is above threshold
    if (intensity <= this.sensorThreshold) {
      return false;
    }

    switch (behavior) {
      case "any":
        return true; // Already passed intensity threshold

      case "same": {
        const particleColor = hexToRgb(particle.color);
        const similarity = calculateColorSimilarity(particleColor, color);
        // Account for trail fade - lower similarity threshold (0.5 instead of 0.8)
        return similarity > 0.5;
      }

      case "different": {
        const particleColor = hexToRgb(particle.color);
        const similarity = calculateColorSimilarity(particleColor, color);
        // Opposite of 'same' - activate when colors are different
        return similarity <= 0.5;
      }

      case "none":
      default:
        return false;
    }
  }
}

/**
 * Create a Sensors force
 * @param sensorAngle Sensor angle in radians
 */
export function createSensorsForce(
  enableTrail: boolean = DEFAULT_TRAIL_ENABLED,
  trailDecay: number = DEFAULT_TRAIL_DECAY,
  trailDiffuse: number = DEFAULT_TRAIL_DIFFUSE,
  enableSensors: boolean = DEFAULT_SENSORS_ENABLED,
  sensorDistance: number = DEFAULT_SENSOR_DISTANCE,
  sensorAngle: number = DEFAULT_SENSOR_ANGLE,
  sensorRadius: number = DEFAULT_SENSOR_RADIUS,
  sensorThreshold: number = DEFAULT_SENSOR_THRESHOLD,
  sensorStrength: number = DEFAULT_SENSOR_STRENGTH,
  followBehavior: SensorBehavior = DEFAULT_FOLLOW_BEHAVIOR,
  fleeBehavior: SensorBehavior = DEFAULT_FLEE_BEHAVIOR
): Sensors {
  return new Sensors({
    enableTrail,
    trailDecay,
    trailDiffuse,
    enableSensors,
    sensorDistance,
    sensorAngle,
    sensorRadius,
    sensorThreshold,
    sensorStrength,
    followBehavior,
    fleeBehavior,
  });
}

export const defaultSensors = createSensorsForce();
