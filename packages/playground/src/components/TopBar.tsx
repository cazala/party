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

      // Poll the system's playing state to keep the button in sync
      const interval = setInterval(() => {
        setIsPlaying(system.isPlaying);
      }, 100); // Check every 100ms

      return () => clearInterval(interval);
    }
  }, [system]);

  // Add keyboard shortcuts for tool mode changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onToolModeChange) return;

      // Check for Cmd (Mac) or Ctrl (PC)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "a":
            e.preventDefault();
            onToolModeChange("spawn");
            break;
          case "s":
            e.preventDefault();
            onToolModeChange("joint");
            break;
          case "d":
            e.preventDefault();
            onToolModeChange("grab");
            break;
          case "f":
            e.preventDefault();
            onToolModeChange("pin");
            break;
          case "g":
            e.preventDefault();
            onToolModeChange("remove");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToolModeChange]);

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
                className={`tool-mode-button tool-mode-first ${
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
                onClick={() => onToolModeChange("joint")}
                className={`tool-mode-button tool-mode-second ${
                  toolMode === "joint" ? "tool-mode-active" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <line
                    x1="2"
                    y1="3"
                    x2="10"
                    y2="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="2" cy="3" r="1.5" />
                  <circle cx="10" cy="9" r="1.5" />
                </svg>
                <span>Joint</span>
              </button>
              <button
                onClick={() => onToolModeChange("grab")}
                className={`tool-mode-button tool-mode-third ${
                  toolMode === "grab" ? "tool-mode-active" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M2 4c0-.5.4-1 1-1s1 .5 1 1v2h1V3c0-.5.4-1 1-1s1 .5 1 1v3h1V2c0-.5.4-1 1-1s1 .5 1 1v4h.5c.5 0 1 .4 1 1v2c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V4z" />
                </svg>
                <span>Grab</span>
              </button>
              <button
                onClick={() => onToolModeChange("pin")}
                className={`tool-mode-button tool-mode-fourth ${
                  toolMode === "pin" ? "tool-mode-active" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M6 1L7 2V4L8 5V6L7 7V9L6 10L5 9V7L4 6V5L5 4V2L6 1Z M6 3L5.5 3.5V5.5L6 6L6.5 5.5V3.5L6 3Z" />
                </svg>
                <span>Pin</span>
              </button>
              <button
                onClick={() => onToolModeChange("remove")}
                className={`tool-mode-button tool-mode-fifth ${
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
