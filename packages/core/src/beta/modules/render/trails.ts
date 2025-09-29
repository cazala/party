/**
 * Trails (Render Module)
 *
 * Two compute image passes over the scene texture:
 * - decay: exponential fade toward clear color with alpha decay
 * - diffuse: gaussian-like blur with configurable radius
 * Both read from input texture and write to output, participating in ping-pong.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  RenderPassKind,
  CPUDescriptor,
  CanvasComposition,
  DataType,
} from "../../module";

export const DEFAULT_TRAILS_TRAIL_DECAY = 2;
export const DEFAULT_TRAILS_TRAIL_DIFFUSE = 0.0;

type TrailsInputs = {
  trailDecay: number;
  trailDiffuse: number;
};

export class Trails extends Module<"trails", TrailsInputs> {
  readonly name = "trails" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    trailDecay: DataType.NUMBER,
    trailDiffuse: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    trailDecay?: number;
    trailDiffuse?: number;
  }) {
    super();
    this.write({
      trailDecay: opts?.trailDecay ?? DEFAULT_TRAILS_TRAIL_DECAY,
      trailDiffuse: opts?.trailDiffuse ?? DEFAULT_TRAILS_TRAIL_DIFFUSE,
    });

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setTrailDecay(value: number): void {
    this.write({ trailDecay: value });
  }

  setTrailDiffuse(value: number): void {
    this.write({ trailDiffuse: value });
  }

  getTrailDecay(): number {
    return this.readValue("trailDecay");
  }
  getTrailDiffuse(): number {
    return this.readValue("trailDiffuse");
  }

  webgpu(): WebGPUDescriptor<TrailsInputs> {
    return {
      passes: [
        {
          kind: RenderPassKind.Compute,
          kernel: ({ getUniform, readScene, writeScene }) => `{
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let current = ${readScene("coords")};
  let d = clamp(${getUniform("trailDecay")} * 0.005, 0.0, 1.0);
  if (d <= 0.00001) { ${writeScene("coords", "current")}; return; }
  let bg = vec3<f32>(${getUniform("clearColorR")}, ${getUniform(
            "clearColorG"
          )}, ${getUniform("clearColorB")});
  let out_rgb = mix(current.rgb, bg, d);
  let out_a = current.a * (1.0 - d);
  let eps = 1.0 / 255.0;
  if (all(abs(out_rgb - bg) < vec3<f32>(eps)) && out_a < eps) {
    ${writeScene("coords", "vec4<f32>(bg, 0.0)")};
  } else {
    ${writeScene("coords", "vec4<f32>(out_rgb, out_a)")};
  }
}`,
          bindings: ["trailDecay"] as const,
          readsScene: true,
          writesScene: true,
        },
        {
          kind: RenderPassKind.Compute,
          kernel: ({ getUniform, readScene, writeScene }) => `{
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let dims = textureDimensions(input_texture);
  let radius_i = clamp(i32(round(${getUniform("trailDiffuse")})), 0, 12);
  if (radius_i <= 0) { ${writeScene(
    "coords",
    `${readScene("coords")}`
  )}; return; }
  let sigma = max(0.5, f32(radius_i) * 0.5);
  let twoSigma2 = 2.0 * sigma * sigma;
  var sum = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var wsum: f32 = 0.0;
  for (var dy = -radius_i; dy <= radius_i; dy++) {
    for (var dx = -radius_i; dx <= radius_i; dx++) {
      let d2 = f32(dx*dx + dy*dy);
      let w = exp(-d2 / twoSigma2);
      if (w < 1e-5) { continue; }
      let sample_coords = coords + vec2<i32>(dx, dy);
      let clamped_coords = clamp(sample_coords, vec2<i32>(0, 0), vec2<i32>(i32(dims.x) - 1, i32(dims.y) - 1));
      let c = ${readScene("clamped_coords")};
      sum += c * w;
      wsum += w;
    }
  }
  if (wsum > 0.0) {
    ${writeScene("coords", "sum / vec4<f32>(wsum)")};
  } else {
    ${writeScene("coords", `${readScene("coords")}`)};
  }
}`,
          bindings: ["trailDiffuse"] as const,
          readsScene: true,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<TrailsInputs> {
    return {
      composition: CanvasComposition.HandlesBackground,
      setup: ({ context, input, clearColor }) => {
        // Trail effect with decay and blur - match WebGPU behavior
        const canvas = context.canvas;
        const decay = Math.max(0, Math.min(100, input.trailDecay));
        const diffuse = Math.max(
          0,
          Math.min(12, Math.round(input.trailDiffuse))
        );

        // Apply decay (fade effect) - simple overlay approach with factor to match WebGPU speed
        if (decay > 0.00001) {
          // Multiply decay by factor to match WebGPU behavior (WebGPU now uses 0.5x, so CPU uses 2.0x)
          const adjustedDecay = Math.min(1.0, (decay * 1.5) / 100);
          context.save();
          context.globalCompositeOperation = "source-over";
          context.fillStyle = `rgba(${clearColor.r * 255}, ${
            clearColor.g * 255
          }, ${clearColor.b * 255}, ${adjustedDecay})`;
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.restore();
        }

        // Apply blur effect if diffuse > 0
        if (diffuse > 0) {
          // Use canvas filter for blur - more performant than manual pixel manipulation
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d")!;
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;

          // Copy current canvas to temp canvas
          tempCtx.drawImage(canvas, 0, 0);

          // Apply blur filter and draw back
          context.filter = `blur(${diffuse * 0.5}px)`;
          context.drawImage(tempCanvas, 0, 0);
          context.filter = "none";
        }
      },
    };
  }
}
