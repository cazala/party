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
  
  var finalColor = color.rgb;
  var finalAlpha = color.a;
  
  // Pinned particles render as hollow circles (donut shape)
  if (mass < 0.0) {
    // Create hollow ring effect
    let innerRadius = 0.30;
    let outerRadius = 0.45;
    let edgeSmooth = 0.05;
    
    // Calculate ring alpha based on distance
    var ringAlpha = 1.0 - smoothstep(outerRadius - edgeSmooth, outerRadius + edgeSmooth, dist);
    ringAlpha = ringAlpha * smoothstep(innerRadius - edgeSmooth, innerRadius + edgeSmooth, dist);
    
    finalAlpha = finalAlpha * ringAlpha;
  } else {
    // Normal solid particle
    finalAlpha = finalAlpha * (1.0 - smoothstep(0.45, 0.5, dist));
  }
  
  return vec4<f32>(finalColor, finalAlpha);
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
      render: ({ particle, screenX, screenY, screenSize, utils, context }) => {
        if (particle.mass < 0) {
          // Draw hollow circle for pinned particles
          const color = particle.color;
          const lineWidth = Math.max(2, screenSize * 0.15); // Ring width scales with particle size

          context.strokeStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${
            color.b * 255
          }, ${color.a})`;
          context.lineWidth = lineWidth;
          context.beginPath();
          context.arc(
            screenX,
            screenY,
            screenSize - lineWidth / 2,
            0,
            Math.PI * 2
          );
          context.stroke();
        } else {
          // Draw solid circle for normal particles
          utils.drawCircle(screenX, screenY, screenSize, particle.color);
        }
      },
    };
  }
}
