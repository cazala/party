/**
 * Particles (Render Module)
 *
 * Single fullscreen pass that instanced-draws particle quads into the scene.
 * Fragment shader renders a soft-disc using the particle color and alpha falloff.
 */
import {
  Module,
  type WebGPUDescriptor,
  type WebGL2Descriptor,
  ModuleRole,
  RenderPassKind,
  CPUDescriptor,
  CanvasComposition,
  DataType,
} from "../../module";

export enum ParticlesColorType {
  Default = 0,
  Custom = 1,
  Hue = 2,
}

type ParticlesInputs = {
  colorType: number; // ParticleColorType enum value
  customColorR: number; // 0..1
  customColorG: number; // 0..1
  customColorB: number; // 0..1
  hue: number; // 0..1
};

export class Particles extends Module<"particles", ParticlesInputs> {
  readonly name = "particles" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    colorType: DataType.NUMBER,
    customColorR: DataType.NUMBER,
    customColorG: DataType.NUMBER,
    customColorB: DataType.NUMBER,
    hue: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    colorType?: ParticlesColorType;
    customColor?: { r: number; g: number; b: number; a: number };
    hue?: number;
  }) {
    super();
    this.write({
      colorType: opts?.colorType ?? ParticlesColorType.Default,
      customColorR: opts?.customColor?.r ?? 1,
      customColorG: opts?.customColor?.g ?? 1,
      customColorB: opts?.customColor?.b ?? 1,
      hue: Math.min(1, Math.max(0, opts?.hue ?? 0)),
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  setColorType(type: ParticlesColorType): void {
    this.write({ colorType: type });
  }

  setCustomColor(color: { r: number; g: number; b: number; a: number }): void {
    this.write({
      customColorR: color.r,
      customColorG: color.g,
      customColorB: color.b,
    });
  }

  setHue(hue: number): void {
    const clamped = Math.min(1, Math.max(0, hue));
    this.write({ hue: clamped });
  }

  webgpu(): WebGPUDescriptor<ParticlesInputs> {
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
  let custom = vec3<f32>(
    ${getUniform("customColorR")},
    ${getUniform("customColorG")},
    ${getUniform("customColorB")}
  );
  let hue = ${getUniform("hue")};
  var baseColor = color;
  if (colorType == 1.0) {
    baseColor = vec4<f32>(custom, 1.0); // Custom RGB with alpha 1
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
          bindings: [
            "colorType",
            "customColorR",
            "customColorG",
            "customColorB",
            "hue",
          ] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<ParticlesInputs> {
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
          const r = (input as any).customColorR as number;
          const g = (input as any).customColorG as number;
          const b = (input as any).customColorB as number;
          rgba = { r: r ?? 1, g: g ?? 1, b: b ?? 1, a: 1 };
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

  webgl2(): WebGL2Descriptor<ParticlesInputs> {
    // WebGL2 uses the same descriptor structure as WebGPU
    // The descriptor returns GLSL fragment code that will be converted appropriately
    return {
      passes: [
        {
          kind: RenderPassKind.Fullscreen,
          fragment: ({ getUniform }) => `{
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);

  // Fetch uniforms
  let colorType = ${getUniform("colorType")};
  let custom = vec3<f32>(
    ${getUniform("customColorR")},
    ${getUniform("customColorG")},
    ${getUniform("customColorB")}
  );
  let hue = ${getUniform("hue")};
  var baseColor = color;
  if (colorType == 1.0) {
    baseColor = vec4<f32>(custom, 1.0); // Custom RGB with alpha 1
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
          bindings: [
            "colorType",
            "customColorR",
            "customColorG",
            "customColorB",
            "hue",
          ] as const,
          readsScene: false,
          writesScene: true,
        },
      ],
    };
  }
}
