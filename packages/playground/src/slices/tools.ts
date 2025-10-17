import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ToolMode =
  | "interaction"
  | "spawn"
  | "remove"
  | "joint"
  | "grab"
  | "pin"
  | "draw"
  | "shape";

export interface ToolsState {
  active: ToolMode;
}

const initialState: ToolsState = {
  active: "interaction",
};

export const toolsSlice = createSlice({
  name: "tools",
  initialState,
  reducers: {
    setTool: (state, action: PayloadAction<ToolMode>) => {
      state.active = action.payload;
    },
    toggleTool: (state) => {
      // Cycle through tools like the original implementation
      switch (state.active) {
        case "interaction":
          state.active = "spawn";
          break;
        case "spawn":
          state.active = "joint";
          break;
        case "joint":
          state.active = "grab";
          break;
        case "grab":
          state.active = "pin";
          break;
        case "pin":
          state.active = "draw";
          break;
        case "draw":
          state.active = "shape";
          break;
        case "shape":
          state.active = "remove";
          break;
        case "remove":
          state.active = "interaction";
          break;
        default:
          state.active = "interaction";
      }
    },
    resetTool: () => initialState,
  },
});

export const { setTool, toggleTool, resetTool } = toolsSlice.actions;

export const toolsReducer = toolsSlice.reducer;

// Selectors
export const selectToolsState = (state: { tools: ToolsState }) => state.tools;
export const selectActiveTool = (state: { tools: ToolsState }) =>
  state.tools.active;
export const selectIsSpawnMode = (state: { tools: ToolsState }) =>
  state.tools.active === "spawn";
export const selectIsRemoveMode = (state: { tools: ToolsState }) =>
  state.tools.active === "remove";
export const selectIsJointMode = (state: { tools: ToolsState }) =>
  state.tools.active === "joint";
export const selectIsGrabMode = (state: { tools: ToolsState }) =>
  state.tools.active === "grab";
export const selectIsPinMode = (state: { tools: ToolsState }) =>
  state.tools.active === "pin";
export const selectIsDrawMode = (state: { tools: ToolsState }) =>
  state.tools.active === "draw";
export const selectIsShapeMode = (state: { tools: ToolsState }) =>
  state.tools.active === "shape";
export const selectIsInteractionMode = (state: { tools: ToolsState }) =>
  state.tools.active === "interaction";
