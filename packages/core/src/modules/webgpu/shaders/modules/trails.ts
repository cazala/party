import { Module, type ModuleDescriptor } from "../compute";
import { ModuleRole, RenderPassKind } from "../descriptors";

type TrailBindingKeys = "trailDecay" | "trailDiffuse";

export const DEFAULT_TRAILS_TRAIL_DECAY = 0.01;
export const DEFAULT_TRAILS_TRAIL_DIFFUSE = 0.0;

export class Trails extends Module<"trails", TrailBindingKeys> {
  private trailDecay: number;
  private trailDiffuse: number;

  constructor(opts?: {
    enabled?: boolean;
    trailDecay?: number;
    trailDiffuse?: number;
  }) {
    super();
    this.trailDecay = opts?.trailDecay ?? DEFAULT_TRAILS_TRAIL_DECAY;
    this.trailDiffuse = opts?.trailDiffuse ?? DEFAULT_TRAILS_TRAIL_DIFFUSE;

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      trailDecay: this.trailDecay,
      trailDiffuse: this.trailDiffuse,
    });
  }

  setTrailDecay(value: number): void {
    this.trailDecay = value;
    this.write({ trailDecay: value });
  }

  setTrailDiffuse(value: number): void {
    this.trailDiffuse = value;
    this.write({ trailDiffuse: value });
  }

  descriptor(): ModuleDescriptor<"trails", TrailBindingKeys> {
    return {
      name: "trails" as const,
      role: ModuleRole.Render,
      // keep uniforms so UI can write values
      bindings: ["trailDecay", "trailDiffuse"] as const,
      passes: [
        {
          kind: RenderPassKind.Compute,
          kernel: ({ getUniform, readScene, writeScene }) => `{
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  let current = ${readScene("coords")};
  let d = clamp(${getUniform("trailDecay")}, 0.0, 1.0);
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
}
