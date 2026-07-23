# Creative workflow

Use this process when a request describes a mood or effect instead of specific Party modules.

## 1. Write a visual sentence

Translate the request into a concrete sentence containing:

- silhouette: ring, cloud, grid, text, image, stream, blob;
- motion: orbit, fall, flock, spread, follow trails, flow;
- surface: crisp particles, glowing trails, connected lines, liquid mass;
- interaction: none, pointer attract, pointer repel, drag;
- mood: palette, speed, density, persistence.

Example: “A sparse cyan cloud leaves branching filaments while slowly avoiding the pointer.”

## 2. Choose spawn geometry first

Initial conditions strongly determine the result.

- `random` + random velocity creates an even field for sensors and flocking.
- `donut` + clockwise velocity creates orbital motion immediately.
- `grid` + zero velocity gives fluids and constraints an orderly starting state.
- `text` or `image` + zero velocity preserves a readable silhouette.
- `text` or `image` + outward velocity creates an immediate dissolve.
- `circle` or `square` works well for rings, cages, and joint structures.

Keep the spawn center near the camera, normally `{ x: 0, y: 0 }`.

## 3. Select a primary motion system

Prefer one dominant system, occasionally two:

- Ballistics: `Environment`, `Boundary`, optional `Collisions`.
- Orbital field: tangential velocity plus inward `Environment`.
- Flocking: `Behavior`; begin with wander, alignment, and separation.
- Trail following: `Sensors` plus `Trails`. Sensors need rendered history to follow.
- Fluid: one `Fluids` method plus a boundary and optionally gravity.
- Structure: `Joints`; use `Lines` to expose the structure visually.

If motion explodes, reduce force strength or spawn speed before adding damping. If it collapses into a static clump, increase separation, reduce cohesion, or introduce wander.

## 4. Add visual treatment

- Use `ParticlesColorType.Hue` when a single animated hue fits the concept.
- Use `ParticlesColorType.Default` to preserve colors from an image or palette Spawner.
- Use `ParticlesColorType.Custom` for a single designed color.
- Add `Trails` when direction and history matter. Higher decay removes history faster; diffusion softens it.
- Add `Lines` only when topology matters. Dense all-to-all lines obscure the particles.
- Design the clear color and particle colors together; contrast is part of the simulation.

## 5. Add restrained animation

Oscillate one to three parameters with low frequencies, usually `0.005–0.05 Hz` for ambient evolution.

Good candidates:

- `particles.hue` for color drift;
- `sensors.sensorDistance` or `sensorAngle` for changing trail topology;
- `behavior.cohesion`, `alignment`, or `separation` for breathing swarms;
- `boundary.repelStrength` for a pulsing container.

Avoid oscillating fluid stability parameters until the base fluid is stable.

## 6. Budget performance intentionally

- Begin around 2,000–5,000 particles when CPU fallback matters.
- Increase to tens of thousands only after testing WebGPU and accepting a weaker CPU experience.
- Keep `cellSize` close to the largest active neighborhood radius.
- Lower `maxNeighbors` until the scene changes visibly, then restore some margin.
- Sensors and trails add render work; fluids, collisions, and behavior add neighborhood work.
- Never use `getParticles()` per frame or during pointer movement.

## 7. Iterate visually

Inspect at least three states:

1. Startup: particles should be visible and composed inside the view.
2. Early motion: the main gesture should be legible within a few seconds.
3. Settled motion: the scene should not collapse, escape, saturate the canvas, or become static unintentionally.

Change one layer at a time: spawn, force, render, then animation. Record parameter combinations that produce a distinct effect as a reusable scene factory.

## 8. Add interaction safely

Convert pointer positions into world coordinates. Keep a reference to `Interaction` and update its uniforms directly. Do not query all particles to implement an attractor.

Activate on pointer press for a deliberate tool, or keep it active during pointer movement for an ambient field. Always handle pointer leave/up so forces do not remain stuck on.
