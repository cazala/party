### Render Modules DSL (Opinionated)

Goal: let authors write small function bodies (like force modules) instead of full WGSL blobs, while the framework wires uniforms/bindings/entrypoints/ping‑pong automatically.

### Problems with current approach

- Authors provide full WGSL via `code()`, duplicating boilerplate (structs, bindings, entrypoints).
- Per-pass uniforms are built manually via `buildUniformData`.
- Resource layout differences (fullscreen vs compute) must be remembered per pass.

### Design Overview

- Replace the current render pass API with an opinionated DSL for Render Modules, similar to Force Modules (`apply`, `state`, `constrain`).
- The framework generates complete WGSL for each pass and manages bind groups, uniform packing, and ping‑pong.
- Authors provide only small, role-specific function bodies.

### Descriptor (render)

- `role: "render"`
- `bindings: readonly Keys[]` (module uniforms, same semantics as force modules; an implicit `enabled` is auto-added)
- `passes: RenderPassDescriptor[]`

Where each pass is one of:

- Fullscreen pass: draws to the scene via a pipeline (with optional instancing over particles)
- Compute pass: processes the scene texture (decay/blur/filters)

```ts
export type RenderPassDescriptor<Keys extends string = string> =
  | {
      kind: "fullscreen";
      // Optional vertex transform hook (defaults provided)
      vertex?: (args: RenderVertexArgs<Keys>) => string;
      // Optional varyings/globals helper (advanced)
      globals?: (args: { getUniform: (id: Keys) => string }) => string;
      // Fragment hook: computes the final color; REQUIRED
      fragment: (args: RenderFragmentArgs<Keys>) => string;
      // Whether to read previous scene texture in fragment
      readsScene?: boolean; // default: false
      // Whether to write to the scene (always true for fullscreen; kept for symmetry)
      writesScene?: true;
      // Toggle automatic instancing over particles
      instanced?: boolean; // default: true
    }
  | {
      kind: "compute";
      // Kernel hook: runs per-pixel; REQUIRED
      kernel: (args: RenderComputeArgs<Keys>) => string;
      readsScene?: boolean; // default: true
      writesScene?: true; // default: true
      workgroupSize?: [number, number, number]; // default: [8,8,1]
      // Optional extra helpers
      globals?: (args: { getUniform: (id: Keys) => string }) => string;
    };
```

### Helper args (framework-provided)

- Common: `getUniform(id: Keys | Reserved)` → WGSL expression
- Reserved uniforms available in `getUniform`:
  - `"canvasWidth"`, `"canvasHeight"`
  - `"clearColorR"`, `"clearColorG"`, `"clearColorB"`
- Fullscreen args:

```ts
export interface RenderVertexArgs<Keys> {
  getUniform: (id: Keys | "canvasWidth" | "canvasHeight") => string;
  // Variables available in the emitted body:
  // in: particle (struct), instance_index, render_uniforms
  // out: must set `out.position`, may set `out.uv`, `out.color`
}

export interface RenderFragmentArgs<Keys> {
  getUniform: (
    id:
      | Keys
      | "canvasWidth"
      | "canvasHeight"
      | "clearColorR"
      | "clearColorG"
      | "clearColorB"
  ) => string;
  // Read previous scene color: sampleScene(uvExpr: string) => string WGSL expr
  sampleScene: (uvExpr: string) => string;
  // In-variables available: uv, color, frag_coord
  // Out contract: return `vec4<f32>` string
}
```

- Compute args:

```ts
export interface RenderComputeArgs<Keys> {
  getUniform: (
    id:
      | Keys
      | "canvasWidth"
      | "canvasHeight"
      | "clearColorR"
      | "clearColorG"
      | "clearColorB"
  ) => string;
  // Per-pixel helpers
  // coords: ivec2 string available in scope (e.g. `coords`)
  // texture dims: `textureDimensions(input_texture)` is available via helper expr `sceneDims`
  readScene: (coordsExpr: string) => string; // textureLoad(read, coords, 0)
  writeScene: (coordsExpr: string, colorExpr: string) => string; // textureStore(write,...)
}
```

### Generated WGSL (what the framework provides)

- Fullscreen pass:
  - Particle struct, RenderUniforms struct
  - Bindings layout: [0]=`particles(storage,read)`, [1]=`render_uniforms(uniform)`, [2]=`scene_texture(texture_2d)`, [3]=`scene_sampler(sampler)`
  - A default vertex that draws instanced quads per particle. If a `vertex()` hook is present, its body is spliced in to override/augment transform logic.
  - Fragment function scaffolding that calls `fragment()` body; provides `sampleScene()` helper when `readsScene` is true.
- Compute pass:
  - Bindings: [0]=`input_texture(texture_2d)`, [1]=`output_texture(storage_texture)`; [2]=`module uniforms (auto-packed)`
  - Workgroup declaration from `workgroupSize`
  - Kernel entrypoint with bounds check, provides helpers `readScene`, `writeScene`, `sceneDims`, `coords` and splices in `kernel()` body.

### Uniforms and packing

- Exactly like force modules: `bindings: Keys[]` drives a packed `vec4<f32>` struct per module, with `enabled` auto-added.
- No custom `buildUniformData` per pass. The framework writes the module’s uniform buffer once per frame based on the module’s state via `Module.write()` calls, same as forces.
- `getUniform()` returns the correct WGSL accessor to the packed struct (`module_uniforms.vN.xyz…`).

### Entry points and names

- Fullscreen: `vs_main` and `fs_main` (standardized). The DSL injects author code inside those.
- Compute: `cs_main` (standardized). The DSL injects author code inside.
- No manual `csEntry`/`vsEntry`/`fsEntry`; the pass kind selects the entrypoint.

### Execution and ping‑pong rules

- Pass order = descriptor order (as today).
- Compute passes:
  - Read from current scene, write to alternate, then swap (like we do now).
- Fullscreen passes:
  - Draw directly into current scene (no swap) unless author marks `writesScene:false` (rare).
- Final copy to canvas uses the last written view of the frame.

### Examples

- Trails (compute):

```ts
new Trails({
  /* ... */
}).descriptor = () => ({
  name: "trails",
  role: "render",
  bindings: ["trailDecay", "trailDiffuse"],
  passes: [
    {
      kind: "compute",
      kernel: ({ getUniform, readScene, writeScene }) => `{
  let d = clamp(${getUniform("trailDecay")}, 0.0, 1.0);
  let c = ${readScene("coords")};
  let bg = vec3<f32>(${getUniform("clearColorR")}, ${getUniform(
        "clearColorG"
      )}, ${getUniform("clearColorB")});
  let out_rgb = mix(c.rgb, bg, d);
  let out_a = c.a * (1.0 - d);
  ${writeScene("coords", "vec4<f32>(out_rgb, out_a)")};
}`,
    },
    {
      kind: "compute",
      kernel: ({ getUniform, readScene, writeScene }) => `{
  let radius = i32(round(${getUniform("trailDiffuse")}));
  if (radius <= 0) { ${writeScene(
    "coords",
    `${readScene("coords")}`
  )}; return; }
  // ... gaussian blur loop using ${readScene("coords + offset")} ...
  ${writeScene("coords", "blurred")};
}`,
    },
  ],
});
```

- ParticleRenderer (fullscreen):

```ts
new ParticleRenderer().descriptor = () => ({
  name: "particles",
  role: "render",
  bindings: [],
  passes: [
    {
      kind: "fullscreen",
      fragment: ({ sampleScene }) => `{
  // Use instanced per-particle color and radial alpha
  let center = vec2<f32>(0.5, 0.5);
  let dist = distance(uv, center);
  let alpha = 1.0 - smoothstep(0.45, 0.5, dist);
  return vec4<f32>(color.rgb, color.a * alpha);
}`,
      readsScene: false,
      writesScene: true,
      instanced: true,
    },
  ],
});
```

### Migration strategy (breaking changes allowed)

1. Replace the current `RenderModuleDescriptor.passes` schema with the new `RenderPassDescriptor` DSL (remove `code`, remove `buildUniformData`).
2. Update the shader builder to generate WGSL from `vertex`/`fragment`/`kernel` hooks; delete the legacy path.
3. Update `WebGPUParticleSystem` to consume only the new pass schema.
4. Migrate Trails and ParticleRenderer to the new DSL.
5. Remove any compatibility code and types related to the old API.

### Validation & ergonomics

- Validate that at least one of `fragment` or `kernel` is present depending on pass kind.
- Validate bindings and enforce that `enabled` is auto-added to uniform packing.
- Provide compile-time templates or helper utilities for common ops (e.g., gaussian blur weights) as opt-in imports in `globals()`.

### Future considerations

- Optional multiple inputs for compute (multi-texture sampling) via `extraInputs` declared per pass.
- Optional offscreen intermediate textures per pass (e.g., for multi-stage blurs) managed by the framework.
- Optional depth/stencil support if we add 3D or masking render modules later.
