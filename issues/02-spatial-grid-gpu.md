# Issue #02: GPU-Accelerated Spatial Grid

## Goal
Implement WebGPU-based spatial grid for efficient neighbor queries, enabling fast force calculations for neighbor-dependent systems.

## Tasks

### 1. GPU Spatial Grid Data Structure
- [x] Design GPU-friendly spatial grid layout using compute buffers
- [x] Implement particle → grid cell mapping on GPU
- [ ] Create efficient neighbor query system using compute shaders
- [ ] Add dynamic grid resizing and cell optimization

### 2. Compute Shaders for Spatial Operations
- [ ] Write compute shader for particle spatial sorting
- [ ] Implement neighbor enumeration with distance culling
- [ ] Create parallel grid cell population
- [ ] Add frustum culling integration

### 3. Memory Management
- [ ] Implement efficient buffer pooling for neighbor lists
- [ ] Add dynamic memory allocation for variable neighbor counts
- [ ] Create GPU memory pressure monitoring
- [ ] Optimize buffer reuse patterns

### 4. CPU Compatibility Layer
- [ ] Maintain CPU spatial grid as fallback
- [ ] Add performance-based automatic backend switching
- [ ] Implement synchronized spatial data between backends
- [ ] Create debugging tools for grid visualization

## Acceptance Criteria
- Neighbor queries show 10x+ performance improvement for 1k+ particles
- Memory usage remains reasonable (< 100MB for 10k particles)
- CPU fallback maintains exact feature parity
- Spatial queries return identical results on both backends

## Dependencies
- Issue #01 (WebGPU Foundation Setup)

## Files to Modify/Create
- `packages/core/src/webgpu/spatial-grid.ts` (new)
- `packages/core/src/webgpu/shaders/spatial-sort.wgsl` (new)
- `packages/core/src/modules/spatial-grid.ts` (backend abstraction)

## Testing
- Neighbor query result consistency tests
- Performance benchmarks with varying particle counts
- Memory usage profiling