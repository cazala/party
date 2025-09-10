import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

export type SensorBehavior = "any" | "same" | "different" | "none";

type SensorBindingKeys =
  | "enableTrail"
  | "trailDecay"
  | "trailDiffuse"
  | "enableSensors"
  | "sensorDistance"
  | "sensorAngle"
  | "sensorRadius"
  | "sensorThreshold"
  | "sensorStrength"
  | "colorSimilarityThreshold"
  | "followBehavior"
  | "fleeBehavior"
  | "fleeAngle"
  | "particleColorR"
  | "particleColorG"
  | "particleColorB";

export class Sensors extends ComputeModule<"sensors", SensorBindingKeys> {
  // Trail configuration
  private enableTrail: boolean;
  private trailDecay: number;
  private trailDiffuse: number;

  // Sensor configuration
  private enableSensors: boolean;
  private sensorDistance: number;
  private sensorAngle: number;
  private sensorRadius: number;
  private sensorThreshold: number;
  private sensorStrength: number;
  private colorSimilarityThreshold: number;

  // Behavior configuration
  private followBehavior: SensorBehavior;
  private fleeBehavior: SensorBehavior;
  private fleeAngle: number;

  // Particle color (RGB components 0-1)
  private particleColorR: number;
  private particleColorG: number;
  private particleColorB: number;

  constructor(opts?: {
    enableTrail?: boolean;
    trailDecay?: number;
    trailDiffuse?: number;
    enableSensors?: boolean;
    sensorDistance?: number;
    sensorAngle?: number;
    sensorRadius?: number;
    sensorThreshold?: number;
    sensorStrength?: number;
    colorSimilarityThreshold?: number;
    followBehavior?: SensorBehavior;
    fleeBehavior?: SensorBehavior;
    fleeAngle?: number;
    particleColor?: string; // hex color like "#ff0000"
  }) {
    super();

    // Trail configuration (defaults from original)
    this.enableTrail = opts?.enableTrail ?? false;
    this.trailDecay = opts?.trailDecay ?? 0.1;
    this.trailDiffuse = opts?.trailDiffuse ?? 1;

    // Sensor configuration (defaults from original)
    this.enableSensors = opts?.enableSensors ?? false;
    this.sensorDistance = opts?.sensorDistance ?? 30;
    this.sensorAngle = opts?.sensorAngle ?? Math.PI / 6; // 30 degrees
    this.sensorRadius = opts?.sensorRadius ?? 3;
    this.sensorThreshold = opts?.sensorThreshold ?? 0.1;
    this.sensorStrength = opts?.sensorStrength ?? 1000;
    this.colorSimilarityThreshold = opts?.colorSimilarityThreshold ?? 0.4;

    // Behavior configuration (defaults from original)
    this.followBehavior = opts?.followBehavior ?? "any";
    this.fleeBehavior = opts?.fleeBehavior ?? "none";
    this.fleeAngle = opts?.fleeAngle ?? Math.PI / 2; // 90 degrees

    // Parse particle color from hex to RGB (0-1 range)
    const color = this.hexToRgb(opts?.particleColor ?? "#ffffff");
    this.particleColorR = color.r / 255.0;
    this.particleColorG = color.g / 255.0;
    this.particleColorB = color.b / 255.0;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 255, b: 255 }; // default to white
  }

  private behaviorToUniform(behavior: SensorBehavior): number {
    switch (behavior) {
      case "any":
        return 0;
      case "same":
        return 1;
      case "different":
        return 2;
      case "none":
        return 3;
      default:
        return 3;
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      enableTrail: this.enableTrail ? 1 : 0,
      trailDecay: this.trailDecay,
      trailDiffuse: this.trailDiffuse,
      enableSensors: this.enableSensors ? 1 : 0,
      sensorDistance: this.sensorDistance,
      sensorAngle: this.sensorAngle,
      sensorRadius: this.sensorRadius,
      sensorThreshold: this.sensorThreshold,
      sensorStrength: this.sensorStrength,
      colorSimilarityThreshold: this.colorSimilarityThreshold,
      followBehavior: this.behaviorToUniform(this.followBehavior),
      fleeBehavior: this.behaviorToUniform(this.fleeBehavior),
      fleeAngle: this.fleeAngle,
      particleColorR: this.particleColorR,
      particleColorG: this.particleColorG,
      particleColorB: this.particleColorB,
    });
  }

  // Setters for trail configuration
  setEnableTrail(value: boolean): void {
    this.enableTrail = value;
    this.write({ enableTrail: value ? 1 : 0 });
  }

  setTrailDecay(value: number): void {
    this.trailDecay = value;
    this.write({ trailDecay: value });
  }

  setTrailDiffuse(value: number): void {
    this.trailDiffuse = value;
    this.write({ trailDiffuse: value });
  }

  // Setters for sensor configuration
  setEnableSensors(value: boolean): void {
    this.enableSensors = value;
    this.write({ enableSensors: value ? 1 : 0 });
  }

  setSensorDistance(value: number): void {
    this.sensorDistance = value;
    this.write({ sensorDistance: value });
  }

  setSensorAngle(value: number): void {
    this.sensorAngle = value;
    this.write({ sensorAngle: value });
  }

  setSensorRadius(value: number): void {
    this.sensorRadius = value;
    this.write({ sensorRadius: value });
  }

  setSensorThreshold(value: number): void {
    this.sensorThreshold = value;
    this.write({ sensorThreshold: value });
  }

  setSensorStrength(value: number): void {
    this.sensorStrength = value;
    this.write({ sensorStrength: value });
  }

  setColorSimilarityThreshold(value: number): void {
    this.colorSimilarityThreshold = value;
    this.write({ colorSimilarityThreshold: value });
  }

  // Setters for behavior configuration
  setFollowBehavior(behavior: SensorBehavior): void {
    this.followBehavior = behavior;
    this.write({ followBehavior: this.behaviorToUniform(behavior) });
  }

  setFleeBehavior(behavior: SensorBehavior): void {
    this.fleeBehavior = behavior;
    this.write({ fleeBehavior: this.behaviorToUniform(behavior) });
  }

  setFleeAngle(value: number): void {
    this.fleeAngle = value;
    this.write({ fleeAngle: value });
  }

  setParticleColor(hexColor: string): void {
    const color = this.hexToRgb(hexColor);
    this.particleColorR = color.r / 255.0;
    this.particleColorG = color.g / 255.0;
    this.particleColorB = color.b / 255.0;
    this.write({
      particleColorR: this.particleColorR,
      particleColorG: this.particleColorG,
      particleColorB: this.particleColorB,
    });
  }

  descriptor(): ComputeModuleDescriptor<"sensors", SensorBindingKeys> {
    return {
      name: "sensors",
      role: "force",
      bindings: [
        "enableTrail",
        "trailDecay",
        "trailDiffuse",
        "enableSensors",
        "sensorDistance",
        "sensorAngle",
        "sensorRadius",
        "sensorThreshold",
        "sensorStrength",
        "colorSimilarityThreshold",
        "followBehavior",
        "fleeBehavior",
        "fleeAngle",
        "particleColorR",
        "particleColorG",
        "particleColorB",
      ] as const,
      global: () => `
// Sensor helper functions (defined at global scope)
fn sensor_sample_intensity(pos: vec2<f32>, radius: f32, selfIndex: u32) -> f32 {
  // Simulate intensity sampling using nearby particle density
  var intensity: f32 = 0.0;
  var it = neighbor_iter_init(pos, radius);
  loop {
    let j = neighbor_iter_next(&it, selfIndex);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    let dist = distance(pos, other.position);
    if (dist < radius && dist > 0.0) {
      // Intensity based on proximity and particle size
      intensity += other.size / max(dist, 0.1);
    }
  }
  return min(intensity, 1.0); // clamp to [0,1]
}

fn sensor_sample_color(pos: vec2<f32>, radius: f32, selfIndex: u32) -> vec3<f32> {
  // Simulate color sampling by averaging nearby particle colors
  var colorSum = vec3<f32>(0.0, 0.0, 0.0);
  var count: f32 = 0.0;
  var it = neighbor_iter_init(pos, radius);
  loop {
    let j = neighbor_iter_next(&it, selfIndex);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    let dist = distance(pos, other.position);
    if (dist < radius) {
      // For now, assume white particles (would need particle color data)
      colorSum += vec3<f32>(1.0, 1.0, 1.0);
      count += 1.0;
    }
  }
  if (count > 0.0) {
    return colorSum / count;
  }
  return vec3<f32>(0.0, 0.0, 0.0); // black if no particles nearby
}

fn sensor_is_activated(
  intensity: f32,
  sensorColor: vec3<f32>, 
  particleColor: vec3<f32>,
  behavior: f32,
  threshold: f32,
  colorThreshold: f32
) -> bool {
  // Check intensity threshold first
  if (intensity <= threshold) {
    return false;
  }

  if (behavior == 0.0) { // "any"
    return true;
  } else if (behavior == 1.0) { // "same"
    let colorDiff = sensorColor - particleColor;
    let distance = sqrt(dot(colorDiff, colorDiff));
    let maxDistance = sqrt(3.0); // max distance in RGB space (0-1 range)
    let similarity = 1.0 - (distance / maxDistance);
    return similarity > colorThreshold;
  } else if (behavior == 2.0) { // "different"
    let colorDiff = sensorColor - particleColor;
    let distance = sqrt(dot(colorDiff, colorDiff));
    let maxDistance = sqrt(3.0);
    let similarity = 1.0 - (distance / maxDistance);
    return similarity <= colorThreshold;
  } else { // "none" (behavior == 3.0)
    return false;
  }
}
`,
      apply: ({ particleVar, getUniform }) => `
  // Early exit if sensors are disabled or particle is pinned (mass = 0 indicates pinned)
  if (${getUniform("enableSensors")} == 0.0 || ${particleVar}.mass == 0.0) {
    return;
  }

  // Get sensor configuration
  let sensorDist = ${getUniform("sensorDistance")};
  let sensorAngle = ${getUniform("sensorAngle")};
  let sensorRadius = ${getUniform("sensorRadius")};
  let sensorThreshold = ${getUniform("sensorThreshold")};
  let sensorStrength = ${getUniform("sensorStrength")};
  let colorThreshold = ${getUniform("colorSimilarityThreshold")};
  let followBehavior = ${getUniform("followBehavior")};
  let fleeBehavior = ${getUniform("fleeBehavior")};
  let fleeAngleOffset = ${getUniform("fleeAngle")};
  
  // Get particle color for color-based behaviors
  let particleColor = vec3<f32>(
    ${getUniform("particleColorR")},
    ${getUniform("particleColorG")},
    ${getUniform("particleColorB")}
  );

  // Calculate particle velocity direction (normalized)
  let velocityMag = length(${particleVar}.velocity);
  var velocityDir = vec2<f32>(1.0, 0.0); // default direction
  if (velocityMag > 0.01) {
    velocityDir = normalize(${particleVar}.velocity);
  } else {
    // Use pseudo-random direction when particle has no velocity
    let h = dot(${particleVar}.position, vec2<f32>(12.9898, 78.233));
    let r = fract(sin(h) * 43758.5453) * 2.0 * 3.14159265; // 0 to 2π
    velocityDir = vec2<f32>(cos(r), sin(r));
  }

  // Calculate sensor positions
  // Left sensor: rotate velocity direction by -sensorAngle
  let cosLeft = cos(-sensorAngle);
  let sinLeft = sin(-sensorAngle);
  let leftDir = vec2<f32>(
    velocityDir.x * cosLeft - velocityDir.y * sinLeft,
    velocityDir.x * sinLeft + velocityDir.y * cosLeft
  );
  let leftSensorPos = ${particleVar}.position + leftDir * sensorDist;

  // Right sensor: rotate velocity direction by +sensorAngle  
  let cosRight = cos(sensorAngle);
  let sinRight = sin(sensorAngle);
  let rightDir = vec2<f32>(
    velocityDir.x * cosRight - velocityDir.y * sinRight,
    velocityDir.x * sinRight + velocityDir.y * cosRight
  );
  let rightSensorPos = ${particleVar}.position + rightDir * sensorDist;

  // Sample sensor data using spatial grid (simulate pixel/trail reading)
  let leftIntensity = sensor_sample_intensity(leftSensorPos, sensorRadius, index);
  let rightIntensity = sensor_sample_intensity(rightSensorPos, sensorRadius, index);
  let leftColor = sensor_sample_color(leftSensorPos, sensorRadius, index);
  let rightColor = sensor_sample_color(rightSensorPos, sensorRadius, index);

  // Evaluate sensor activation for follow behavior
  var followForce = vec2<f32>(0.0, 0.0);
  if (followBehavior != 3.0) { // not "none"
    let leftFollowActive = sensor_is_activated(leftIntensity, leftColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
    let rightFollowActive = sensor_is_activated(rightIntensity, rightColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
    
    // Determine winning sensor for follow behavior
    if (leftFollowActive && !rightFollowActive) {
      followForce = leftDir;
    } else if (rightFollowActive && !leftFollowActive) {
      followForce = rightDir;
    }
    // If both or neither are active, no follow force
  }

  // Evaluate sensor activation for flee behavior  
  var fleeForce = vec2<f32>(0.0, 0.0);
  if (fleeBehavior != 3.0) { // not "none"
    let leftFleeActive = sensor_is_activated(leftIntensity, leftColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
    let rightFleeActive = sensor_is_activated(rightIntensity, rightColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
    
    // Determine winning sensor for flee behavior and apply flee angle
    if (leftFleeActive && !rightFleeActive) {
      // Flee from left sensor: rotate left direction by -fleeAngle (turn right)
      let cosFleeLeft = cos(-fleeAngleOffset);
      let sinFleeLeft = sin(-fleeAngleOffset);
      fleeForce = vec2<f32>(
        leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
        leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft
      );
    } else if (rightFleeActive && !leftFleeActive) {
      // Flee from right sensor: rotate right direction by +fleeAngle (turn left)
      let cosFleeRight = cos(fleeAngleOffset);
      let sinFleeRight = sin(fleeAngleOffset);
      fleeForce = vec2<f32>(
        rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
        rightDir.x * sinFleeRight + rightDir.y * cosFleeRight
      );
    }
    // If both or neither are active, no flee force
  }

  // Combine and apply forces
  var totalForce = followForce + fleeForce;
  if (length(totalForce) > 0.0) {
    let normalizedForce = normalize(totalForce);
    ${particleVar}.velocity = normalizedForce * (sensorStrength / 5.0);
  }
`,
    };
  }
}
