import { MousePointer, Plus, Minus, Pin, Link, Hand, Pen, Hexagon } from "lucide-react";
import { useTools } from "../hooks/useTools";

import "./ToolBar.css";

export function Toolbar({ style }: { style?: React.CSSProperties }) {
  const {
    isCursorMode,
    isSpawnMode,
    isRemoveMode,
    isPinMode,
    isJointMode,
    isGrabMode,
    isDrawMode,
    isShapeMode,
    setToolMode,
  } = useTools();

  return (
    <div className="toolbar" style={style}>
      <div className="toolbar-content">
        <div className="tool-mode-selector">
          <button
            onClick={() => setToolMode("cursor")}
            className={`tool-mode-button tool-mode-first ${
              isCursorMode ? "tool-mode-active" : ""
            }`}
            title="Cursor"
          >
            <MousePointer width="16" height="16" />
            <span>Cursor</span>
          </button>
          <button
            onClick={() => setToolMode("spawn")}
            className={`tool-mode-button tool-mode-second ${
              isSpawnMode ? "tool-mode-active" : ""
            }`}
            title="Spawn"
          >
            <Plus width="16" height="16" />
            <span>Spawn</span>
          </button>
          <button
            onClick={() => setToolMode("remove")}
            className={`tool-mode-button tool-mode-third ${
              isRemoveMode ? "tool-mode-active" : ""
            }`}
            title="Remove"
          >
            <Minus width="16" height="16" />
            <span>Remove</span>
          </button>
          <button
            onClick={() => setToolMode("pin")}
            className={`tool-mode-button tool-mode-fourth ${
              isPinMode ? "tool-mode-active" : ""
            }`}
            title="Pin"
          >
            <Pin width="16" height="16" />
            <span>Pin</span>
          </button>
          <button
            onClick={() => setToolMode("grab")}
            className={`tool-mode-button tool-mode-fifth ${
              isGrabMode ? "tool-mode-active" : ""
            }`}
            title="Grab"
          >
            <Hand width="16" height="16" />
            <span>Grab</span>
          </button>

          <button
            onClick={() => setToolMode("joint")}
            className={`tool-mode-button tool-mode-seventh ${
              isJointMode ? "tool-mode-active" : ""
            }`}
            title="Joint"
          >
            <Link width="16" height="16" />
            <span>Joint</span>
          </button>
          <button
            onClick={() => setToolMode("draw")}
            className={`tool-mode-button tool-mode-sixth ${
              isDrawMode ? "tool-mode-active" : ""
            }`}
            title="Draw"
          >
            <Pen width="16" height="16" />
            <span>Draw</span>
          </button>

          <button
            onClick={() => setToolMode("shape")}
            className={`tool-mode-button tool-mode-eighth ${
              isShapeMode ? "tool-mode-active" : ""
            }`}
            title="Shape"
          >
            <Hexagon width="16" height="16" />
            <span>Shape</span>
          </button>
        </div>
      </div>
    </div>
  );
}
