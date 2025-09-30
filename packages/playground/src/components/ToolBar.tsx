import { MousePointer, Plus, Minus, Pin, Link } from "lucide-react";
import { useTools } from "../hooks/useTools";

import "./ToolBar.css";

export function Toolbar({ style }: { style?: React.CSSProperties }) {
  const {
    isCursorMode,
    isSpawnMode,
    isRemoveMode,
    isPinMode,
    isJointMode,
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
            onClick={() => setToolMode("joint")}
            className={`tool-mode-button tool-mode-fifth ${
              isJointMode ? "tool-mode-active" : ""
            }`}
            title="Joint"
          >
            <Link width="16" height="16" />
            <span>Joint</span>
          </button>
        </div>
      </div>
    </div>
  );
}
