# Troubleshooting

## Blank canvas

- Ensure the canvas has visible CSS dimensions.
- Call `await engine.initialize()` before setting particles and playing.
- Call `engine.setSize(width, height)` with non-zero values.
- Verify `Spawner.initParticles(...)` returned a non-empty array.
- Include an enabled `Particles` render module.
- Spawn near the camera, normally around `{ x: 0, y: 0 }`.
- Use contrasting particle and clear colors.
- Check the browser console for WebGPU initialization errors; `runtime: "auto"` should fall back to CPU.

## Static or weak motion

- Give particles initial velocity or enable a force with non-zero strength.
- Confirm each relevant module is enabled.
- Increase the primary force gradually; do not compensate by enabling unrelated modules.
- For Sensors, enable Trails because sensors sample rendered history.
- For Interaction, update its position and call `setActive(true)`.

## Explosive or unstable motion

- Reduce spawn speed, gravity, sensor strength, pressure, or behavior gains.
- Avoid dense overlapping initial particles for collisions and SPH.
- Increase damping modestly instead of using extreme values.
- Ensure fluid parameters match the selected method; SPH-only options do not belong to PIC/FLIP.
- Increase constraint iterations only for constraint quality, not as a universal stability fix.

## Scene disappears over time

- Check for `Boundary({ mode: "kill" })` or `mode: "none"`.
- Use `warp` for continuous fields and `bounce` for containers.
- Reduce outward force or set a wider world/camera zoom.
- Remember that `mass === 0` marks a particle removed.

## Poor performance

- Reduce particle count first.
- Avoid `getParticles()` in recurring code; it triggers full WebGPU readback.
- Bound local queries with `getParticlesInRadius(..., { maxResults })` and await them.
- Reduce `maxNeighbors`, neighborhood radius, fluid complexity, or constraint iterations.
- Avoid combining collisions, fluids, behavior, and sensors unless each contributes visibly.
- Test CPU fallback independently; a WebGPU showcase budget may be unsuitable for CPU.

## Pointer force is offset

Use the canvas bounding rectangle, then convert canvas pixels to world coordinates using the camera and zoom. Do not pass viewport `clientX/clientY` directly to a module.

## Text or image spawning returns no particles

- Run in a browser environment with Canvas2D or `OffscreenCanvas` support.
- Use non-empty text and a positive `textSize`.
- Decode images and pass `ImageData`; a URL string is not accepted by `Spawner`.
- Use a particle size small enough to sample the source silhouette.

## TypeScript rejects an option

Use exported enums such as `ParticlesColorType` and `FluidsMethod`. Check the constructor in the installed package version instead of guessing names from playground labels. PIC/FLIP intentionally rejects SPH-only options at the type level.

## Output runs but is visually uninteresting

- Restate the intended silhouette, motion, surface, and interaction.
- Replace generic random particles with a deliberate shape and velocity.
- Remove modules until the primary motion reads clearly.
- Add one visual signature: trails, a controlled palette, lines, or a slow oscillator.
- Inspect the result after several seconds; creative success requires composition and evolution, not only valid code.
