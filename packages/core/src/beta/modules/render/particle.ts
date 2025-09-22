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

type ParticleInputKeys = "particleBuffer" | "renderUniforms";

export class Particle extends Module<"particles", ParticleInputKeys> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly keys = ["particleBuffer", "renderUniforms"] as const;

  webgpu(): WebGPUDescriptor<ParticleInputKeys> {
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
          bindings: ["particleBuffer", "renderUniforms"] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<ParticleInputKeys> {
    return {
      setup: ({ context, clearColor }) => {
        // Clear canvas for fresh particle rendering
        context.fillStyle = `rgba(${clearColor.r * 255}, ${
          clearColor.g * 255
        }, ${clearColor.b * 255}, ${clearColor.a})`;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      },
      render: ({ particle, screenX, screenY, screenSize, utils }) => {
        // Just render a circle - engine handles all coordinate transformations and culling
        utils.drawCircle(screenX, screenY, screenSize, particle.color);
      },
    };
  }
}
