### Issue 6: Convert Trails to a Render (role) ComputeModule

Objective

- Port current trails decay/blur steps into a render-role module with two compute passes and remove trails-specific hardcoding.

What to build

1. Update `trails.ts`
   - `descriptor()` returns `role: "render"` with two passes:
     - Decay: readsScene=true, writesScene=true (perform decay)
     - Blur: readsScene=true, writesScene=true (variable-radius Gaussian blur)
   - Uniforms `trailDecay`, `trailDiffuse` supplied via `attachUniformWriter`
2. Remove trails hardcoding
   - In `WebGPUParticleSystem.ts`, delete the trails-specific branches. The render graph will execute the module passes instead.
3. Sensors integration
   - No changes; sensors already sample `scene_texture`. Ensure binding names remain stable.

Details

- Pass bindings and resources:
  - Both passes will bind:
    - `sceneTexture` (read) → provided by the render graph as a sampled texture view of the current read texture
    - `sceneTextureOut` (write) → provided by the render graph as the target write texture (either color attachment for fullscreen or storage texture for compute)
  - Decay pass WGSL should mirror current logic that attenuates the scene texture per pixel according to `trailDecay`.
  - Blur pass WGSL should mirror current variable-radius Gaussian blur controlled by `trailDiffuse`.
- Uniforms:
  - `trailDecay` and `trailDiffuse` should be exposed in the module and written via `attachUniformWriter`, reusing the same names so existing UI wiring remains valid.
- Execution order:
  - Decay first, blur second. The render graph will flip ping-pong after each write, so the next pass sees the newly produced scene.

Files

- `packages/core/src/modules/webgpu/shaders/modules/trails.ts`
- `packages/core/src/modules/webgpu/WebGPUParticleSystem.ts`

Acceptance Criteria

- Visual parity with current trails behavior for decay and blur.
- Trails disabled: sensors still function by sampling live scene path.

Non-goals

- New effects or additional passes. This is strictly a port of existing behavior.
