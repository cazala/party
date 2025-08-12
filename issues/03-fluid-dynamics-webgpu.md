# Issue #03: WebGPU Fluid Dynamics (SPH)

## Goal
Migrate the computationally intensive SPH fluid simulation to WebGPU, achieving significant performance gains for large particle counts.

## Tasks

### 1. SPH Compute Shaders
- [ ] Port density calculation kernel to WebGPU compute shader
- [ ] Implement pressure force calculation on GPU
- [ ] Add viscosity force computation with neighbor averaging
- [ ] Create kernel function lookup table optimization

### 2. Multi-Pass Computation Pipeline
- [ ] Design efficient multi-pass rendering for SPH phases
- [ ] Implement density → pressure → force calculation pipeline
- [ ] Add synchronization between computation phases
- [ ] Optimize dispatch sizes based on particle count

### 3. Advanced GPU Optimizations
- [ ] Implement workgroup-local memory sharing for neighbors
- [ ] Add atomic operations for density accumulation
- [ ] Create efficient neighbor list caching
- [ ] Optimize memory access patterns for coalescing

### 4. Performance Scaling
- [ ] Add dynamic dispatch sizing based on particle count
- [ ] Implement progressive quality scaling under performance pressure
- [ ] Create adaptive time-stepping for stability
- [ ] Add GPU memory management for large simulations

## Acceptance Criteria
- Fluid simulation supports 10k+ particles at 60fps
- Maintains physical accuracy compared to CPU implementation
- Shows 20x+ performance improvement for large particle counts
- Graceful degradation on lower-end GPUs

## Dependencies
- Issue #01 (WebGPU Foundation Setup)
- Issue #02 (GPU-Accelerated Spatial Grid)

## Files to Modify/Create
- `packages/core/src/webgpu/forces/fluid.ts` (new)
- `packages/core/src/webgpu/shaders/sph-density.wgsl` (new)
- `packages/core/src/webgpu/shaders/sph-pressure.wgsl` (new)
- `packages/core/src/webgpu/shaders/sph-viscosity.wgsl` (new)
- `packages/core/src/modules/forces/fluid.ts` (backend selection)

## Testing
- Fluid simulation accuracy validation
- Performance scaling tests (1k to 50k particles)
- Cross-platform GPU compatibility