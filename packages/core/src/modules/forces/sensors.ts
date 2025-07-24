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

  setRenderer(renderer: any): void {
    this.renderer = renderer;
  }

  apply(particle: Particle, _spatialGrid: SpatialGrid): void {
    // Only apply sensor logic if sensors are enabled
    if (!this.enableSensors || !this.renderer) {
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

    // Read pixel intensity at each sensor position
    const centerIntensity = this.renderer.readPixelIntensity(
      centerSensorPos.x,
      centerSensorPos.y,
      this.sensorRadius
    );
    const leftIntensity = this.renderer.readPixelIntensity(
      leftSensorPos.x,
      leftSensorPos.y,
      this.sensorRadius
    );
    const rightIntensity = this.renderer.readPixelIntensity(
      rightSensorPos.x,
      rightSensorPos.y,
      this.sensorRadius
    );

    // Determine which sensors are activated (above threshold)
    const centerActivated = centerIntensity > this.sensorThreshold;
    const leftActivated = leftIntensity > this.sensorThreshold;
    const rightActivated = rightIntensity > this.sensorThreshold;

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

    // Apply force in the direction of the winning sensor
    if (winningDirection) {
      particle.velocity = winningDirection
        .normalize()
        .multiply(this.sensorStrength / 5);
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
  sensorStrength: number = DEFAULT_SENSOR_STRENGTH
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
  });
}

export const defaultSensors = createSensorsForce();
