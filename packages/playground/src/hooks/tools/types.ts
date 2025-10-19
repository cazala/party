import { ToolMode } from "../../slices/tools";

// Common interfaces used across all tools
export interface ToolState {
  isActive: boolean;
  mousePosition: { x: number; y: number };
}

export interface ToolHandlers {
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
}

export interface ToolRenderFunction {
  (
    ctx: CanvasRenderingContext2D,
    canvasSize: { width: number; height: number },
    mouse?: { x: number; y: number }
  ): void;
}

// Main useTools return interface
export interface UseToolsReturn {
  // Tool mode management
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  resetToolMode: () => void;
  isSpawnMode: boolean;
  isRemoveMode: boolean;
  isJointMode: boolean;
  isGrabMode: boolean;
  isPinMode: boolean;
  isDrawMode: boolean;
  isShapeMode: boolean;
  isInteractionMode: boolean;

  // Tool-specific states
  isGrabbing: boolean;

  // Overlay functions
  renderOverlay: (
    ctx: CanvasRenderingContext2D,
    canvasSize: { width: number; height: number },
    isMouseOver: boolean,
    mouse?: { x: number; y: number }
  ) => void;
}
