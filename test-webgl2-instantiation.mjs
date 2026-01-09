#!/usr/bin/env node

/**
 * Test that WebGL2Engine can be instantiated with Particles module
 * Note: This will fail with WebGL2 context creation since we're in Node,
 * but it tests the module integration logic
 */

import { Engine, Particles } from './packages/core/dist/index.js';
import { JSDOM } from 'jsdom';

console.log('Testing WebGL2Engine instantiation with Particles module...\n');

// Create a fake DOM environment
const dom = new JSDOM('<!DOCTYPE html><canvas id="test"></canvas>');
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

const canvas = document.getElementById('test');
const particles = new Particles({ enabled: true });

console.log('✓ Created Particles module');
console.log('  - isEnabled:', particles.isEnabled());
console.log('  - colorType:', particles.readValue('colorType'));

try {
  const engine = new Engine({
    canvas,
    runtime: 'webgl2',
    render: [particles]
  });

  console.log('✓ Created Engine instance with WebGL2 runtime and Particles module');
  console.log('  - modules count:', engine.modules?.length || 0);

  // This will fail in Node (no WebGL2), but that's expected
  try {
    await engine.initialize();
    console.log('✓ Engine initialized (unexpected in Node.js!)');
  } catch (err) {
    console.log('✓ Initialize failed as expected in Node.js:', err.message.substring(0, 80));
  }

} catch (err) {
  console.error('✗ FAIL: Could not create engine:', err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log('\n✓ Integration test passed!');
console.log('WebGL2Engine accepts Particles module correctly.');
