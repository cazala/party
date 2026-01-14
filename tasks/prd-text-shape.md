# PRD: Text Shape Spawner

## Summary
Add a new "text" shape for particle spawning. Users can enter text that spawns particles shaped like the text. The playground UI exposes text, size, and font selection when "text" is selected.

## Goals
- Allow text-based particle initialization in core spawner.
- Provide a simple UI in the playground to configure text, size, and font.
- Center text at (0, 0) with centered alignment in the playground Init UI (no position/alignment fields).
- Document the feature in core and playground docs and READMEs.

## Non-Goals
- Advanced typography features (kerning controls, multi-line layout, per-character styling).
- Runtime text editing tools beyond the Init UI.
- Arbitrary custom font file uploads.

## User Stories
- As a user, I can choose "text" as the shape and type a word to spawn particles forming that text.
- As a user, I can pick from a few built-in fonts and adjust size.
- As a user, I do not need to position the text in the Init UI; it spawns centered.

## Requirements
### Core (`packages/core/src/spawner.ts`)
- Add "text" as a supported shape.
- Options:
  - `text`: string
  - `font`: string (supported built-in names)
  - `size`: number
  - `position`: `{ x: number, y: number }`
  - `align`: `{ horizontal: "left" | "center" | "right", vertical: "top" | "center" | "bottom" }`
- Implement text-to-particles sampling using a canvas (offscreen or standard) and pixel sampling.
- Define a known list of supported fonts (at least 3).
- Reasonable defaults:
  - `text = "Party"`
  - `font = "sans-serif"`
  - `size = 64`
  - `position = { x: 0, y: 0 }`
  - `align = { horizontal: "center", vertical: "center" }`

### Playground UI (`packages/playground/src/components/InitControls.tsx`)
- Add "text" as an option in the shape selector.
- When shape is "text", show:
  - Text input for `text`
  - Number input for `size`
  - Dropdown for `font` (supported fonts)
- Hide position/alignment inputs for text in the Init UI.
- Ensure spawn uses centered alignment and position (0, 0).

## UX Notes
- Font list should be human-readable (e.g. "Sans Serif", "Serif", "Monospace").
- For empty text, disable spawn or show a small inline warning.

## Docs
- Update `docs/user-guide.md` and `docs/playground-user-guide.md`.
- Update root `README.md` and any package README that documents spawner shapes.

## Risks / Considerations
- Canvas text rendering differs across environments; keep it simple and rely on standard system fonts.
- Ensure WebGPU readbacks are not required; spawner is CPU-side.
- Very large text sizes may generate many particles; consider a cap or sampling step size.

## Success Criteria
- "text" appears in shape selection.
- Text spawns as expected in both CPU and WebGPU runtimes.
- Docs mention the new shape and its options.
