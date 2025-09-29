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
} from "../../module";

type ParticleInputs = Record<string, never>;

export class Particle extends Module<"particles", ParticleInputs> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {} as const;

  // No inputs

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
  
  var finalColor = color.rgb;
  // Pinned particles render in red (vertex passes pinned flag)
  if (pinned == 1u) {
    finalColor = vec3<f32>(0.3, 0.3, 0.37);
  }
  
  return vec4<f32>(finalColor, color.a * alpha);
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
        const color =
          particle.mass < 0
            ? { r: 0.3, g: 0.3, b: 0.37, a: particle.color.a }
            : particle.color;
        utils.drawCircle(screenX, screenY, screenSize, color);
      },
    };
  }
}
