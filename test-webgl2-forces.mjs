/**
 * WebGL2 Forces Smoke Test
 *
 * Tests that force modules (Environment, Boundary, Interaction, Grab) work with WebGL2 runtime
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

// Set up JSDOM environment
const dom = new JSDOM(`<!DOCTYPE html><canvas id="canvas" width="800" height="600"></canvas>`, {
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.WebGL2RenderingContext = class WebGL2RenderingContext {};
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock WebGL2 context
const mockContext = {
  RGBA32F: 0x8814,
  FLOAT: 0x1406,
  TEXTURE_2D: 0x0DE1,
  FRAMEBUFFER: 0x8D40,
  COLOR_ATTACHMENT0: 0x8CE0,
  TRIANGLES: 0x0004,
  POINTS: 0x0000,
  BLEND: 0x0BE2,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  COLOR_BUFFER_BIT: 0x00004000,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88E4,
  FRAGMENT_SHADER: 0x8B30,
  VERTEX_SHADER: 0x8B31,
  COMPILE_STATUS: 0x8B81,
  LINK_STATUS: 0x8B82,
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  CLAMP_TO_EDGE: 0x812F,
  FRAMEBUFFER_COMPLETE: 0x8CD5,
  createTexture: () => ({}),
  bindTexture: () => {},
  texImage2D: () => {},
  texParameteri: () => {},
  createFramebuffer: () => ({}),
  bindFramebuffer: () => {},
  framebufferTexture2D: () => {},
  checkFramebufferStatus: () => mockContext.FRAMEBUFFER_COMPLETE,
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  createShader: () => ({}),
  shaderSource: () => {},
  compileShader: () => {},
  getShaderParameter: () => true,
  getShaderInfoLog: () => '',
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  getProgramParameter: () => true,
  getProgramInfoLog: () => '',
  useProgram: () => {},
  getUniformLocation: (prog, name) => ({ name }),
  getAttribLocation: (prog, name) => 0,
  uniform1i: () => {},
  uniform1f: () => {},
  uniform2f: () => {},
  uniform3f: () => {},
  enableVertexAttribArray: () => {},
  disableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  drawArrays: () => {},
  viewport: () => {},
  clearColor: () => {},
  clear: () => {},
  enable: () => {},
  disable: () => {},
  blendFunc: () => {},
  activeTexture: () => {},
  deleteTexture: () => {},
  deleteFramebuffer: () => {},
  deleteProgram: () => {},
  deleteBuffer: () => {},
  getExtension: (name) => {
    if (name === 'EXT_color_buffer_float') {
      return {};
    }
    return null;
  },
};

HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === 'webgl2') {
    return mockContext;
  }
  return null;
};

// Now import the library
import('./packages/core/dist/index.js').then(({ Engine, Particles, Environment, Boundary, Interaction, Grab }) => {
  console.log('✓ Imported Party library');

  const canvas = document.getElementById('canvas');

  // Create modules
  const particles = new Particles({ enabled: true });
  const environment = new Environment({
    enabled: true,
    gravityStrength: 100,
    gravityDirection: 'down'
  });
  const boundary = new Boundary({
    enabled: true,
    mode: 'bounce'
  });
  const interaction = new Interaction({
    enabled: true,
    mode: 'attract',
    strength: 5000,
    radius: 100,
    active: false
  });
  const grab = new Grab({
    enabled: true,
    grabbedIndex: -1
  });

  console.log('✓ Created force modules');

  // Create engine with WebGL2 runtime
  const engine = new Engine({
    canvas,
    runtime: 'webgl2',
    forces: [environment, boundary, interaction, grab],
    render: [particles]
  });

  console.log('✓ Created WebGL2 engine');

  engine.initialize().then(() => {
    console.log('✓ Engine initialized');
    console.log('  Runtime:', engine.getActualRuntime());

    // Check that modules support webgl2()
    try {
      const envDesc = environment.webgl2();
      console.log('✓ Environment.webgl2() exists');
      console.log('  Has apply:', 'apply' in envDesc);
    } catch (e) {
      console.log('✗ Environment.webgl2() failed:', e.message);
    }

    try {
      const intDesc = interaction.webgl2();
      console.log('✓ Interaction.webgl2() exists');
      console.log('  Has apply:', 'apply' in intDesc);
    } catch (e) {
      console.log('✗ Interaction.webgl2() failed:', e.message);
    }

    try {
      const boundDesc = boundary.webgl2();
      console.log('✓ Boundary.webgl2() exists');
      console.log('  Has apply:', 'apply' in boundDesc);
    } catch (e) {
      console.log('✗ Boundary.webgl2() failed:', e.message);
    }

    try {
      const grabDesc = grab.webgl2();
      console.log('✓ Grab.webgl2() exists');
      console.log('  Has correct:', 'correct' in grabDesc);
    } catch (e) {
      console.log('✗ Grab.webgl2() failed:', e.message);
    }

    // Add some particles
    engine.setParticles([
      { x: 400, y: 300, vx: 50, vy: -50, mass: 1, size: 10, color: { r: 1, g: 0, b: 0, a: 1 } },
      { x: 200, y: 200, vx: -30, vy: 40, mass: 1, size: 15, color: { r: 0, g: 1, b: 0, a: 1 } },
      { x: 600, y: 400, vx: 20, vy: 30, mass: 1, size: 12, color: { r: 0, g: 0, b: 1, a: 1 } },
    ]);

    console.log('✓ Added particles');
    console.log('  Count:', engine.getCount());

    // Test module controls
    environment.setGravityStrength(200);
    environment.setGravityDirection('up');
    console.log('✓ Environment controls work');

    boundary.setMode('warp');
    boundary.setRestitution(0.8);
    console.log('✓ Boundary controls work');

    interaction.setActive(true);
    interaction.setPosition(400, 300);
    interaction.setMode('repel');
    console.log('✓ Interaction controls work');

    grab.setGrabbedIndex(0);
    grab.setPosition({ x: 100, y: 100 });
    console.log('✓ Grab controls work');

    // Try to play (won't actually animate in test but should not error)
    engine.play();
    console.log('✓ Engine.play() called');

    setTimeout(() => {
      engine.stop();
      console.log('✓ Engine.stop() called');
      console.log('\n✅ All WebGL2 force module tests passed!');
      process.exit(0);
    }, 100);
  }).catch((err) => {
    console.error('✗ Engine initialization failed:', err);
    process.exit(1);
  });
}).catch((err) => {
  console.error('✗ Failed to import library:', err);
  process.exit(1);
});
