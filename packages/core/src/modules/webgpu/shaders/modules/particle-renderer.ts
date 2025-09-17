import { Module, type ModuleDescriptor } from "../compute";

type ParticleRendererKeys = "particleBuffer" | "renderUniforms";

export class ParticleRenderer extends Module<
  "particles",
  ParticleRendererKeys
> {
  descriptor(): ModuleDescriptor<"particles", ParticleRendererKeys> {
    return {
      name: "particles" as const,
      role: "render" as const,
      // Single fullscreen pass that draws particles into the scene texture
      passes: [
        {
          kind: "fullscreen" as const,
          fragment: () => `{
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let alpha = 1.0 - smoothstep(0.45, 0.5, dist);
  return vec4<f32>(color.rgb, color.a * alpha);
}`,
          bindings: ["particleBuffer", "renderUniforms"] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }
}
