import { useCallback, useState } from "react";
import { RefreshCw, Trash2, HelpCircle } from "lucide-react";
import { useEngine } from "../hooks/useEngine";
import { useInit } from "../hooks/useInit";
import { useJoints } from "../hooks/modules/useJoints";
import { useLines } from "../hooks/modules/useLines";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { clear as clearHistory } from "../slices/history";
import { clearRegistry as clearHistoryRegistry } from "../history/registry";
import "./TopBar.css";
import { HelpModal } from "./HelpModal";

export function TopBar() {
  const dispatch = useAppDispatch();
  const [helpOpen, setHelpOpen] = useState(false);
  const { isPlaying, play, pause, clear, spawnParticles } = useEngine();
  const { initState, gridJoints, setGridJoints } = useInit();
  const { removeAllJoints } = useJoints();
  const { removeAllLines } = useLines();

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleClear = () => {
    // Reset undo/redo history
    dispatch(clearHistory());
    clearHistoryRegistry();

    // Clear scene
    clear();
    removeAllJoints();
    removeAllLines();
  };

  const handleReset = useCallback(() => {
    // Reset undo/redo history
    dispatch(clearHistory());
    clearHistoryRegistry();

    // Reset joints and lines using helper methods
    removeAllJoints();
    removeAllLines();
    // Re-spawn particles using current INIT panel config from Redux
    spawnParticles(initState);
    play();

    // If gridJoints is enabled, force re-creation by toggling the state
    if (gridJoints && initState.shape === "grid") {
      setGridJoints(false);
      setTimeout(() => setGridJoints(true), 0);
    }
  }, [
    dispatch,
    removeAllJoints,
    removeAllLines,
    spawnParticles,
    play,
    initState,
    gridJoints,
    setGridJoints,
  ]);

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
            <Trash2 width="12" height="12" />
            <span>Clear</span>
          </button>
          <button onClick={handleReset} className="reset-spawn-button">
            <RefreshCw width="12" height="12" />
            <span>Restart</span>
          </button>
        </div>
        <div className="topbar-right">
          <button
            className="help-button"
            aria-label="Help"
            title="Help & Shortcuts"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle width="18" height="18" />
          </button>
        </div>
      </div>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
