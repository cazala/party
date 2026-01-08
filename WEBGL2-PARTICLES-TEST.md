# WebGL2 Particles Render Module - Browser Test Instructions

## Test Setup

1. Start the playground dev server:
   ```bash
   cd packages/playground
   npm run dev
   ```

2. Open http://localhost:3000 in a WebGL2-capable browser

## Manual Test Cases

### Test 1: Basic Particle Rendering
- **Goal:** Verify particles render correctly with WebGL2 runtime
- **Steps:**
  1. Load playground
  2. Force WebGL2 runtime (if selector exists) or disable WebGPU in browser
  3. Spawn particles using the spawn tool
  4. Verify particles appear and animate smoothly
- **Expected:** Particles should render as soft-edged circles with correct colors

### Test 2: Color Mode - Default
- **Goal:** Verify default color mode uses particle's inherent color
- **Steps:**
  1. Ensure Particles module colorType is set to 0 (Default)
  2. Create particles with different colors
  3. Observe rendering
- **Expected:** Each particle should display its own assigned color

### Test 3: Color Mode - Custom
- **Goal:** Verify custom color mode applies uniform color to all particles
- **Steps:**
  1. Set Particles module colorType to 1 (Custom)
  2. Set customColor (e.g., red: r=1, g=0, b=0)
  3. Spawn multiple particles
- **Expected:** All particles should render in the custom color (red)

### Test 4: Color Mode - Hue
- **Goal:** Verify hue color mode applies HSV-to-RGB conversion
- **Steps:**
  1. Set Particles module colorType to 2 (Hue)
  2. Set hue value (e.g., 0.5 for cyan)
  3. Spawn particles
- **Expected:** All particles should render in the hue color (cyan)

### Test 5: Pinned Particles (Hollow Circles)
- **Goal:** Verify pinned particles render as hollow circles
- **Steps:**
  1. Create particle with negative mass (mass = -1)
  2. Observe rendering
- **Expected:** Pinned particle should appear as a hollow ring/donut shape, not solid

### Test 6: Module Enabled State
- **Goal:** Verify enabling/disabling Particles module
- **Steps:**
  1. Spawn some particles
  2. Disable Particles module (setEnabled(false))
  3. Observe canvas - should show clear background only
  4. Re-enable Particles module (setEnabled(true))
- **Expected:**
  - When disabled: canvas clears to clearColor, no particles visible
  - When enabled: particles reappear and render normally

### Test 7: Clear Color Respect
- **Goal:** Verify rendering respects engine clearColor
- **Steps:**
  1. Set engine clearColor to non-black (e.g., dark blue)
  2. Spawn particles
- **Expected:** Background should clear to the specified clearColor each frame

### Test 8: Scene Texture Ping-Pong
- **Goal:** Verify scene rendering uses texture ping-pong correctly
- **Steps:**
  1. Run simulation with many particles
  2. Check for any visual artifacts or flickering
- **Expected:** Smooth rendering with no flickering or stale frames

### Test 9: Alpha Blending
- **Goal:** Verify particles blend correctly with transparency
- **Steps:**
  1. Create particles with alpha < 1.0
  2. Overlap particles
- **Expected:** Particles should blend smoothly with proper alpha compositing

### Test 10: Performance
- **Goal:** Verify GPU rendering performs well
- **Steps:**
  1. Spawn 1000+ particles
  2. Monitor FPS
- **Expected:** Should maintain 60 FPS with GPU simulation and rendering

## Quick Console Test

For quick testing, open browser console and run:

```javascript
// Get engine instance (method depends on playground implementation)
const engine = window.__engine; // or however it's exposed

// Test color modes
const particlesModule = engine.modules.find(m => m.name === 'particles');

// Default mode
particlesModule.setColorType(0);

// Custom red mode
particlesModule.setColorType(1);
particlesModule.setCustomColor({ r: 1, g: 0, b: 0, a: 1 });

// Hue cyan mode
particlesModule.setColorType(2);
particlesModule.setHue(0.5);

// Toggle enabled
particlesModule.setEnabled(false); // Should hide particles
particlesModule.setEnabled(true);  // Should show particles

// Add pinned particle
engine.addParticle({
  x: 400, y: 300,
  vx: 0, vy: 0,
  mass: -1, // Negative = pinned
  size: 30,
  color: { r: 1, g: 1, b: 0, a: 1 }
});
```

## Success Criteria

All acceptance criteria from US-004 should pass:
- ✅ WebGL2 render pipeline supports scene texture/FBO ping-pong
- ✅ Final present to canvas works
- ✅ Particles.webgl2() renders from WebGL2 particle store (no CPU draw loop)
- ✅ Rendering respects clearColor
- ✅ Rendering respects module enabled state
- ✅ Typecheck passes

## Known Limitations

- WebGL2 descriptor returns WGSL-style code (same as WebGPU) - actual GLSL is in shaders.ts
- No module registry system yet (direct shader integration)
- Color modes work via uniforms read from Particles module at render time
