### Issue 5: Convert particle renderer to a Render (role) ComputeModule

Objective

- Wrap existing `render.ts` (particle drawing to screen) into a render-role `ComputeModule` so it can run at the end of the render graph.

What to build

1. New module `ParticleRenderer`
   - `descriptor(): { role: "render"; passes: [{ kind: "fullscreen", code: renderShaderWGSL, bindings: ["particleBuffer", "renderUniforms"], readsScene: false, writesScene: true }] }`
   - The pass draws particles into `sceneTextureOut` (not directly to canvas)
2. Wire-up
   - Users add `ParticleRenderer` last in their module array; system copies final scene to canvas
   - If no render modules at all, keep the current direct path for backwards compatibility

Files

- `packages/core/src/modules/webgpu/shaders/modules/particle-renderer.ts` (new)
- `packages/core/src/modules/webgpu/shaders/render.ts` (reuse WGSL code)
- `packages/core/src/modules/webgpu/WebGPUParticleSystem.ts` (select render graph path when render modules exist)

Acceptance Criteria

- With `ParticleRenderer` present, particles render after trails/effects.
- With no render modules, behavior matches current visuals.

Non-goals

- Trails conversion.
