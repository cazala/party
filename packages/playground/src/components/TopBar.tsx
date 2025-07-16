import { useState, useEffect } from "react";
import { RefreshCw, Save, FolderOpen } from "lucide-react";
import { System } from "@party/core";
import { ToolMode } from "../hooks/useToolMode";

interface TopBarProps {
  system: System | null;
  onPlay: () => void;
  onPause: () => void;
  onClear: () => void;
  onReset: () => void;
  onShowHotkeys?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
}

export function TopBar({
  system,
  onPlay,
  onPause,
  onClear,
  onReset,
  onShowHotkeys,
  onSave,
  onLoad,
  toolMode = "spawn",
  onToolModeChange,
}: TopBarProps) {
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (system) {
      setIsPlaying(system.isPlaying);
    }
  }, [system]);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
      setIsPlaying(false);
    } else {
      onPlay();
      setIsPlaying(true);
    }
  };

  const handleClear = () => {
    onClear();
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <div className="title">
          <h1>Party 🎉</h1>
        </div>
        <div className="system-controls">
          <button
            onClick={handlePlayPause}
            className={`play-pause-button ${isPlaying ? "playing" : "paused"}`}
          >
            {isPlaying ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <rect x="2" y="1" width="3" height="10" />
                <rect x="7" y="1" width="3" height="10" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <polygon points="2,1 2,11 10,6" />
              </svg>
            )}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button onClick={handleClear} className="clear-button">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1v1H1v1h1v8a1 1 0 001 1h6a1 1 0 001-1V3h1V2H9V1a1 1 0 00-1-1H4a1 1 0 00-1 1zm1 0h4v1H4V1z" />
              <path d="M4 4h1v5H4V4zm3 0h1v5H7V4z" />
            </svg>
            <span>Clear</span>
          </button>
          <button onClick={handleReset} className="reset-spawn-button">
            <RefreshCw width="12" height="12" />
            <span>Restart</span>
          </button>
          {onSave && (
            <button onClick={onSave} className="topbar-save-button">
              <Save width="12" height="12" />
              <span>Save</span>
            </button>
          )}
          {onLoad && (
            <button onClick={onLoad} className="topbar-load-button">
              <FolderOpen width="12" height="12" />
              <span>Load</span>
            </button>
          )}
        </div>
        {onToolModeChange && (
          <div className="tool-group">
            <div className="tool-mode-selector">
              <button
                onClick={() => onToolModeChange("spawn")}
                className={`tool-mode-button tool-mode-left ${
                  toolMode === "spawn" ? "tool-mode-active" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <circle cx="6" cy="6" r="3" />
                </svg>
                <span>Spawn</span>
              </button>
              <button
                onClick={() => onToolModeChange("remove")}
                className={`tool-mode-button tool-mode-right ${
                  toolMode === "remove" ? "tool-mode-active" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    fill="none"
                  />
                </svg>
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}
        <div className="topbar-right">
          {onShowHotkeys && (
            <button
              onClick={onShowHotkeys}
              className="help-button"
              title="Show help and controls (Press ? for help)"
              aria-label="Show help and controls"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
