### Issue 8: Docs and Examples for Render Modules

Objective

- Provide self-contained documentation and a minimal working example so contributors can author `system`, `force`, and `render` modules without prior context.

What to write

1. Update plan doc
   - `packages/core/docs/render-modules-plan.md`: ensure final API names, binding conventions (`sceneTexture`, `sceneTextureOut`, `sceneSampler`, etc.), and ordering rules (system → force → render; registration order; pass order) are explicit and consistent.
2. Authoring guide example
   - New `packages/core/docs/examples/color-tint.md` containing:
     - A minimal WGSL fullscreen pass that multiplies the scene color by `(1.0 - tint) + tint * vec3(1.0, 0.8, 0.8)`
     - Descriptor snippet with `role: "render"`, single pass `{ kind: "fullscreen", code, bindings: ["sceneTexture", "sceneTextureOut", "sceneSampler", "tintStrength"], readsScene: true, writesScene: true }`
     - A minimal module class that exposes `tintStrength` via `attachUniformWriter`
     - Wiring instructions: add after force modules and before `ParticleRenderer`
3. README entry
   - Add a subsection “Extending the Render Pipeline” with links to the plan and example

Files

- `packages/core/docs/render-modules-plan.md`
- `packages/core/docs/examples/color-tint.md` (new)

Acceptance Criteria

- A contributor can copy/paste the example module and integrate it, seeing a visible tint effect.
- All role/binding/order rules are documented in one place.

Non-goals

- Shipping the example in the default module list.
