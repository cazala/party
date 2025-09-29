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

type ParticleInputs = {
  redParticleIndexes: number[];
};

export class Particle extends Module<"particles", ParticleInputs> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    redParticleIndexes: DataType.ARRAY,
  } as const;

  getRedParticleIndexes(): number[] {
    return this.readArray("redParticleIndexes");
  }

  setRedParticleIndexes(indexes: number[]): void {
    this.write({ redParticleIndexes: indexes });
  }

  webgpu(): WebGPUDescriptor<ParticleInputs> {
    return {
      // Single fullscreen pass that draws particles into the scene texture
      passes: [
        {
          kind: RenderPassKind.Fullscreen,
          fragment: ({ getUniform, getLength }) => `{
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let alpha = 1.0 - smoothstep(0.45, 0.5, dist);
  
  // Check if this particle should be red
  let redCount = ${getLength("redParticleIndexes")};
  var isRed = false;
  for (var i = 0u; i < redCount; i++) {
    let redIndex = u32(${getUniform("redParticleIndexes", "i")});
    if (index == redIndex) {
      isRed = true;
      break;
    }
  }
  
  var finalColor = color.rgb;
  if (isRed) {
    finalColor = vec3<f32>(1.0, 0.0, 0.0); // Override with red color
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
        // Just render a circle - engine handles all coordinate transformations and culling
        utils.drawCircle(screenX, screenY, screenSize, particle.color);
      },
    };
  }
}
