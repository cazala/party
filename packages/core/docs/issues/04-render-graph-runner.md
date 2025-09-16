### Issue 4: Implement Render Graph runner and shared scene textures

Objective

- Introduce a render graph in `WebGPUParticleSystem` to execute render-role modules in order and manage a shared scene texture (ping-pong) and sampler.

What to build

1. Scene resources
   - Two RGBA8Unorm textures sized to canvas: `sceneTextureA`, `sceneTextureB`
   - A clamp-to-edge linear sampler: `sceneSampler`
   - An enum/tag `currentSceneTexture: "A" | "B"`
2. Runner method: `runRenderGraph(commandEncoder)`
   - Resize textures if canvas size changed
   - For each enabled render module (registration order), for each pass (declaration order):
     - Create/reuse the appropriate pipeline (fullscreen render or compute)
     - Build bind groups: module uniforms + shared bindings:
       - `sceneTexture` (sampled read)
       - `sceneTextureOut` (color attachment or storage write target)
       - `sceneSampler`
     - Dispatch/draw the pass
     - If the pass writes the scene, flip A↔B
   - Copy the final read scene texture to the canvas using the existing `copy.ts` pipeline

Integration points

- Update frame loop to call `runRenderGraph` when render modules are present; otherwise, skip and use current direct draw path.

Files

- `packages/core/src/modules/webgpu/WebGPUParticleSystem.ts`
- `packages/core/src/modules/webgpu/shaders/copy.ts` (reused)

Acceptance Criteria

- With no render modules, existing behavior is unchanged.
- With render modules but no writers, final canvas is cleared without errors.

Non-goals

- Converting trails/particle renderer to modules.
