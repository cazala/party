# Issue #08: Playground WebGPU Integration

## Goal
Integrate WebGPU backend selection into the playground UI, add performance monitoring, and provide user controls for backend switching.

## Tasks

### 1. Backend Selection UI
- [ ] Add WebGPU/CPU backend toggle in playground controls
- [ ] Create backend capability detection and display
- [ ] Add WebGPU feature support indicators
- [ ] Implement graceful fallback UI messaging

### 2. Performance Monitoring Dashboard
- [ ] Add real-time GPU/CPU performance comparison metrics
- [ ] Create particle count scaling recommendations
- [ ] Implement memory usage monitoring for both backends
- [ ] Add frame time distribution charts

### 3. WebGPU-Specific Controls
- [ ] Add GPU workgroup size optimization controls
- [ ] Create shader debugging and profiling tools
- [ ] Implement GPU memory pressure indicators
- [ ] Add compute pipeline performance metrics

### 4. User Experience Enhancements
- [ ] Auto-select optimal backend based on system capabilities
- [ ] Add performance-guided particle count suggestions
- [ ] Create WebGPU compatibility warnings
- [ ] Implement session state preservation across backend switches

## Acceptance Criteria
- Users can seamlessly switch between CPU and WebGPU backends
- Performance improvements are clearly demonstrated
- UI provides helpful guidance for optimal settings
- No functionality loss when switching backends

## Dependencies
- Issue #01 (WebGPU Foundation Setup)
- All force migration issues (#03-#06)

## Files to Modify/Create
- `packages/playground/src/components/BackendControls.tsx` (new)
- `packages/playground/src/components/PerformanceMonitor.tsx` (new)
- `packages/playground/src/hooks/useBackendSelection.ts` (new)
- `packages/playground/src/components/control-sections/PerformanceControls.tsx` (modify)

## Testing
- Backend switching functionality tests
- Performance metric accuracy validation
- Cross-browser UI compatibility