/**
 * Sensors (Force/Behavior Module)
 *
 * Samples the scene texture around two forward-biased sensor points (left/right)
 * to derive simple follow/flee steering decisions. Supports color-aware behaviors
 * (same/different) and intensity-only mode. Writes directly to velocity for snappy
 * reactions (mirrors CPU behavior path).
 */
import {
  Module,
  type WebGPUDescriptor,
  type WebGL2Descriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

export type SensorBehavior = "any" | "same" | "different" | "none";

export const DEFAULT_SENSORS_SENSOR_DISTANCE = 30;
export const DEFAULT_SENSORS_SENSOR_ANGLE = Math.PI / 6; // 30 degrees
export const DEFAULT_SENSORS_SENSOR_RADIUS = 3;
export const DEFAULT_SENSORS_SENSOR_THRESHOLD = 0.1;
export const DEFAULT_SENSORS_SENSOR_STRENGTH = 1000;
export const DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD = 0.4;
export const DEFAULT_SENSORS_FOLLOW_BEHAVIOR: SensorBehavior = "any";
export const DEFAULT_SENSORS_FLEE_BEHAVIOR: SensorBehavior = "none";
export const DEFAULT_SENSORS_FLEE_ANGLE = Math.PI / 2;

type SensorsInputs = {
  sensorDistance: number;
  sensorAngle: number;
  sensorRadius: number;
  sensorThreshold: number;
  sensorStrength: number;
  colorSimilarityThreshold: number;
  followBehavior: number;
  fleeBehavior: number;
  fleeAngle: number;
};

export class Sensors extends Module<"sensors", SensorsInputs> {
  readonly name = "sensors" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    sensorDistance: DataType.NUMBER,
    sensorAngle: DataType.NUMBER,
    sensorRadius: DataType.NUMBER,
    sensorThreshold: DataType.NUMBER,
    sensorStrength: DataType.NUMBER,
    colorSimilarityThreshold: DataType.NUMBER,
    followBehavior: DataType.NUMBER,
    fleeBehavior: DataType.NUMBER,
    fleeAngle: DataType.NUMBER,
  } as const;

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
    this.write({
      sensorDistance: opts?.sensorDistance ?? DEFAULT_SENSORS_SENSOR_DISTANCE,
      sensorAngle: opts?.sensorAngle ?? DEFAULT_SENSORS_SENSOR_ANGLE,
      sensorRadius: opts?.sensorRadius ?? DEFAULT_SENSORS_SENSOR_RADIUS,
      sensorThreshold:
        opts?.sensorThreshold ?? DEFAULT_SENSORS_SENSOR_THRESHOLD,
      sensorStrength: opts?.sensorStrength ?? DEFAULT_SENSORS_SENSOR_STRENGTH,
      colorSimilarityThreshold:
        opts?.colorSimilarityThreshold ??
        DEFAULT_SENSORS_COLOR_SIMILARITY_THRESHOLD,
      followBehavior: this.behaviorToUniform(
        opts?.followBehavior ?? DEFAULT_SENSORS_FOLLOW_BEHAVIOR
      ),
      fleeBehavior: this.behaviorToUniform(
        opts?.fleeBehavior ?? DEFAULT_SENSORS_FLEE_BEHAVIOR
      ),
      fleeAngle: opts?.fleeAngle ?? DEFAULT_SENSORS_FLEE_ANGLE,
    });

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
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
    this.write({ sensorDistance: value });
  }

  setSensorAngle(value: number): void {
    this.write({ sensorAngle: value });
  }

  setSensorRadius(value: number): void {
    this.write({ sensorRadius: value });
  }

  setSensorThreshold(value: number): void {
    this.write({ sensorThreshold: value });
  }

  setSensorStrength(value: number): void {
    this.write({ sensorStrength: value });
  }

  setColorSimilarityThreshold(value: number): void {
    this.write({ colorSimilarityThreshold: value });
  }

  setFollowBehavior(behavior: SensorBehavior): void {
    this.write({ followBehavior: this.behaviorToUniform(behavior) });
  }

  setFleeBehavior(behavior: SensorBehavior): void {
    this.write({ fleeBehavior: this.behaviorToUniform(behavior) });
  }

  setFleeAngle(value: number): void {
    this.write({ fleeAngle: value });
  }

  getSensorDistance(): number {
    return this.readValue("sensorDistance");
  }
  getSensorAngle(): number {
    return this.readValue("sensorAngle");
  }
  getSensorRadius(): number {
    return this.readValue("sensorRadius");
  }
  getSensorThreshold(): number {
    return this.readValue("sensorThreshold");
  }
  getSensorStrength(): number {
    return this.readValue("sensorStrength");
  }
  getColorSimilarityThreshold(): number {
    return this.readValue("colorSimilarityThreshold");
  }
  getFollowBehavior(): number {
    return this.readValue("followBehavior");
  }
  getFleeBehavior(): number {
    return this.readValue("fleeBehavior");
  }
  getFleeAngle(): number {
    return this.readValue("fleeAngle");
  }
  getEnabled(): number {
    return this.readValue("enabled");
  }

  webgpu(): WebGPUDescriptor<SensorsInputs> {
    return {
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
if (${particleVar}.mass == 0.0) {
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

  cpu(): CPUDescriptor<SensorsInputs> {
    return {
      apply: ({ particle, input, getImageData, view }) => {
        const sensorDist = input.sensorDistance;
        const sensorAngle = input.sensorAngle;
        const sensorRadius = input.sensorRadius;
        const sensorThreshold = input.sensorThreshold;
        const sensorStrength = input.sensorStrength;
        const colorThreshold = input.colorSimilarityThreshold;
        const followBehavior = input.followBehavior;
        const fleeBehavior = input.fleeBehavior;
        const fleeAngleOffset = input.fleeAngle;

        // Get particle color for color-based behaviors
        const particleColor = {
          r: particle.color.r,
          g: particle.color.g,
          b: particle.color.b,
        };

        // Calculate particle velocity direction (normalized)
        const velocityMag = Math.sqrt(
          particle.velocity.x * particle.velocity.x +
            particle.velocity.y * particle.velocity.y
        );
        let velocityDir = { x: 1, y: 0 }; // default direction

        if (velocityMag > 0.01) {
          velocityDir = {
            x: particle.velocity.x / velocityMag,
            y: particle.velocity.y / velocityMag,
          };
        } else {
          // Use pseudo-random direction when particle has no velocity
          const h =
            particle.position.x * 12.9898 + particle.position.y * 78.233;
          const r = ((Math.sin(h) * 43758.5453) % 1) * 2 * Math.PI;
          velocityDir = { x: Math.cos(r), y: Math.sin(r) };
        }

        // Calculate sensor positions
        // Left sensor: rotate velocity direction by -sensorAngle
        const cosLeft = Math.cos(-sensorAngle);
        const sinLeft = Math.sin(-sensorAngle);
        const leftDir = {
          x: velocityDir.x * cosLeft - velocityDir.y * sinLeft,
          y: velocityDir.x * sinLeft + velocityDir.y * cosLeft,
        };
        const leftSensorPos = {
          x: particle.position.x + leftDir.x * sensorDist,
          y: particle.position.y + leftDir.y * sensorDist,
        };

        // Right sensor: rotate velocity direction by +sensorAngle
        const cosRight = Math.cos(sensorAngle);
        const sinRight = Math.sin(sensorAngle);
        const rightDir = {
          x: velocityDir.x * cosRight - velocityDir.y * sinRight,
          y: velocityDir.x * sinRight + velocityDir.y * cosRight,
        };
        const rightSensorPos = {
          x: particle.position.x + rightDir.x * sensorDist,
          y: particle.position.y + rightDir.y * sensorDist,
        };

        // Helper function to sample canvas at a position with radius
        const sampleCanvas = (
          position: { x: number; y: number },
          radius: number
        ): {
          intensity: number;
          color: { r: number; g: number; b: number };
        } => {
          const camera = view.getCamera();
          const zoom = view.getZoom();
          const size = view.getSize();
          const centerX = size.width / 2;
          const centerY = size.height / 2;

          // Transform world position to screen position
          const worldX = (position.x - camera.x) * zoom;
          const worldY = (position.y - camera.y) * zoom;
          const screenX = centerX + worldX;
          const screenY = centerY + worldY;
          const screenRadius = Math.max(1, radius * zoom);

          // Calculate sample area bounds
          const left = Math.floor(screenX - screenRadius);
          const top = Math.floor(screenY - screenRadius);
          const right = Math.ceil(screenX + screenRadius);
          const bottom = Math.ceil(screenY + screenRadius);
          const width = right - left;
          const height = bottom - top;

          if (width <= 0 || height <= 0) {
            return { intensity: 0, color: { r: 0, g: 0, b: 0 } };
          }

          const imageData = getImageData(left, top, width, height);
          if (!imageData) {
            return { intensity: 0, color: { r: 0, g: 0, b: 0 } };
          }

          const data = imageData.data;
          let totalR = 0,
            totalG = 0,
            totalB = 0,
            totalIntensity = 0;
          let sampleCount = 0;

          // Sample pixels in a circular area
          const centerSampleX = screenX - left;
          const centerSampleY = screenY - top;

          for (let y = 0; y < imageData.height; y++) {
            for (let x = 0; x < imageData.width; x++) {
              const dx = x - centerSampleX;
              const dy = y - centerSampleY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance <= screenRadius) {
                const i = (y * imageData.width + x) * 4;
                const r = data[i] / 255;
                const g = data[i + 1] / 255;
                const b = data[i + 2] / 255;
                const intensity = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Luminance

                totalR += r;
                totalG += g;
                totalB += b;
                totalIntensity += intensity;
                sampleCount++;
              }
            }
          }

          if (sampleCount === 0) {
            return { intensity: 0, color: { r: 0, g: 0, b: 0 } };
          }

          return {
            intensity: Math.min(1, Math.max(0, totalIntensity / sampleCount)),
            color: {
              r: Math.min(1, Math.max(0, totalR / sampleCount)),
              g: Math.min(1, Math.max(0, totalG / sampleCount)),
              b: Math.min(1, Math.max(0, totalB / sampleCount)),
            },
          };
        };

        const leftSample = sampleCanvas(leftSensorPos, sensorRadius);
        const rightSample = sampleCanvas(rightSensorPos, sensorRadius);

        // Helper function to check sensor activation
        const isSensorActivated = (
          intensity: number,
          sensorColor: { r: number; g: number; b: number },
          behavior: number
        ): boolean => {
          // Check intensity threshold first
          if (intensity <= sensorThreshold) {
            return false;
          }

          if (behavior === 0) {
            // "any"
            return true;
          } else if (behavior === 1) {
            // "same"
            const colorDiff = {
              r: sensorColor.r - particleColor.r,
              g: sensorColor.g - particleColor.g,
              b: sensorColor.b - particleColor.b,
            };
            const distance = Math.sqrt(
              colorDiff.r * colorDiff.r +
                colorDiff.g * colorDiff.g +
                colorDiff.b * colorDiff.b
            );
            const maxDistance = Math.sqrt(3); // max distance in RGB space (0-1 range)
            const similarity = 1 - distance / maxDistance;
            return similarity > colorThreshold;
          } else if (behavior === 2) {
            // "different"
            const colorDiff = {
              r: sensorColor.r - particleColor.r,
              g: sensorColor.g - particleColor.g,
              b: sensorColor.b - particleColor.b,
            };
            const distance = Math.sqrt(
              colorDiff.r * colorDiff.r +
                colorDiff.g * colorDiff.g +
                colorDiff.b * colorDiff.b
            );
            const maxDistance = Math.sqrt(3);
            const similarity = 1 - distance / maxDistance;
            return similarity <= colorThreshold;
          } else {
            // "none" (behavior === 3)
            return false;
          }
        };

        // Evaluate sensor activation for follow behavior
        let followForce = { x: 0, y: 0 };
        if (followBehavior === 0) {
          // "any" (ignore color, compare intensities)
          if (
            leftSample.intensity > rightSample.intensity &&
            leftSample.intensity > sensorThreshold
          ) {
            followForce = leftDir;
          } else if (
            rightSample.intensity > leftSample.intensity &&
            rightSample.intensity > sensorThreshold
          ) {
            followForce = rightDir;
          }
        } else if (followBehavior === 1 || followBehavior === 2) {
          // "same" or "different"
          const leftActive = isSensorActivated(
            leftSample.intensity,
            leftSample.color,
            followBehavior
          );
          const rightActive = isSensorActivated(
            rightSample.intensity,
            rightSample.color,
            followBehavior
          );
          if (leftActive && !rightActive) {
            followForce = leftDir;
          } else if (rightActive && !leftActive) {
            followForce = rightDir;
          }
        } // else "none" -> no follow force

        // Evaluate sensor activation for flee behavior
        let fleeForce = { x: 0, y: 0 };
        if (fleeBehavior === 0) {
          // "any" (ignore color, compare intensities)
          if (
            leftSample.intensity > rightSample.intensity &&
            leftSample.intensity > sensorThreshold
          ) {
            // Flee from left sensor: rotate left direction by -fleeAngle (turn right)
            const cosFleeLeft = Math.cos(-fleeAngleOffset);
            const sinFleeLeft = Math.sin(-fleeAngleOffset);
            fleeForce = {
              x: leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
              y: leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft,
            };
          } else if (
            rightSample.intensity > leftSample.intensity &&
            rightSample.intensity > sensorThreshold
          ) {
            // Flee from right sensor: rotate right direction by +fleeAngle (turn left)
            const cosFleeRight = Math.cos(fleeAngleOffset);
            const sinFleeRight = Math.sin(fleeAngleOffset);
            fleeForce = {
              x: rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
              y: rightDir.x * sinFleeRight + rightDir.y * cosFleeRight,
            };
          }
        } else if (fleeBehavior === 1 || fleeBehavior === 2) {
          // "same" or "different"
          const leftActive = isSensorActivated(
            leftSample.intensity,
            leftSample.color,
            fleeBehavior
          );
          const rightActive = isSensorActivated(
            rightSample.intensity,
            rightSample.color,
            fleeBehavior
          );
          if (leftActive && !rightActive) {
            // Flee from left sensor: rotate left direction by -fleeAngle (turn right)
            const cosFleeLeft = Math.cos(-fleeAngleOffset);
            const sinFleeLeft = Math.sin(-fleeAngleOffset);
            fleeForce = {
              x: leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
              y: leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft,
            };
          } else if (rightActive && !leftActive) {
            // Flee from right sensor: rotate right direction by +fleeAngle (turn left)
            const cosFleeRight = Math.cos(fleeAngleOffset);
            const sinFleeRight = Math.sin(fleeAngleOffset);
            fleeForce = {
              x: rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
              y: rightDir.x * sinFleeRight + rightDir.y * cosFleeRight,
            };
          }
        }

        // Combine and apply forces
        const totalForce = {
          x: followForce.x + fleeForce.x,
          y: followForce.y + fleeForce.y,
        };

        const forceMag = Math.sqrt(
          totalForce.x * totalForce.x + totalForce.y * totalForce.y
        );
        if (forceMag > 0) {
          const dir = {
            x: totalForce.x / forceMag,
            y: totalForce.y / forceMag,
          };
          // Match WebGPU: set velocity to direction scaled by sensorStrength/5
          particle.velocity.x = dir.x * (sensorStrength / 5);
          particle.velocity.y = dir.y * (sensorStrength / 5);
        }
      },
    };
  }

  webgl2(): WebGL2Descriptor<SensorsInputs> {
    // WebGL2 sensor module: samples scene texture for follow/flee steering
    // Requires scene_texture binding in the shader
    return {
      global: () => `// Sensor helper functions for WebGL2
// Assumes scene_texture uniform is bound

vec2 webgl2_world_to_uv(vec2 pos) {
  // Transform world position into UV using grid uniforms
  float u = (pos.x - GRID_MINX()) / (GRID_MAXX() - GRID_MINX());
  float v = (pos.y - GRID_MINY()) / (GRID_MAXY() - GRID_MINY());
  return clamp(vec2(u, v), vec2(0.0), vec2(1.0));
}

ivec2 webgl2_uv_to_texel(vec2 uv, ivec2 dim) {
  int x = int(clamp(floor(uv.x * float(dim.x)), 0.0, float(dim.x - 1)));
  int y = int(clamp(floor(uv.y * float(dim.y)), 0.0, float(dim.y - 1)));
  return ivec2(x, y);
}

float webgl2_sensor_sample_intensity(vec2 pos, float radius, int selfIndex, sampler2D sceneTex) {
  vec2 uv = webgl2_world_to_uv(pos);
  ivec2 dim = textureSize(sceneTex, 0);
  float pxPerWorld = float(dim.x) / (GRID_MAXX() - GRID_MINX());
  float pxRadius = clamp(radius * pxPerWorld, 1.0, 16.0);
  ivec2 center = webgl2_uv_to_texel(uv, dim);
  float sum = 0.0;
  float count = 0.0;
  int r = int(clamp(pxRadius, 1.0, 8.0));
  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      ivec2 tc = ivec2(center.x + dx, center.y + dy);
      if (tc.x < 0 || tc.y < 0 || tc.x >= dim.x || tc.y >= dim.y) continue;
      vec4 c = texelFetch(sceneTex, tc, 0);
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      sum += lum;
      count += 1.0;
    }
  }
  return count > 0.0 ? clamp(sum / count, 0.0, 1.0) : 0.0;
}

vec3 webgl2_sensor_sample_color(vec2 pos, float radius, int selfIndex, sampler2D sceneTex) {
  vec2 uv = webgl2_world_to_uv(pos);
  ivec2 dim = textureSize(sceneTex, 0);
  float pxPerWorld = float(dim.x) / (GRID_MAXX() - GRID_MINX());
  float pxRadius = clamp(radius * pxPerWorld, 1.0, 16.0);
  ivec2 center = webgl2_uv_to_texel(uv, dim);
  vec3 sum = vec3(0.0);
  float count = 0.0;
  int r = int(clamp(pxRadius, 1.0, 8.0));
  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      ivec2 tc = ivec2(center.x + dx, center.y + dy);
      if (tc.x < 0 || tc.y < 0 || tc.x >= dim.x || tc.y >= dim.y) continue;
      vec4 c = texelFetch(sceneTex, tc, 0);
      sum += c.rgb;
      count += 1.0;
    }
  }
  return count > 0.0 ? clamp(sum / count, vec3(0.0), vec3(1.0)) : vec3(0.0);
}

bool webgl2_sensor_is_activated(
  float intensity,
  vec3 sensorColor,
  vec3 particleColor,
  float behavior,
  float threshold,
  float colorThreshold
) {
  if (intensity <= threshold) return false;
  if (behavior == 0.0) return true; // "any"
  if (behavior == 1.0) { // "same"
    vec3 colorDiff = sensorColor - particleColor;
    float distance = sqrt(dot(colorDiff, colorDiff));
    float maxDistance = sqrt(3.0);
    float similarity = 1.0 - (distance / maxDistance);
    return similarity > colorThreshold;
  }
  if (behavior == 2.0) { // "different"
    vec3 colorDiff = sensorColor - particleColor;
    float distance = sqrt(dot(colorDiff, colorDiff));
    float maxDistance = sqrt(3.0);
    float similarity = 1.0 - (distance / maxDistance);
    return similarity <= colorThreshold;
  }
  return false; // "none"
}
`,
      apply: ({ particleVar, getUniform }) => `
// Early exit if particle is pinned
if (${particleVar}.mass == 0.0) {
  return;
}

// Get sensor configuration
float sensorDist = ${getUniform("sensorDistance")};
float sensorAngle = ${getUniform("sensorAngle")};
float sensorRadius = ${getUniform("sensorRadius")};
float sensorThreshold = ${getUniform("sensorThreshold")};
float sensorStrength = ${getUniform("sensorStrength")};
float colorThreshold = ${getUniform("colorSimilarityThreshold")};
float followBehavior = ${getUniform("followBehavior")};
float fleeBehavior = ${getUniform("fleeBehavior")};
float fleeAngleOffset = ${getUniform("fleeAngle")};

// Get particle color for color-based behaviors
vec3 particleColor = ${particleVar}.color.rgb;

// Calculate particle velocity direction (normalized)
float velocityMag = length(${particleVar}.velocity);
vec2 velocityDir = vec2(1.0, 0.0);
if (velocityMag > 0.01) {
  velocityDir = normalize(${particleVar}.velocity);
} else {
  // Use pseudo-random direction when particle has no velocity
  float h = dot(${particleVar}.position, vec2(12.9898, 78.233));
  float r = fract(sin(h) * 43758.5453) * 2.0 * 3.14159265;
  velocityDir = vec2(cos(r), sin(r));
}

// Calculate sensor positions
// Left sensor: rotate velocity direction by -sensorAngle
float cosLeft = cos(-sensorAngle);
float sinLeft = sin(-sensorAngle);
vec2 leftDir = vec2(
  velocityDir.x * cosLeft - velocityDir.y * sinLeft,
  velocityDir.x * sinLeft + velocityDir.y * cosLeft
);
vec2 leftSensorPos = ${particleVar}.position + leftDir * sensorDist;

// Right sensor: rotate velocity direction by +sensorAngle
float cosRight = cos(sensorAngle);
float sinRight = sin(sensorAngle);
vec2 rightDir = vec2(
  velocityDir.x * cosRight - velocityDir.y * sinRight,
  velocityDir.x * sinRight + velocityDir.y * cosRight
);
vec2 rightSensorPos = ${particleVar}.position + rightDir * sensorDist;

// Note: In WebGL2, we would need to bind scene_texture as u_sceneTexture
// For now, use simplified version without actual scene sampling
// This placeholder returns 0 intensity (will be fully wired when scene texture is bound)
float leftIntensity = 0.0;
float rightIntensity = 0.0;
vec3 leftColor = vec3(0.0);
vec3 rightColor = vec3(0.0);

#ifdef HAS_SCENE_TEXTURE
  leftIntensity = webgl2_sensor_sample_intensity(leftSensorPos, sensorRadius, particleId, u_sceneTexture);
  rightIntensity = webgl2_sensor_sample_intensity(rightSensorPos, sensorRadius, particleId, u_sceneTexture);
  leftColor = webgl2_sensor_sample_color(leftSensorPos, sensorRadius, particleId, u_sceneTexture);
  rightColor = webgl2_sensor_sample_color(rightSensorPos, sensorRadius, particleId, u_sceneTexture);
#endif

// Evaluate sensor activation for follow behavior
vec2 followForce = vec2(0.0, 0.0);
if (followBehavior == 0.0) { // "any"
  if (leftIntensity > rightIntensity && leftIntensity > sensorThreshold) {
    followForce = leftDir;
  } else if (rightIntensity > leftIntensity && rightIntensity > sensorThreshold) {
    followForce = rightDir;
  }
} else if (followBehavior == 1.0 || followBehavior == 2.0) { // "same" or "different"
  bool leftActive = webgl2_sensor_is_activated(leftIntensity, leftColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
  bool rightActive = webgl2_sensor_is_activated(rightIntensity, rightColor, particleColor, followBehavior, sensorThreshold, colorThreshold);
  if (leftActive && !rightActive) {
    followForce = leftDir;
  } else if (rightActive && !leftActive) {
    followForce = rightDir;
  }
}

// Evaluate sensor activation for flee behavior
vec2 fleeForce = vec2(0.0, 0.0);
if (fleeBehavior == 0.0) { // "any"
  if (leftIntensity > rightIntensity && leftIntensity > sensorThreshold) {
    float cosFleeLeft = cos(-fleeAngleOffset);
    float sinFleeLeft = sin(-fleeAngleOffset);
    fleeForce = vec2(
      leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
      leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft
    );
  } else if (rightIntensity > leftIntensity && rightIntensity > sensorThreshold) {
    float cosFleeRight = cos(fleeAngleOffset);
    float sinFleeRight = sin(fleeAngleOffset);
    fleeForce = vec2(
      rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
      rightDir.x * sinFleeRight + rightDir.y * cosFleeRight
    );
  }
} else if (fleeBehavior == 1.0 || fleeBehavior == 2.0) { // "same" or "different"
  bool leftActive = webgl2_sensor_is_activated(leftIntensity, leftColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
  bool rightActive = webgl2_sensor_is_activated(rightIntensity, rightColor, particleColor, fleeBehavior, sensorThreshold, colorThreshold);
  if (leftActive && !rightActive) {
    float cosFleeLeft = cos(-fleeAngleOffset);
    float sinFleeLeft = sin(-fleeAngleOffset);
    fleeForce = vec2(
      leftDir.x * cosFleeLeft - leftDir.y * sinFleeLeft,
      leftDir.x * sinFleeLeft + leftDir.y * cosFleeLeft
    );
  } else if (rightActive && !leftActive) {
    float cosFleeRight = cos(fleeAngleOffset);
    float sinFleeRight = sin(fleeAngleOffset);
    fleeForce = vec2(
      rightDir.x * cosFleeRight - rightDir.y * sinFleeRight,
      rightDir.x * sinFleeRight + rightDir.y * cosFleeRight
    );
  }
}

// Combine and apply forces
vec2 totalForce = followForce + fleeForce;
if (length(totalForce) > 0.0) {
  vec2 dir = normalize(totalForce);
  // Match CPU: set velocity to direction scaled by sensorStrength/5
  ${particleVar}.velocity = dir * (sensorStrength / 5.0);
}
`,
    };
  }
}
