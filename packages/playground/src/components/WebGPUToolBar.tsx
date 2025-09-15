import { MousePointer, Plus } from "lucide-react";

type Tool = "cursor" | "spawn";

export function WebGPUToolBar({
  tool,
  onChange,
  style,
}: {
  tool: Tool;
  onChange: (t: Tool) => void;
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
