Implement redux:

1. install libs (redux-toolkit)

2. create a src/modules folder, and put everything related to redux (slices) in there, following a domain-driven design, like:

/src
/modules
/init
/slice.ts # exports actions/selectors/thunks related to spawning the initial particles, used by InitControls.ts. Action example: initParticles(initConfig)
/engine
/slice.ts # exports actions/selectors/thunks related to the Engine domain (used by TopBar.tsx, PerformanceControls.tsx, RenderControls.tsx, useParty hook, InitControls.tsx). Action/thunk examples: addParticle(p), changeRuntime('cpu'|'gpu'), play(), pause(). Selector examples: getFPS, isWebGPU.
/tools
/slice.ts # exports actions/selectors/thunks related to the Tools domain (used by ToolBar.tsx). Action example: setTool('spawn' | 'cursor'). Selector example: getTool()
/modules
/slice.ts @expors actions/selectors/thunks related to the @party/core modules. It holds the state of all those modules mostly, instead of holding it on each component internal state. Would be great to have it integrated into ModuleWrapper as a dynamic and generic way to store all the values on redux, and select them from there, isntead of doing it on each component with useState.

3. for the shape of the store's state, lets do the following:

```js
{
  init: {
    particleNum,
    particleSize,
    particleMass,
    // all the InitControls fields
  },
  engine: {
    isWebGPU,
    constrainIterations,
    gridCellSize,
    particleCount,
    fps,
    clearColor
    play
    pause
    restart
    clear
    size
    camera
    zoom
  },
  tools: {
    active: 'spawn' | 'cursor' // etc
  },
  modules: {
    environment: {
      // all the Environemnt modules @packages/core/src/beta/modules/environment.ts properties
      gravityStrength,
      inertia,
      friction
    },
    boundary: {
      // all the Boundary module properties
    },
    // all the rest of the modules
  }
}
```
