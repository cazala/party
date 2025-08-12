# Issue #06: WebGPU Joint Constraints and Physics

## Goal
Implement joint constraint solving and rigid body mechanics on WebGPU to handle complex connected particle systems at scale.

## Tasks

### 1. Constraint Solving System
- [ ] Port iterative constraint solver to GPU compute shaders
- [ ] Implement parallel constraint resolution with careful synchronization
- [ ] Add position-based constraint solving (PBD/XPBD)
- [ ] Create constraint force accumulation system

### 2. Joint Network Management
- [ ] Design GPU-friendly joint data structures
- [ ] Implement joint network traversal on GPU
- [ ] Add rigid body group detection and caching
- [ ] Create joint breaking and reformation mechanics

### 3. Advanced Constraint Types
- [ ] Implement distance constraints with variable stiffness
- [ ] Add angular constraints for rotational limits
- [ ] Create volume preservation constraints
- [ ] Add collision-aware constraint solving

### 4. Stability and Performance
- [ ] Add constraint warm-starting for stability
- [ ] Implement adaptive iteration counts based on error
- [ ] Create constraint force limiting for realism
- [ ] Add emergency constraint breaking under stress

## Acceptance Criteria
- Handles 1000+ connected particles with stable joints
- Maintains joint constraint accuracy under stress
- Rigid body groups behave correctly
- Performance scales with constraint count

## Dependencies
- Issue #01 (WebGPU Foundation Setup)
- Issue #02 (GPU-Accelerated Spatial Grid)

## Files to Modify/Create
- `packages/core/src/webgpu/forces/joints.ts` (new)
- `packages/core/src/webgpu/shaders/constraint-solver.wgsl` (new)
- `packages/core/src/webgpu/shaders/rigid-body.wgsl` (new)
- `packages/core/src/modules/forces/joints.ts` (backend selection)

## Testing
- Joint stability tests with stress scenarios
- Rigid body accuracy validation
- Constraint solving performance benchmarks