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
  CanvasComposition,
  DataType,
} from "../../module";

type ParticleInputs = {};

export class Particle extends Module<"particles", ParticleInputs> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {} as const;

  webgpu(): WebGPUDescriptor<ParticleInputs> {
    return {
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
          bindings: [] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<ParticleInputs> {
    return {
      composition: CanvasComposition.RequiresClear,
      render: ({ particle, screenX, screenY, screenSize, utils }) => {
        // Just render a circle - engine handles all coordinate transformations and culling
        utils.drawCircle(screenX, screenY, screenSize, particle.color);
      },
    };
  }
}
