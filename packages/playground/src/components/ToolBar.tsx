import { MousePointer, Plus } from "lucide-react";
import { ToolMode } from "../hooks/useToolMode";

import "./Toolbar.css";

export function Toolbar({
  tool,
  onChange,
  style,
}: {
  tool: ToolMode;
  onChange: (t: ToolMode) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className="toolbar" style={style}>
      <div className="toolbar-content">
        <div className="tool-mode-selector">
          <button
            onClick={() => onChange("cursor")}
            className={`tool-mode-button tool-mode-first ${
              tool === "cursor" ? "tool-mode-active" : ""
            }`}
            title="Cursor"
          >
            <MousePointer width="16" height="16" />
            <span>Cursor</span>
          </button>
          <button
            onClick={() => onChange("spawn")}
            className={`tool-mode-button tool-mode-second ${
              tool === "spawn" ? "tool-mode-active" : ""
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
