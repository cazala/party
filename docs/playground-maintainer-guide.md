# Playground Maintainer Guide

This guide covers the internal architecture, coding patterns, and development workflows for the Party Playground React application. It's designed to help new developers understand the codebase and contribute effectively.

## Tech Stack

### Core Technologies

- **React 18**: Component-based UI with hooks and modern patterns
- **TypeScript**: Full type safety with strict configuration
- **Redux Toolkit**: State management with modern Redux patterns
- **Vite**: Build tool and dev server for fast development
- **CSS Modules**: Scoped styling with PostCSS processing

### Development Tools

- **ESLint**: Code linting with React and TypeScript rules
- **Prettier**: Code formatting with consistent style
- **Vitest**: Unit testing framework
- **React DevTools**: Redux DevTools integration

### Key Dependencies

- **@reduxjs/toolkit**: Modern Redux with createSlice and RTK Query
- **react-redux**: React bindings for Redux
- **lucide-react**: Consistent icon library
- **@cazala/party**: Core physics engine

## Architecture Overview

The playground follows a **modular, layered architecture** with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │     Hooks       │    │  Redux Slices   │
│                 │    │                 │    │                 │
│ • Module UIs    │◄──►│ • Module Hooks  │◄──►│ • Module State  │
│ • Tool Overlays │    │ • Tool Hooks    │    │ • Actions       │
│ • Common UI     │    │ • Engine Hook   │    │ • Selectors     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │ Engine Context  │
                    │                 │
                    │ • Core Engine   │
                    │ • Module Refs   │
                    │ • Canvas Utils  │
                    └─────────────────┘
```

## File Organization

### Directory Structure

```
packages/playground/src/
├── components/           # React components
│   ├── modules/         # Module-specific UI components
│   ├── modals/          # Modal dialogs
│   ├── ui/              # Reusable UI components
│   └── tools/           # Tool-related components
├── contexts/            # React contexts
├── hooks/               # Custom React hooks
│   ├── modules/         # Module-specific hooks
│   ├── tools/           # Tool system hooks
│   │   └── individual-tools/  # Individual tool implementations
│   └── utils/           # Utility hooks
├── slices/              # Redux Toolkit slices
│   ├── modules/         # Module state slices
│   └── utils/           # Utility slices
├── types/               # TypeScript type definitions
├── utils/               # Pure utility functions
└── styles/              # Global styles and CSS modules
```

### Naming Conventions

- **Components**: PascalCase (`EnvironmentModule.tsx`)
- **Hooks**: camelCase with `use` prefix (`useEnvironment.ts`)
- **Types**: PascalCase (`ModuleState.ts`)
- **Utils**: camelCase (`sessionManager.ts`)
- **CSS Modules**: kebab-case (`.component-name`)

## Core Architectural Patterns

### 1. Module System Architecture

Each physics module follows a **three-layer pattern**:

#### Layer 1: Redux Slice (State Management)

```typescript
// slices/modules/environment.ts
export const environmentSlice = createSlice({
  name: "environment",
  initialState: {
    gravityStrength: 0,
    gravityDirection: "down" as const,
    // ... other properties
  },
  reducers: {
    setEnvironmentGravityStrength: (state, action: PayloadAction<number>) => {
      state.gravityStrength = action.payload;
    },
    resetEnvironment: () => initialState,
    importEnvironmentSettings: (state, action) => {
      Object.assign(state, action.payload);
    },
  },
});
```

#### Layer 2: Module Hook (Integration)

```typescript
// hooks/modules/useEnvironment.ts
export function useEnvironment() {
  const dispatch = useAppDispatch();
  const { environment } = useEngine();
  const state = useAppSelector(selectEnvironmentState);

  // Sync Redux state to engine when state changes
  useEffect(() => {
    if (environment) {
      environment.setGravityStrength(state.gravityStrength);
      // ... sync other properties
    }
  }, [environment, state]);

  // Action creators with dual-write pattern
  const setGravityStrength = useCallback(
    (value: number) => {
      dispatch(setEnvironmentGravityStrength(value)); // Redux update
      environment?.setGravityStrength(value); // Immediate engine update
    },
    [dispatch, environment]
  );

  return {
    // State properties (individual extractions)
    gravityStrength: state.gravityStrength,
    gravityDirection: state.gravityDirection,
    // Action creators
    setGravityStrength,
    setGravityDirection,
    // Utility actions
    resetEnvironment: useCallback(
      () => dispatch(resetEnvironment()),
      [dispatch]
    ),
  };
}
```

#### Layer 3: Module Component (UI)

```typescript
// components/modules/EnvironmentModule.tsx
export function EnvironmentModule({ enabled = true }: { enabled?: boolean }) {
  const {
    gravityStrength,
    setGravityStrength,
    gravityDirection,
    setGravityDirection,
  } = useEnvironment();

  return (
    <>
      <Slider
        sliderId="environment.gravityStrength"
        label="Gravity Strength"
        value={gravityStrength}
        onChange={setGravityStrength}
        min={0}
        max={2000}
        disabled={!enabled}
      />
      <Dropdown
        label="Direction"
        value={gravityDirection}
        onChange={setGravityDirection}
        options={[
          { value: "up", label: "Up" },
          { value: "down", label: "Down" },
          // ... more options
        ]}
        disabled={!enabled}
      />
    </>
  );
}
```

### 2. Tool System Architecture

Tools follow a **hook-based pattern** with standardized interfaces:

#### Tool Hook Interface

```typescript
// types/tools.ts
export interface ToolHandlers {
  onMouseDown?: (event: MouseEvent) => void | Promise<void>;
  onMouseMove?: (event: MouseEvent) => void | Promise<void>;
  onMouseUp?: (event: MouseEvent) => void | Promise<void>;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
}

export type ToolRenderFunction = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  mouse: { x: number; y: number; isDown: boolean }
) => void;
```

#### Tool Implementation Pattern

```typescript
// hooks/tools/individual-tools/useSpawnTool.ts
export function useSpawnTool(isActive: boolean) {
  const { addParticle } = useEngine();
  const { appendToTransaction, beginTransaction } = useHistory();
  const { spawnSettings } = useInit();

  const handlers: ToolHandlers = {
    onMouseDown: async (event) => {
      if (!isActive) return;

      beginTransaction("Spawn particles");
      const particles = createParticlesAtPosition(event, spawnSettings);

      for (const particle of particles) {
        addParticle(particle);
        appendToTransaction(new AddParticleCommand(particle));
      }
    },
  };

  const renderOverlay: ToolRenderFunction = useCallback(
    (ctx, size, mouse) => {
      if (!isActive) return;

      // Draw spawn preview at cursor
      drawSpawnPreview(ctx, mouse, spawnSettings);
    },
    [isActive, spawnSettings]
  );

  return { handlers, renderOverlay };
}
```

### 3. Hook Patterns and Conventions

#### **Critical Pattern: No Direct Redux Usage in Components**

**❌ Never do this in components:**

```typescript
// DON'T: Direct Redux usage in components
const dispatch = useDispatch();
const state = useSelector(selectSomeState);
```

**✅ Always do this instead:**

```typescript
// DO: Use module hooks that wrap Redux
const { value, setValue, reset } = useModuleName();
```

#### Hook Design Principles

1. **Encapsulation**: Hooks hide Redux complexity from components
2. **Dual-Write Pattern**: Update both Redux state and engine immediately
3. **Memoization**: Use `useCallback` for all functions, `useMemo` for objects
4. **Individual Exports**: Export individual properties, not entire state objects
5. **Type Safety**: Full TypeScript support with proper typing

#### Standard Hook Structure

```typescript
export function useModuleName() {
  // 1. Get dependencies
  const dispatch = useAppDispatch();
  const { moduleRef } = useEngine();
  const state = useAppSelector(selectModuleState);

  // 2. Sync state to engine
  useEffect(() => {
    if (moduleRef) {
      moduleRef.updateFromState(state);
    }
  }, [moduleRef, state]);

  // 3. Create action creators with useCallback
  const setValue = useCallback(
    (value: SomeType) => {
      dispatch(setModuleValue(value));
      moduleRef?.setValue(value);
    },
    [dispatch, moduleRef]
  );

  // 4. Return individual properties and actions
  return {
    // State (individual properties)
    value: state.value,
    otherValue: state.otherValue,

    // Actions
    setValue,
    setOtherValue,
    reset: useCallback(() => dispatch(resetModule()), [dispatch]),
  };
}
```

### 4. Command Pattern for Undo/Redo

The playground implements a sophisticated undo/redo system using the Command pattern:

#### Command Interface

```typescript
// types/history.ts
export interface Command {
  id: string;
  label: string;
  timestamp: number;
  do(ctx: HistoryContext): void | Promise<void>;
  undo(ctx: HistoryContext): void | Promise<void>;
  tryMergeWith?(next: Command): Command | null;
}

export interface HistoryContext {
  engine: IEngine;
  addParticle: (particle: IParticle) => Promise<void>;
  removeParticle: (index: number) => Promise<void>;
  // ... other utilities
}
```

#### Command Implementation Example

```typescript
// commands/AddParticleCommand.ts
export class AddParticleCommand implements Command {
  id = generateId();
  label = "Add particle";
  timestamp = Date.now();

  constructor(private particle: IParticle, private index?: number) {}

  async do(ctx: HistoryContext): Promise<void> {
    const addedIndex = await ctx.addParticle(this.particle);
    this.index = addedIndex; // Store for undo
  }

  async undo(ctx: HistoryContext): Promise<void> {
    if (this.index !== undefined) {
      await ctx.removeParticle(this.index);
    }
  }
}
```

#### Usage in Tools

```typescript
// In tool hooks
const { beginTransaction, appendToTransaction, commitTransaction } =
  useHistory();

const handleMouseDown = async (event) => {
  beginTransaction("Draw stroke");

  const particle = await addParticle(particleData);
  appendToTransaction(new AddParticleCommand(particle));

  // ... more operations

  commitTransaction(); // Groups all commands into single undo operation
};
```

## State Management Patterns

### Redux Slice Structure

Each slice follows a consistent pattern:

```typescript
export const moduleSlice = createSlice({
  name: "moduleName",
  initialState: {
    // Primitive values for each module property
    property1: defaultValue1,
    property2: defaultValue2,
  },
  reducers: {
    // Property setters: set[Module][Property]
    setModuleProperty1: (state, action: PayloadAction<Type1>) => {
      state.property1 = action.payload;
    },

    // Reset: reset[Module]
    resetModule: () => initialState,

    // Import: import[Module]Settings
    importModuleSettings: (
      state,
      action: PayloadAction<Partial<ModuleState>>
    ) => {
      Object.assign(state, action.payload);
    },
  },
});

// Export actions
export const { setModuleProperty1, resetModule, importModuleSettings } =
  moduleSlice.actions;

// Export selectors
export const selectModuleState = (state: RootState) => state.modules.moduleName;
export const selectModuleProperty1 = (state: RootState) =>
  state.modules.moduleName.property1;

// Export reducer
export default moduleSlice.reducer;
```

### Central Module Integration

```typescript
// slices/modules/index.ts
import { combineReducers } from "@reduxjs/toolkit";
import environmentReducer from "./environment";
import fluidsReducer from "./fluids";
// ... other module reducers

export const modulesReducer = combineReducers({
  environment: environmentReducer,
  fluids: fluidsReducer,
  // ... other modules
});

export type ModulesState = ReturnType<typeof modulesReducer>;
```

## Component Development Patterns

### UI Component Guidelines

1. **Single Responsibility**: Components should have one clear purpose
2. **Prop Interfaces**: Use TypeScript interfaces for all props
3. **Default Props**: Use default parameters instead of defaultProps
4. **Conditional Rendering**: Use logical operators for clean conditional rendering
5. **Event Handlers**: Extract complex handlers to separate functions

#### Standard Component Structure

```typescript
interface ComponentProps {
  enabled?: boolean;
  className?: string;
  onSomething?: (value: SomeType) => void;
}

export function Component({
  enabled = true,
  className,
  onSomething,
}: ComponentProps) {
  // 1. Hooks (state, effects, callbacks)
  const { value, setValue } = useRelevantHook();

  // 2. Event handlers
  const handleClick = useCallback(
    (event: MouseEvent) => {
      // handler logic
      onSomething?.(newValue);
    },
    [onSomething]
  );

  // 3. Render
  return (
    <div className={cn("component-class", className)}>
      {/* Component content */}
    </div>
  );
}
```

### CSS Module Patterns

```css
/* Component.module.css */
.container {
  /* Container styles */
}

.enabled {
  /* Enabled state */
}

.disabled {
  /* Disabled state */
  opacity: 0.6;
  pointer-events: none;
}

.item {
  /* Item styles */
}

.item:hover {
  /* Hover effects */
}
```

## Engine Integration Patterns

### Engine Context Usage

The `EngineContext` provides centralized access to the engine and utilities:

```typescript
// contexts/EngineContext.tsx
export function useEngine() {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error("useEngine must be used within an EngineProvider");
  }
  return context;
}

// Usage in hooks
export function useModuleName() {
  const { moduleName } = useEngine(); // Get module reference

  // Use module reference for direct engine calls
  const setValue = useCallback(
    (value) => {
      dispatch(setModuleValue(value));
      moduleName?.setValue(value); // Immediate engine update
    },
    [dispatch, moduleName]
  );
}
```

### Coordinate System Integration

```typescript
// Engine context provides coordinate utilities
const { screenToWorld, worldToScreen } = useEngine();

// Convert mouse coordinates for engine operations
const handleMouseClick = (event: MouseEvent) => {
  const screenCoords = { x: event.clientX, y: event.clientY };
  const worldCoords = screenToWorld(screenCoords);

  // Use world coordinates for engine operations
  addParticle({ x: worldCoords.x, y: worldCoords.y /* ... */ });
};
```

## Development Workflow

### Setting Up Development Environment

1. **Install dependencies**:

   ```bash
   npm run setup
   ```

2. **Start development server**:

   ```bash
   npm run dev
   ```

3. **Run tests**:

   ```bash
   npm test
   ```

4. **Type checking**:
   ```bash
   npm run type-check
   ```

> **Note**: The project uses pnpm workspaces internally but all commands are available through npm scripts. The `setup` command installs pnpm locally and sets up all workspace dependencies.

### Adding New Modules

1. **Create Redux slice**:

   ```typescript
   // slices/modules/newModule.ts
   export const newModuleSlice = createSlice({
     // Implementation
   });
   ```

2. **Create module hook**:

   ```typescript
   // hooks/modules/useNewModule.ts
   export function useNewModule() {
     // Implementation following standard pattern
   }
   ```

3. **Create UI component**:

   ```typescript
   // components/modules/NewModuleComponent.tsx
   export function NewModuleComponent({ enabled = true }) {
     // Implementation
   }
   ```

4. **Integrate into main UI**:
   ```typescript
   // Add to ModulesSidebar or appropriate location
   ```

### Adding New Tools

1. **Create tool hook**:

   ```typescript
   // hooks/tools/individual-tools/useNewTool.ts
   export function useNewTool(isActive: boolean) {
     // Implement handlers and renderOverlay
     return { handlers, renderOverlay };
   }
   ```

2. **Register in tool system**:

   ```typescript
   // Update tool registry and hotkey mappings
   ```

3. **Add UI controls**:
   ```typescript
   // Add tool button to toolbar
   ```

## Testing Patterns

### Unit Testing

```typescript
// __tests__/hooks/useModule.test.ts
import { renderHook, act } from "@testing-library/react";
import { useModule } from "../hooks/useModule";

describe("useModule", () => {
  it("should handle value updates correctly", () => {
    const { result } = renderHook(() => useModule());

    act(() => {
      result.current.setValue(newValue);
    });

    expect(result.current.value).toBe(newValue);
  });
});
```

### Integration Testing

```typescript
// Test Redux integration
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

const testStore = configureStore({
  reducer: { modules: modulesReducer },
});

const wrapper = ({ children }) => (
  <Provider store={testStore}>{children}</Provider>
);
```

## Performance Considerations

### React Performance

1. **Memoization**: Use `useCallback` and `useMemo` appropriately
2. **Component Splitting**: Break large components into smaller ones
3. **Conditional Rendering**: Avoid expensive renders when not needed
4. **Event Handler Optimization**: Debounce expensive operations

### Redux Performance

1. **Selector Memoization**: Use reselect for complex selectors
2. **Normalized State**: Keep state flat and normalized
3. **Minimal Updates**: Update only necessary state slices

### Engine Integration Performance

1. **Dual-Write Pattern**: Immediate engine updates for responsive UI
2. **Batch Operations**: Group multiple engine operations when possible
3. **Async Boundaries**: Use async operations for expensive engine calls

## Common Patterns and Anti-Patterns

### ✅ Good Patterns

```typescript
// 1. Use module hooks instead of direct Redux
const { value, setValue } = useModule();

// 2. Memoize callbacks
const handleChange = useCallback(
  (newValue) => {
    setValue(newValue);
  },
  [setValue]
);

// 3. Individual state properties
return {
  property1: state.property1,
  property2: state.property2,
  setProperty1,
  setProperty2,
};

// 4. Proper TypeScript usage
interface Props {
  value: number;
  onChange: (value: number) => void;
}
```

### ❌ Anti-Patterns

```typescript
// 1. DON'T use Redux directly in components
const dispatch = useDispatch(); // ❌
const state = useSelector(selectState); // ❌

// 2. DON'T return entire state objects
return { state }; // ❌ Return individual properties instead

// 3. DON'T forget memoization
const handleClick = () => {
  /* ... */
}; // ❌ Use useCallback

// 4. DON'T bypass the hook layer
engine.module.setValue(value); // ❌ Use module hooks instead
```

## Debugging and Development Tools

### Redux DevTools

- Use Redux DevTools browser extension
- Time-travel debugging for state changes
- Action inspection and replay

### React DevTools

- Component hierarchy inspection
- Props and state debugging
- Performance profiling

### Engine Debugging

- Use browser console for engine state inspection
- FPS monitoring in top bar
- WebGPU vs CPU runtime information

## Contributing Guidelines

### Code Style

1. **Follow TypeScript strict mode**
2. **Use Prettier for formatting**
3. **Follow ESLint rules**
4. **Write descriptive commit messages**

### Pull Request Process

1. **Create feature branch from main**
2. **Implement changes following patterns**
3. **Add tests for new functionality**
4. **Update documentation if needed**
5. **Ensure all checks pass**

### Architecture Decisions

1. **Discuss major changes in issues first**
2. **Follow existing patterns unless there's a compelling reason not to**
3. **Consider performance implications**
4. **Maintain backward compatibility when possible**

This maintainer guide provides the foundation for understanding and contributing to the playground codebase. The consistent patterns and clear separation of concerns make the codebase maintainable and extensible while providing excellent developer experience.
