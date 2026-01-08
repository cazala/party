#!/usr/bin/env node

/**
 * Basic smoke test for WebGL2 Particles rendering
 * This verifies that:
 * 1. Particles.webgl2() method exists and returns a descriptor
 * 2. The descriptor has the correct structure
 * 3. Module settings can be read correctly
 */

import { Particles } from './packages/core/dist/index.js';

console.log('Testing WebGL2 Particles implementation...\n');

// Test 1: Create Particles module
console.log('✓ Test 1: Creating Particles module');
const particles = new Particles({
  enabled: true,
  colorType: 0,
  customColor: { r: 1, g: 0, b: 0, a: 1 },
  hue: 0.5
});

// Test 2: Check webgl2() method exists
console.log('✓ Test 2: Checking webgl2() method exists');
if (typeof particles.webgl2 !== 'function') {
  console.error('✗ FAIL: webgl2() method not found');
  process.exit(1);
}

// Test 3: Get WebGL2 descriptor
console.log('✓ Test 3: Getting WebGL2 descriptor');
const descriptor = particles.webgl2();

// Test 4: Verify descriptor structure
console.log('✓ Test 4: Verifying descriptor structure');
if (!descriptor.passes || !Array.isArray(descriptor.passes)) {
  console.error('✗ FAIL: Descriptor missing passes array');
  process.exit(1);
}

if (descriptor.passes.length === 0) {
  console.error('✗ FAIL: Descriptor has no passes');
  process.exit(1);
}

const pass = descriptor.passes[0];
if (pass.kind !== 'fullscreen') {
  console.error('✗ FAIL: First pass is not fullscreen');
  process.exit(1);
}

if (typeof pass.fragment !== 'function') {
  console.error('✗ FAIL: Pass missing fragment function');
  process.exit(1);
}

if (!Array.isArray(pass.bindings)) {
  console.error('✗ FAIL: Pass missing bindings array');
  process.exit(1);
}

// Test 5: Verify bindings
console.log('✓ Test 5: Verifying bindings');
const expectedBindings = ['colorType', 'customColorR', 'customColorG', 'customColorB', 'hue'];
for (const binding of expectedBindings) {
  if (!pass.bindings.includes(binding)) {
    console.error(`✗ FAIL: Missing binding: ${binding}`);
    process.exit(1);
  }
}

// Test 6: Test module settings
console.log('✓ Test 6: Testing module settings');
particles.setColorType(1);
const colorType = particles.readValue('colorType');
if (colorType !== 1) {
  console.error('✗ FAIL: ColorType not set correctly');
  process.exit(1);
}

particles.setHue(0.7);
const hue = particles.readValue('hue');
if (Math.abs(hue - 0.7) > 0.001) {
  console.error('✗ FAIL: Hue not set correctly');
  process.exit(1);
}

// Test 7: Test enabled state
console.log('✓ Test 7: Testing enabled state');
particles.setEnabled(false);
if (particles.isEnabled()) {
  console.error('✗ FAIL: Module should be disabled');
  process.exit(1);
}

particles.setEnabled(true);
if (!particles.isEnabled()) {
  console.error('✗ FAIL: Module should be enabled');
  process.exit(1);
}

console.log('\n✓ All tests passed!');
console.log('\nWebGL2 Particles module implementation is complete.');
console.log('- Particles.webgl2() returns proper descriptor');
console.log('- All color mode bindings present (colorType, customColor, hue)');
console.log('- Module settings work correctly');
console.log('- Enabled state toggles properly');
console.log('\nNote: Full visual testing requires browser environment.');
