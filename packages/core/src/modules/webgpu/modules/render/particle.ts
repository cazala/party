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
      render: ({
        context,
        input: _input,
        view,
        particles,
        clearColor,
      }) => {
        context.fillStyle = `rgba(${clearColor.r}, ${clearColor.g}, ${clearColor.b}, ${clearColor.a})`;
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        
        // Get camera and canvas info for coordinate transformation
        const camera = view.getCamera();
        const zoom = view.getZoom();
        const size = view.getSize();
        const centerX = size.width / 2;
        const centerY = size.height / 2;
        
        for (const particle of particles) {
          // Transform world position to screen position (matching WebGPU transform)
          // World position relative to camera, scaled by zoom
          const worldX = (particle.position.x - camera.x) * zoom;
          const worldY = (particle.position.y - camera.y) * zoom;
          
          // Convert to screen coordinates (center canvas + world offset)
          const screenX = centerX + worldX;
          const screenY = centerY + worldY;
          
          // Transform particle size by zoom
          const screenSize = particle.size * zoom;
          
          // Skip rendering if particle is outside canvas bounds (optimization)
          if (screenX + screenSize < 0 || screenX - screenSize > size.width ||
              screenY + screenSize < 0 || screenY - screenSize > size.height) {
            continue;
          }
          
          // draw each particle as a circle with the particle color and size
          context.fillStyle = `rgba(${particle.color.r * 255}, ${
            particle.color.g * 255
          }, ${particle.color.b * 255}, ${particle.color.a * 255})`;
          context.beginPath();
          context.arc(
            screenX,
            screenY,
            screenSize,
            0,
            Math.PI * 2
          );
          context.fill();
        }
      },
    };
  }
}
