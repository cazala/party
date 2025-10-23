import { useCallback, useState } from "react";
import {
  RefreshCw,
  Trash2,
  HelpCircle,
  Undo,
  Redo,
  Save,
  File,
} from "lucide-react";
import { useEngine } from "../hooks/useEngine";
import { useInit } from "../hooks/useInit";
import { useJoints } from "../hooks/modules/useJoints";
import { useLines } from "../hooks/modules/useLines";
import { useHistory } from "../hooks/useHistory";
import { HelpModal } from "./HelpModal";
import { SaveSessionModal } from "./modals/SaveSessionModal";
import { LoadSessionModal } from "./modals/LoadSessionModal";
import "./TopBar.css";

export function TopBar() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const { isPlaying, play, pause, clear, spawnParticles, getCount } = useEngine();
  const { initState, gridJoints, setGridJoints } = useInit();
  const { removeAllJoints } = useJoints();
  const { removeAllLines } = useLines();
  const { resetHistory, undo, redo, canUndo, canRedo } = useHistory();

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleClear = () => {
    // Reset undo/redo history
    resetHistory();

    // Clear scene
    clear();
    removeAllJoints();
    removeAllLines();
  };

  const handleSaveSession = () => {
    // Pause engine while modal is open
    pause();
    setSaveModalOpen(true);
  };

  const handleLoadSession = () => {
    // Pause engine while modal is open
    pause();
    setLoadModalOpen(true);
  };

  const handleCloseModal = () => {
    setSaveModalOpen(false);
    setLoadModalOpen(false);
    // Resume engine when modal closes
    play();
  };

  const handleReset = useCallback(() => {
    // Reset undo/redo history
    resetHistory();

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
    resetHistory,
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
          <div className="button-group">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="button"
              title="Undo (Cmd/Ctrl+Z)"
            >
              <Undo width="12" height="12" />
              <span>Undo</span>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="button"
              title="Redo (Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y)"
            >
              <Redo width="12" height="12" />
              <span>Redo</span>
            </button>
          </div>
          <div className="button-group">
            <button
              onClick={handlePlayPause}
              className={`button ${isPlaying ? "playing" : "paused"}`}
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
            <button onClick={handleClear} className="button">
              <Trash2 width="12" height="12" />
              <span>Clear</span>
            </button>
            <button onClick={handleReset} className="button">
              <RefreshCw width="12" height="12" />
              <span>Restart</span>
            </button>
          </div>

          <div className="button-group">
            <button 
              className="button"
              onClick={handleSaveSession}
            >
              <Save width="12" height="12" />
              <span>Save</span>
            </button>
            <button 
              className="button"
              onClick={handleLoadSession}
            >
              <File width="12" height="12" />
              <span>Load</span>
            </button>
          </div>
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
      <SaveSessionModal 
        isOpen={saveModalOpen} 
        onClose={handleCloseModal}
        particleCount={getCount()}
      />
      <LoadSessionModal 
        isOpen={loadModalOpen} 
        onClose={handleCloseModal}
      />
    </div>
  );
}
