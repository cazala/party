import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

export type SensorBehavior = "any" | "same" | "different" | "none";

type SensorBindingKeys =
  | "sensorDistance"
  | "sensorAngle"
  | "sensorRadius"
  | "sensorThreshold"
  | "sensorStrength"
  | "colorSimilarityThreshold"
  | "followBehavior"
  | "fleeBehavior"
  | "fleeAngle"
  | "enabled";

export class Sensors extends ComputeModule<"sensors", SensorBindingKeys> {
  private sensorDistance: number;
  private sensorAngle: number;
  private sensorRadius: number;
  private sensorThreshold: number;
  private sensorStrength: number;
  private colorSimilarityThreshold: number;
  private followBehavior: SensorBehavior;
  private fleeBehavior: SensorBehavior;
  private fleeAngle: number;

  constructor(opts?: {
    enabled?: boolean;
    sensorDistance?: number;
    sensorAngle?: number;
    sensorRadius?: number;
    sensorThreshold?: number;
    sensorStrength?: number;
    colorSimilarityThreshold?: number;
    followBehavior?: SensorBehavior;
    fleeBehavior?: SensorBehavior;
    fleeAngle?: number;
  }) {
    super();

    this.sensorDistance = opts?.sensorDistance ?? 30;
    this.sensorAngle = opts?.sensorAngle ?? Math.PI / 6; // 30 degrees
    this.sensorRadius = opts?.sensorRadius ?? 3;
    this.sensorThreshold = opts?.sensorThreshold ?? 0.1;
    this.sensorStrength = opts?.sensorStrength ?? 1000;
    this.colorSimilarityThreshold = opts?.colorSimilarityThreshold ?? 0.4;
    this.followBehavior = opts?.followBehavior ?? "any";
    this.fleeBehavior = opts?.fleeBehavior ?? "none";
    this.fleeAngle = opts?.fleeAngle ?? Math.PI / 2; // 90 degrees

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      sensorDistance: this.sensorDistance,
      sensorAngle: this.sensorAngle,
      sensorRadius: this.sensorRadius,
      sensorThreshold: this.sensorThreshold,
      sensorStrength: this.sensorStrength,
      colorSimilarityThreshold: this.colorSimilarityThreshold,
      followBehavior: this.behaviorToUniform(this.followBehavior),
      fleeBehavior: this.behaviorToUniform(this.fleeBehavior),
      fleeAngle: this.fleeAngle,
      enabled: this.isEnabled() ? 1 : 0,
    });
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

  descriptor(): ComputeModuleDescriptor<"sensors", SensorBindingKeys> {
    return {
      name: "sensors",
      role: "force",
      bindings: [
        "sensorDistance",
        "sensorAngle",
        "sensorRadius",
        "sensorThreshold",
        "sensorStrength",
        "colorSimilarityThreshold",
        "followBehavior",
        "fleeBehavior",
        "fleeAngle",
      ] as const,
      global: () => `// Sensor helper functions (defined at global scope)
// Sample from the scene texture bound to the compute pipeline

fn world_to_uv(pos: vec2<f32>) -> vec2<f32> {
  // Transform world position into UV in [0,1] using grid uniforms
  // Trails are rendered with Y already flipped in the vertex shader,
  // so sampling should NOT flip Y again here.
  let u = (pos.x - GRID_MINX()) / (GRID_MAXX() - GRID_MINX());
  let v = (pos.y - GRID_MINY()) / (GRID_MAXY() - GRID_MINY());
  return clamp(vec2<f32>(u, v), vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
}

fn uv_to_texel(uv: vec2<f32>) -> vec2<i32> {
  // Derive dimensions from texture
  let dim = textureDimensions(scene_texture);
  let x = i32(clamp(floor(uv.x * f32(dim.x)), 0.0, f32(dim.x - 1)));
  let y = i32(clamp(floor(uv.y * f32(dim.y)), 0.0, f32(dim.y - 1)));
  return vec2<i32>(x, y);
}

fn sensor_sample_intensity(pos: vec2<f32>, radius: f32, _selfIndex: u32) -> f32 {
  // Sample a small disk in the trail texture and average luminance
  let uv = world_to_uv(pos);
  let dim = textureDimensions(scene_texture);
  // Convert world radius to approximate pixels using grid extent
  let pxPerWorld = f32(dim.x) / (GRID_MAXX() - GRID_MINX());
  let pxRadius = clamp(radius * pxPerWorld, 1.0, 16.0);
  let center = uv_to_texel(uv);
  var sum: f32 = 0.0;
  var count: f32 = 0.0;
  let r = i32(clamp(pxRadius, 1.0, 8.0));
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let tc = vec2<i32>(center.x + dx, center.y + dy);
      if (tc.x < 0 || tc.y < 0 || tc.x >= i32(dim.x) || tc.y >= i32(dim.y)) { continue; }
      let c = textureLoad(scene_texture, tc, 0);
      let lum = dot(c.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
      sum += lum;
      count += 1.0;
    }
  }
  if (count > 0.0) {
    return clamp(sum / count, 0.0, 1.0);
  }
  return 0.0;
}

fn sensor_sample_color(pos: vec2<f32>, radius: f32, _selfIndex: u32) -> vec3<f32> {
  let uv = world_to_uv(pos);
  let dim = textureDimensions(scene_texture);
  let pxPerWorld = f32(dim.x) / (GRID_MAXX() - GRID_MINX());
  let pxRadius = clamp(radius * pxPerWorld, 1.0, 16.0);
  let center = uv_to_texel(uv);
  var sum = vec3<f32>(0.0, 0.0, 0.0);
  var count: f32 = 0.0;
  let r = i32(clamp(pxRadius, 1.0, 8.0));
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let tc = vec2<i32>(center.x + dx, center.y + dy);
      if (tc.x < 0 || tc.y < 0 || tc.x >= i32(dim.x) || tc.y >= i32(dim.y)) { continue; }
      let c = textureLoad(scene_texture, tc, 0);
      sum += c.rgb;
      count += 1.0;
    }
  }
  if (count > 0.0) {
    return clamp(sum / count, vec3<f32>(0.0), vec3<f32>(1.0));
  }
  return vec3<f32>(0.0, 0.0, 0.0);
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
// Early exit if module is disabled or particle is pinned
if (${getUniform("enabled")} == 0.0 || ${particleVar}.mass == 0.0) {
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
let particleColor = ${particleVar}.color.rgb;

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

// Sample sensor data from scene texture (works for trails-on and trails-off paths)
let leftIntensity = sensor_sample_intensity(leftSensorPos, sensorRadius, index);
let rightIntensity = sensor_sample_intensity(rightSensorPos, sensorRadius, index);
let leftColor = sensor_sample_color(leftSensorPos, sensorRadius, index);
let rightColor = sensor_sample_color(rightSensorPos, sensorRadius, index);

// Evaluate sensor activation for follow behavior
var followForce = vec2<f32>(0.0, 0.0);
if (followBehavior == 0.0) { // "any" (ignore color, compare intensities)
  if (leftIntensity > rightIntensity && leftIntensity > sensorThreshold) {
    followForce = leftDir;
  } else if (rightIntensity > leftIntensity && rightIntensity > sensorThreshold) {
    followForce = rightDir;
  }
} else if (followBehavior == 1.0 || followBehavior == 2.0) { // "same" or "different"
  let leftActive = sensor_is_activated(leftIntensity, leftColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
  let rightActive = sensor_is_activated(rightIntensity, rightColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
  if (leftActive && !rightActive) {
    followForce = leftDir;
  } else if (rightActive && !leftActive) {
    followForce = rightDir;
  }
} // else "none" -> no follow force

// Evaluate sensor activation for flee behavior
var fleeForce = vec2<f32>(0.0, 0.0);
if (fleeBehavior == 0.0) { // "any" (ignore color, compare intensities)
  if (leftIntensity > rightIntensity && leftIntensity > sensorThreshold) {
    // Flee from left sensor: rotate left direction by -fleeAngle (turn right)
    let cosFleeLeft = cos(-fleeAngleOffset);
    let sinFleeLeft = sin(-fleeAngleOffset);
    fleeForce = vec2<f32>(
      leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
      leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft
    );
  } else if (rightIntensity > leftIntensity && rightIntensity > sensorThreshold) {
    // Flee from right sensor: rotate right direction by +fleeAngle (turn left)
    let cosFleeRight = cos(fleeAngleOffset);
    let sinFleeRight = sin(fleeAngleOffset);
    fleeForce = vec2<f32>(
      rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
      rightDir.x * sinFleeRight + rightDir.y * cosFleeRight
    );
  }
} else if (fleeBehavior == 1.0 || fleeBehavior == 2.0) { // "same" or "different"
  let leftActive = sensor_is_activated(leftIntensity, leftColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
  let rightActive = sensor_is_activated(rightIntensity, rightColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
  if (leftActive && !rightActive) {
    // Flee from left sensor: rotate left direction by -fleeAngle (turn right)
    let cosFleeLeft = cos(-fleeAngleOffset);
    let sinFleeLeft = sin(-fleeAngleOffset);
    fleeForce = vec2<f32>(
      leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
      leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft
    );
  } else if (rightActive && !leftActive) {
    // Flee from right sensor: rotate right direction by +fleeAngle (turn left)
    let cosFleeRight = cos(fleeAngleOffset);
    let sinFleeRight = sin(fleeAngleOffset);
    fleeForce = vec2<f32>(
      rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
      rightDir.x * sinFleeRight + rightDir.y * cosFleeRight
    );
  }
}

// Combine and apply forces
// Set velocity based on sensor decision (do not integrate acceleration)
var totalForce = followForce + fleeForce;
if (length(totalForce) > 0.0) {
  let dir = normalize(totalForce);
  // Match CPU: set velocity to direction scaled by sensorStrength/5
  ${particleVar}.velocity = dir * (sensorStrength / 5.0);
}
`,
    };
  }
}
