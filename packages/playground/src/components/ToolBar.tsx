import { MousePointer, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import { selectActiveTool, setTool } from "../modules/tools/slice";

import "./Toolbar.css";

export function Toolbar({
  style,
}: {
  style?: React.CSSProperties;
}) {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector(selectActiveTool);

  return (
    <div className="toolbar" style={style}>
      <div className="toolbar-content">
        <div className="tool-mode-selector">
          <button
            onClick={() => dispatch(setTool("cursor"))}
            className={`tool-mode-button tool-mode-first ${
              activeTool === "cursor" ? "tool-mode-active" : ""
            }`}
            title="Cursor"
          >
            <MousePointer width="16" height="16" />
            <span>Cursor</span>
          </button>
          <button
            onClick={() => dispatch(setTool("spawn"))}
            className={`tool-mode-button tool-mode-second ${
              activeTool === "spawn" ? "tool-mode-active" : ""
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
