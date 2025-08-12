# Issue #05: WebGPU Flocking and Behavior Forces

## Goal
Port the complex flocking behavior system (cohesion, alignment, separation, chase, avoid, wander) to WebGPU for massive swarm simulations.

## Tasks

### 1. Core Flocking Behaviors
- [ ] Implement cohesion force calculation on GPU
- [ ] Port alignment behavior with neighbor velocity averaging
- [ ] Add separation force with distance-based weights
- [ ] Create chase/avoid behaviors with color filtering

### 2. Field-of-View and Perception
- [ ] Implement angle-based neighbor filtering on GPU
- [ ] Add view radius distance culling
- [ ] Create perception cone calculations
- [ ] Optimize trigonometric operations

### 3. Wander Behavior System
- [ ] Port wander state management to GPU-friendly structure
- [ ] Implement noise functions for procedural wandering
- [ ] Add wander target smoothing and persistence
- [ ] Create per-particle random state management

### 4. Behavior Combination and Weighting
- [ ] Implement dynamic behavior weight mixing
- [ ] Add behavior priority systems
- [ ] Create smooth behavior transitions
- [ ] Add group-based behavior overrides

## Acceptance Criteria
- Supports 10k+ particles with complex flocking behaviors
- Maintains emergent flocking patterns identical to CPU
- Wander behavior shows natural, non-repetitive movement
- Performance scales linearly with particle count

## Dependencies
- Issue #01 (WebGPU Foundation Setup)
- Issue #02 (GPU-Accelerated Spatial Grid)

## Files to Modify/Create
- `packages/core/src/webgpu/forces/behavior.ts` (new)
- `packages/core/src/webgpu/shaders/flocking.wgsl` (new)
- `packages/core/src/webgpu/shaders/wander.wgsl` (new)
- `packages/core/src/modules/forces/behavior.ts` (backend selection)

## Testing
- Flocking pattern validation against CPU implementation
- Large-scale swarm performance tests
- Behavior emergence verification