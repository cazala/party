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
    return {
      name: "particles",
      role: ModuleRole.Render,
      render: ({ context, input, view, particles, clearColor }) => {
        context.fillStyle = `rgba(${clearColor.r}, ${clearColor.g}, ${clearColor.b}, ${clearColor.a})`;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        for (const particle of particles) {
          // draw each particle as a circle with the particle color and size
          context.fillStyle = `rgba(${particle.color.r * 255}, ${
            particle.color.g * 255
          }, ${particle.color.b * 255}, ${particle.color.a * 255})`;
          context.beginPath();
          context.arc(
            particle.position.x,
            particle.position.y,
            particle.size,
            0,
            Math.PI * 2
          );
          context.fill();
        }
      },
    };
  }
}
