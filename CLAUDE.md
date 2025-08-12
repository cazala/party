# Claude Rules for WebGPU Migration Project

## Project Overview
This project is migrating a particle physics library from CPU to WebGPU for massive performance improvements. We're following a 9-issue roadmap in `/issues/` directory.

## Workflow Rules

### Issue Management
1. **Work on issues sequentially** - Follow the dependency order in `/issues/README.md`
2. **One issue at a time** - Complete current issue before starting next
3. **Check dependencies** - Ensure prerequisite issues are completed
4. **Update issue status** - Mark tasks as completed in the issue markdown

### Task Management
1. **Work on tasks one by one** - Complete each task bullet point individually
2. **Update issue file** - Check off completed tasks using `[x]` 
3. **Commit after each task** - Make focused commits for each completed task
4. **Clear commit messages** - Use format: `feat(issue-##): task description`

### Development Process
1. **Read issue thoroughly** - Understand goals, tasks, and acceptance criteria
2. **Plan before coding** - Understand what needs to be built
3. **Test incrementally** - Verify each task works before moving on
4. **Maintain compatibility** - Don't break existing API
5. **Performance first** - Always benchmark GPU vs CPU performance

### Code Standards
1. **TypeScript strict mode** - All new code must be properly typed
2. **Follow existing patterns** - Match codebase style and architecture
3. **Document WebGPU code** - Add comments for GPU-specific logic
4. **Error handling** - Always handle WebGPU initialization failures
5. **Resource cleanup** - Properly dispose GPU resources

### Testing Requirements
1. **Unit tests** - Write tests for new functionality
2. **Performance tests** - Benchmark CPU vs WebGPU performance
3. **Integration tests** - Test CPU/WebGPU backend switching
4. **Browser compatibility** - Test WebGPU fallback behavior

### Git Commit Guidelines
1. **Focused commits** - One task per commit
2. **Descriptive messages** - Explain what was implemented
3. **Include issue reference** - Link commits to issues
4. **Update documentation** - Include any doc changes in commits

### Current Status
- **Active Issue**: Start with Issue #01 (WebGPU Foundation Setup)
- **Next Issues**: Follow dependency chain #01 → #02 → #03-#06 → #07-#09
- **Progress Tracking**: Update issue markdown files as tasks complete

## Commands to Remember
- `npm run build` - Build the core library
- `npm run dev` - Start playground development server
- `npm run test` - Run test suite (when available)

## WebGPU Development Notes
- Always check WebGPU availability before using
- Implement CPU fallback for all GPU features
- Use compute shaders for particle calculations
- Manage GPU memory carefully to avoid OOM
- Test on different GPU vendors (NVIDIA, AMD, Intel)

## File Organization
- Core library: `packages/core/src/`
- WebGPU code: `packages/core/src/webgpu/`
- Shaders: `packages/core/src/webgpu/shaders/`
- Playground: `packages/playground/src/`
- Issues: `/issues/`

## Performance Expectations
Target 10x-50x performance improvement for 10k+ particles while maintaining identical behavior to CPU implementation.