# AGENTS.md (repo briefing)

This repo is a small pnpm-workspace monorepo for **Party**: a TypeScript particle simulation engine with **dual runtimes** (WebGPU + CPU) and a React playground app.

## Repo layout (what matters)

- `packages/core` (`@cazala/party`)
  - Engine + module system + CPU/WebGPU runtimes.
- `packages/playground` (`@cazala/playground`)
  - The interactive app (React + Redux Toolkit) that drives `@cazala/party`.
- `packages/worker` (`worker`)
  - Cloudflare Worker reverse-proxy for hosting under `caza.la/party`.
- `docs/`
  - User/maintainer guides (they’re the canonical narrative docs).

## Running locally (fast path)

From repo root:

- `npm run setup` — installs root deps, then workspace deps via `pnpm`.
- `npm run dev` — starts the playground dev server on **`http://localhost:3000`**.
- `npm run build` — builds core + playground.
- `npm run type-check` — builds core and type-checks playground.

## Core engine mental model (`@cazala/party`)

### Public entry points

- `packages/core/src/index.ts` re-exports the public API (`Engine`, `Module`, built-in modules, types).
- The “real” type shape for particles is in `packages/core/src/interfaces.ts`.

### Particle shape (don’t assume `x/vx` style)

`IParticle` is:

- `position: { x, y }`
- `velocity: { x, y }`
- `size: number`
- `mass: number`
- `color: { r, g, b, a }` (**0..1 floats**)

Semantics used throughout:

- **Pinned**: `mass < 0`
- **Removed**: `mass === 0`

### Engine selection + expensive operations

- `new Engine({ runtime: "auto" | "webgpu" | "cpu", ... })` is a facade in `packages/core/src/engine.ts`.
- `"auto"` attempts WebGPU first and falls back to CPU on `initialize()`.
- On WebGPU, `getParticles()` is a **full GPU→CPU readback**: avoid in hot paths.
  - Prefer `getParticlesInRadius(...)`, `setParticle(...)`, and `setParticleMass(...)`.
  - Playground tools are written around this constraint.

### Module system (how simulation/extensibility works)

Core type is `Module` in `packages/core/src/module.ts`:

- Modules declare:
  - `name` (string literal, unique)
  - `role`: `ModuleRole.Force` or `ModuleRole.Render`
  - `inputs`: map of input keys to `DataType.NUMBER` or `DataType.ARRAY`
- Modules implement both descriptors:
  - `webgpu(): WebGPUDescriptor`
  - `cpu(): CPUDescriptor`
- Enabled is tracked separately via `module.setEnabled(bool)` and gets propagated as an `enabled` uniform.

Force lifecycle phases (both runtimes support these hooks):

- `global` (WebGPU-only helper WGSL)
- `state` (pre-pass, e.g. fluids density)
- `apply` (forces/velocity changes)
- `constrain` (position corrections, iterated)
- `correct` (post-integration corrections)

Render modules contribute passes:

- WebGPU: `RenderPassKind.Fullscreen` or `RenderPassKind.Compute` (optionally `instanced`)
- CPU: Canvas2D composition via `CPURenderDescriptor`

### Where to look when debugging WebGPU behavior

- Engine orchestrator: `packages/core/src/runtimes/webgpu/engine.ts`
- Resource plumbing: `packages/core/src/runtimes/webgpu/gpu-resources.ts`
- WGSL program build: `packages/core/src/runtimes/webgpu/module-registry.ts`
- Simulation concat/dispatch: `packages/core/src/runtimes/webgpu/simulation-pipeline.ts`
- Local neighborhood query (avoids full readback): `packages/core/src/runtimes/webgpu/local-query.ts`
- Spatial grid: `packages/core/src/runtimes/webgpu/spacial-grid.ts` (typo is in filename/class)

CPU counterparts live under `packages/core/src/runtimes/cpu/`.

## Playground mental model (`@cazala/playground`)

### Architecture pattern

The pattern is “Redux slice → hook wrapper → UI”:

- Slices: `packages/playground/src/slices/**`
- Hook layer: `packages/playground/src/hooks/**`
  - Hooks encapsulate Redux and provide “actions” to components.
  - Many hooks follow a **dual-write** pattern: dispatch to Redux + immediately call engine for responsiveness.
- Components: `packages/playground/src/components/**`

### Tools system + hotkeys

- Tool orchestrator: `packages/playground/src/hooks/tools/index.ts`
- Individual tools: `packages/playground/src/hooks/tools/individual-tools/*`
- Global hotkeys are implemented in `packages/playground/src/components/GlobalHotkeys.tsx`.
  - Tool switching requires **Cmd/Ctrl + letter** (A/S/D/F/G/H/J/K/L).
  - Session “quick load 1–9” is **Cmd/Ctrl + 1–9**.

If you’re changing a tool, sanity-check you’re not introducing WebGPU readbacks (`getParticles()`) during mouse move/drag.

## Worker (`packages/worker`)

Cloudflare Worker reverse-proxies requests:

- Incoming: `/party/*` on `caza.la`
- Upstream: `vars.UPSTREAM_ORIGIN` (default `https://party.caza.la`)
- Adds response header: `x-edge-proxy: cazala-party-worker`

Config: `packages/worker/wrangler.toml`  
Implementation: `packages/worker/src/index.ts`

## Docs map

If you need deeper narrative docs, start here:

- `docs/user-guide.md` (engine API + built-in modules)
- `docs/module-author-guide.md` (writing modules)
- `docs/maintainer-guide.md` (core internals)
- `docs/playground-user-guide.md` (UI/tools/hotkeys)
- `docs/playground-maintainer-guide.md` (playground patterns)

