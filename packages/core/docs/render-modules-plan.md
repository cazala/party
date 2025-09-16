## Goal: Pluggable Render Modules for WebGPU

We want to support modules that manipulate the rendered scene (e.g., trails, post-processing) without hardcoding them into `WebGPUParticleSystem`. Today, `trails` is a special case implemented inside `WebGPUParticleSystem`; all other pluggable modules are "force" (compute) modules. This plan proposes a first-class "render" module type with a clean API, a lifecycle, and shared resources (scene textures, samplers, camera, zoom) managed by the system.

### Current State (Summary)

- Compute/force modules extend `ComputeModule` and plug into shader build (`compute.ts`) to produce the main compute program. The system executes their `state`, `apply`, `integrate`, `constrain`, `correct` passes.
- Trails are managed in `WebGPUParticleSystem` with dedicated pipelines/textures (ping-pong), then composed into the canvas and optionally drawn over by particles.
- Forces can already sample a `scene_texture` (ex-trail texture) during compute (sensors), but render operations that produce that texture are not modular.

### Design Objectives

1. Introduce a modular "render" pipeline alongside the existing compute pipeline.
2. Allow render modules to:
   - Read and write a scene texture (ping-pong or in-place where safe)
   - Declare their own pipelines, uniform buffers, and bind groups
   - Run in a defined order before the final canvas composite
3. Keep compute modules unchanged, but keep exposing `scene_texture` to compute (for sensors) via stable bindings.
4. Keep WebGPUParticleSystem as the coordinator (resource owner, pass scheduler), not the module implementor.

### Key Concepts

#### 1) Module Roles

Extend the descriptor role system to three roles:

- `role: "system"` — core system functionality (grid, simulation timing)
- `role: "force"` (existing) — participates in compute (`state`/`apply`/...)
- `role: "render"` — participates in render graph, manipulating scene textures

Render modules will not modify particle buffers directly. They manipulate offscreen textures that are subsequently presented or sampled.

#### 2) Unified ComputeModule with Role-Based Descriptors

Extend the existing `ComputeModule` to support all three roles instead of creating separate base classes:

```ts
export type ComputeModuleRole = "system" | "force" | "render";

export interface BaseModuleDescriptor<Name extends string> {
  name: Name;
  role: ComputeModuleRole;
  bindings: readonly string[];
}

export interface SystemModuleDescriptor<
  Name extends string,
  Keys extends string
> extends BaseModuleDescriptor<Name> {
  role: "system";
  // System modules contribute to core compute shader functionality
  global?: () => string; // WGSL global functions/constants
  apply?: (context: ComputeContext<Keys>) => string; // WGSL integration code
}

export interface ForceModuleDescriptor<Name extends string, Keys extends string>
  extends BaseModuleDescriptor<Name> {
  role: "force";
  // Force modules participate in physics simulation
  global?: () => string;
  state?: (context: ComputeContext<Keys>) => string;
  apply?: (context: ComputeContext<Keys>) => string;
  constrain?: (context: ComputeContext<Keys>) => string;
  correct?: (context: ComputeContext<Keys>) => string;
}

export interface RenderModuleDescriptor<
  Name extends string,
  Keys extends string
> extends BaseModuleDescriptor<Name> {
  role: "render";
  // Ordered passes this module contributes
  passes: Array<{
    // WGSL code for the pass (vertex+fragment for fullscreen quad or compute for image ops)
    kind: "fullscreen" | "compute";
    code: string; // WGSL
    // For fullscreen passes
    vsEntry?: string; // default: vs_main
    fsEntry?: string; // default: fs_main
    // For compute passes
    csEntry?: string; // default: cs_main
    // Declared bindings for this pass (uniform buffers, sampled textures, storage textures)
    bindings: readonly Keys[];
    // Whether this pass reads and/or writes the scene texture
    readsScene?: boolean; // default true
    writesScene?: boolean; // default false
  }>;
}

export type ComputeModuleDescriptor<Name extends string, Keys extends string> =
  | SystemModuleDescriptor<Name, Keys>
  | ForceModuleDescriptor<Name, Keys>
  | RenderModuleDescriptor<Name, Keys>;
```

Notes:

- Single `ComputeModule` base class handles all module types through role-based descriptors.
- System modules replace the hardcoded grid/simulation logic.
- Force modules remain unchanged.
- Render modules define passes for scene texture manipulation.

#### 3) Shared Render Resources

`WebGPUParticleSystem` will construct and pass a `RenderResources` object to its internal pass runner. Modules do not receive this directly (to avoid strong coupling), but the system uses it to create pipelines and bind groups declared by the module descriptor.

`RenderResources` includes:

- `device`, `context`
- `canvasSize` (width, height)
- `camera`, `zoom`
- `sceneTextureA`, `sceneTextureB` (RGBA8Unorm)
- `currentSceneTexture` tag ("A" or "B")
- `sceneSampler`
- Particle storage buffer (read-only) and render uniform buffer (for the built-in particle renderer)

#### 4) Scene Texture Ping-Pong Contract

- The system owns two scene textures (A, B) and a sampler.
- A render pass that writes to the scene must declare `writesScene: true`. The system will:
  - Bind the current "read" texture as needed
  - Set the "write" texture as the pass render target or storage target
  - Flip the `currentSceneTexture` after the pass
- Read-only passes (`readsScene` only) will see the current read texture.

#### 5) Render Graph Scheduling

At each frame:

1. Update compute (forces) as today
2. Execute render graph:
   - Initialize scene textures to a known state (e.g., clear)
   - For each enabled render module (in registration order):
     - For each pass in the module (in declaration order):
       - Create/reuse pipeline (cache by module+pass signature)
       - Build bind groups for this pass (module uniforms + shared textures/samplers)
       - Dispatch the pass (fullscreen draw or compute dispatch)
   - Compose to canvas (copy scene to canvas)
   - Optionally draw particles over canvas (configurable order: particles-before or particles-after render graph). Default: copy scene to canvas, then draw particles.
3. If no render modules enabled:
   - Skip render graph and draw particles directly to canvas (current behavior)

#### 6) Built-in Particle Renderer as a RenderModule

The current hardcoded particle renderer (render.ts) should also be implemented as a built-in RenderModule. This would:

- Render particles into the scene texture (or directly to canvas when no other render modules are active)
- Be automatically included as the first render module by the system
- Handle the existing particle rendering logic in a modular way

This makes the render pipeline fully modular: particles → trails → other effects → canvas.

#### 7) Trails as a Render Module Example

`trails` becomes declarable purely as a render module:

- Pass 1: decay (compute, readsScene+writesScene)
- Pass 2: blur (compute, readsScene+writesScene)

The particle renderer (now also a render module) handles drawing particles into the scene texture.

#### 8) Binding Model for Render Modules

Render passes declare their `bindings: readonly Keys[]`. The system resolves them to actual GPU resources by a simple convention-based binder. Example for Trails-like module:

```ts
bindings: [
  "trailDecay", // uniform buffer field written via attachUniformWriter
  "trailDiffuse", // uniform buffer field written via attachUniformWriter
  "sceneTexture", // provided by system as sampled texture (read)
  "sceneTextureOut", // provided by system as color attachment or storage texture (write)
  "sceneSampler", // provided by system
];
```

The system owns the mapping from logical names to actual GPU resources. Only a small set of shared names are reserved: `sceneTexture`, `sceneTextureOut`, `sceneSampler`, `particleBuffer`, `renderUniforms`, `canvasTexture`.

#### 9) Module Ordering and Composition

- Render modules execute in registration order (order they were added to the system)
- Within each module, passes execute in declaration order
- This provides deterministic, predictable behavior without additional complexity

#### 10) Backward Compatibility and Migration

- Keep existing force modules unchanged in their descriptor format.
- Continue exposing `scene_texture` to compute as today through `compute.ts` extras.
- Convert the current hardcoded particle renderer (`render.ts`) into a `ParticleRenderer` render module that users add manually at the end of their module list.
- Extract grid logic from `compute.ts` into a `Grid` system module.
- Convert `simulation.ts` to use the new system module descriptor format.
- Implement `Trails` as a render module (decay + blur).
- Existing API surface for top-level users stays the same: they instantiate modules and add to the system. The system discovers module roles and schedules them appropriately.

### System Initialization Example (System Modules Auto-Injected)

System modules (`simulation`, `grid`) are automatically added by `WebGPUParticleSystem` and do not need to be provided by the user. Users only pass force and render modules, in the desired order.

```ts
// Force modules (physics)
const environment = new Environment({ gravityStrength: 1000 });
const boundary = new Boundary({ mode: "bounce" });
const fluid = new Fluid({ enabled: true });

// Render modules (scene effects)
const trails = new Trails({ enabled: true, trailDecay: 0.02 });
const particles = new ParticleRenderer(); // renders particles into scene (add last)

const modules = [
  // Force modules
  environment,
  boundary,
  fluid,
  // Render modules (trails before particles so particles render on top)
  trails,
  particles,
];

// The system will internally prepend required system modules (simulation, grid)
const system = new WebGPUParticleSystem(renderer, modules);
```

### Unified ComputeModule API

```ts
// Extended ComputeModule supports all roles
export abstract class ComputeModule<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = string
> {
  abstract descriptor():
    | SystemModuleDescriptor<Name, Keys>
    | ForceModuleDescriptor<Name, Keys, StateKeys>
    | RenderModuleDescriptor<Name, Keys>;

  attachUniformWriter(writer: (values: Partial<Record<Keys, number>>) => void): void {}
  setEnabled(enabled: boolean): void {}
  isEnabled(): boolean { return true; }
}

// In WebGPUParticleSystem
private runRenderGraph(commandEncoder: GPUCommandEncoder) {
  // 1) ensure scene textures exist / sized
  // 2) for each enabled render module (registration order):
  //    - for each pass (declaration order): create/reuse pipeline, bind groups, dispatch
  // 3) copy final scene to canvas
}
```

### Grid as a System Module (New)

Extract grid logic from `compute.ts` into:

```ts
class Grid extends ComputeModule<"grid", "gridCells" | "gridMinX" | "gridMaxX" | "gridMinY" | "gridMaxY"> {
  descriptor(): SystemModuleDescriptor<"grid", ...> {
    return {
      name: "grid",
      role: "system",
      bindings: ["gridCells", "gridMinX", "gridMaxX", "gridMinY", "gridMaxY"],
      global: () => `
        // GRID_* functions and neighbor iteration
        fn GRID_MINX() -> f32 { return grid_uniforms.minX; }
        // ... other grid functions
      `,
      apply: () => `
        // grid_build and grid_clear logic
      `,
    };
  }
}
```

### Trails as a Render Module (Example)

```ts
class Trails extends ComputeModule<"trails", "trailDecay" | "trailDiffuse"> {
  descriptor(): RenderModuleDescriptor<"trails", ...> {
    return {
      name: "trails",
      role: "render",
      passes: [
        {
          kind: "compute",
          code: wgslDecay,
          bindings: ["trailDecay", "sceneTexture", "sceneTextureOut"],
          readsScene: true,
          writesScene: true,
        },
        {
          kind: "compute",
          code: wgslBlur,
          bindings: ["trailDiffuse", "sceneTexture", "sceneTextureOut"],
          readsScene: true,
          writesScene: true,
        },
      ],
    };
  }
}
```

### Particle Renderer as a Render Module

```ts
class ParticleRenderer extends ComputeModule<"particles", "particleBuffer" | "renderUniforms"> {
  descriptor(): RenderModuleDescriptor<"particles", ...> {
    return {
      name: "particles",
      role: "render",
      passes: [{
        kind: "fullscreen",
        code: renderShaderWGSL, // existing render.ts content
        bindings: ["particleBuffer", "renderUniforms"],
        readsScene: false,
        writesScene: true, // draws particles into scene
      }],
    };
  }
}
```

### Performance Considerations

- Pipeline caching: cache by module name + pass index + shader hashes.
- Bind group reuse: rebuild only when resources or uniform buffers change.
- Texture reuse: reuse scene textures; resize only when canvas size changes.

### Validation and Testing

1. Extract grid logic from `compute.ts` into a `Grid` system module.
2. Convert `simulation.ts` to use the new system module descriptor format.
3. Convert existing particle renderer to a `ParticleRenderer` render module.
4. Port existing `trails` decay/blur into a render module and verify output matches current behavior.
5. Verify sensors sampling of `scene_texture` continues to work with the new scene graph.
6. Add a toy post-process (e.g., color tint) as a separate render module to validate multiple modules and ordering.

### Rollout Plan

1. Extend `ComputeModule` and `ComputeModuleDescriptor` to support system/force/render roles.
2. Extract grid logic into a `Grid` system module.
3. Update `simulation.ts` to use system module descriptor.
4. Implement render graph runner in `WebGPUParticleSystem`.
5. Convert particle renderer to `ParticleRenderer` render module.
6. Migrate `trails` implementation to a render module.
7. Update system initialization to use the new module ordering (system → force → render).
8. Document the module authoring guide.

This architecture lets us implement render-time effects (trails, blur, bloom, color grading, overlays) as independent modules, without editing the core system for each effect.
