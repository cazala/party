import { MousePointer, Plus } from "lucide-react";
import { useTools } from "../hooks/useTools";

import "./Toolbar.css";

export function Toolbar({ style }: { style?: React.CSSProperties }) {
  const { isCursorMode, isSpawnMode, setToolMode } = useTools();

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
        </div>
      </div>
    </div>
  );
}
