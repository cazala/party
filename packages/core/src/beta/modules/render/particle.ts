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

export enum ParticleColorType {
  Default = 0,
  Custom = 1,
  Hue = 2,
}

type ParticleInputs = {
  colorType: number; // ParticleColorType enum value
  customColor: number[]; // [r,g,b,a] 0..1
  hue: number; // 0..1
};

export class Particle extends Module<"particles", ParticleInputs> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    colorType: DataType.NUMBER,
    customColor: DataType.ARRAY,
    hue: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    colorType?: ParticleColorType;
    customColor?: { r: number; g: number; b: number; a: number };
    hue?: number;
  }) {
    super();
    this.write({
      colorType: opts?.colorType ?? ParticleColorType.Default,
      customColor: opts?.customColor
        ? [
            opts.customColor.r,
            opts.customColor.g,
            opts.customColor.b,
            opts.customColor.a,
          ]
        : [1, 1, 1, 1],
      hue: Math.min(1, Math.max(0, opts?.hue ?? 0)),
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  setColorType(type: ParticleColorType): void {
    this.write({ colorType: type });
  }

  setCustomColor(color: { r: number; g: number; b: number; a: number }): void {
    this.write({ customColor: [color.r, color.g, color.b, color.a] });
  }

  setHue(hue: number): void {
    const clamped = Math.min(1, Math.max(0, hue));
    this.write({ hue: clamped });
  }

  webgpu(): WebGPUDescriptor<ParticleInputs> {
    return {
      // Single fullscreen pass that draws particles into the scene texture
      passes: [
        {
          kind: RenderPassKind.Fullscreen,
          fragment: ({ getUniform }) => `{
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  
  // Fetch uniforms
  let colorType = ${getUniform("colorType")};
  let custom = vec4<f32>(
    ${getUniform("customColor", 0)},
    ${getUniform("customColor", 1)},
    ${getUniform("customColor", 2)},
    ${getUniform("customColor", 3)}
  );
  let hue = ${getUniform("hue")};
  var baseColor = color;
  if (colorType == 1.0) {
    baseColor = custom; // Custom RGBA
  } else if (colorType == 2.0) {
    // Inline hue->RGB conversion at full saturation/value
    let h = fract(hue) * 6.0;
    let i = floor(h);
    let f = h - i;
    let q = 1.0 - f;
    var rgb = vec3<f32>(1.0, 0.0, 0.0);
    if (i < 1.0) {
      rgb = vec3<f32>(1.0, f, 0.0);
    } else if (i < 2.0) {
      rgb = vec3<f32>(q, 1.0, 0.0);
    } else if (i < 3.0) {
      rgb = vec3<f32>(0.0, 1.0, f);
    } else if (i < 4.0) {
      rgb = vec3<f32>(0.0, q, 1.0);
    } else if (i < 5.0) {
      rgb = vec3<f32>(f, 0.0, 1.0);
    } else {
      rgb = vec3<f32>(1.0, 0.0, q);
    }
    baseColor = vec4<f32>(rgb, 1.0);
  }

  var finalColor = baseColor.rgb;
  var finalAlpha = baseColor.a;
  
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
          bindings: ["colorType", "customColor", "hue"] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<ParticleInputs> {
    return {
      composition: CanvasComposition.RequiresClear,
      render: ({
        particle,
        screenX,
        screenY,
        screenSize,
        utils,
        context,
        input,
      }) => {
        // Determine render color based on input colorType
        const type = typeof input.colorType === "number" ? input.colorType : 0;
        let rgba = particle.color;
        if (type === 1) {
          const arr = Array.isArray(input.customColor)
            ? (input.customColor as number[])
            : [1, 1, 1, 1];
          rgba = {
            r: arr[0] ?? 1,
            g: arr[1] ?? 1,
            b: arr[2] ?? 1,
            a: arr[3] ?? 1,
          };
        } else if (type === 2) {
          const h = Math.min(
            1,
            Math.max(0, typeof input.hue === "number" ? input.hue : 0)
          );
          // Convert hue to RGB (HSV with S=1, V=1)
          const h6 = h * 6;
          const i = Math.floor(h6);
          const f = h6 - i;
          const q = 1 - f;
          switch (i % 6) {
            case 0:
              rgba = { r: 1, g: f, b: 0, a: 1 };
              break;
            case 1:
              rgba = { r: q, g: 1, b: 0, a: 1 };
              break;
            case 2:
              rgba = { r: 0, g: 1, b: f, a: 1 };
              break;
            case 3:
              rgba = { r: 0, g: q, b: 1, a: 1 };
              break;
            case 4:
              rgba = { r: f, g: 0, b: 1, a: 1 };
              break;
            default:
              rgba = { r: 1, g: 0, b: q, a: 1 };
          }
        }
        if (particle.mass < 0) {
          // Draw hollow circle for pinned particles
          const color = rgba;
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
          utils.drawCircle(screenX, screenY, screenSize, rgba);
        }
      },
    };
  }
}
