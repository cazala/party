/**
 * Particle (Render Module)
 *
 * Single fullscreen pass that instanced-draws particle quads into the scene.
 * Fragment shader renders a soft-disc using the particle color and alpha falloff.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  RenderPassKind,
  CPUDescriptor,
} from "../../module";

type ParticleRendererKeys = "particleBuffer" | "renderUniforms";

export class Particle extends Module<"particles", ParticleRendererKeys> {
  webgpu(): WebGPUDescriptor<"particles", ParticleRendererKeys> {
    return {
      name: "particles" as const,
      role: ModuleRole.Render,
      // Single fullscreen pass that draws particles into the scene texture
      passes: [
        {
          kind: RenderPassKind.Fullscreen,
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

  cpu(): CPUDescriptor<"particles", ParticleRendererKeys> {
    throw new Error("Not implemented");
  }
}
