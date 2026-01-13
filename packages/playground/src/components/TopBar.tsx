import { useCallback, useState } from "react";
import {
  RefreshCw,
  Trash2,
  HelpCircle,
  Maximize,
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
import { useUI } from "../hooks/useUI";
import { useTrails } from "../hooks/modules/useTrails";
import { isMobileDevice } from "../utils/deviceCapabilities";
import { useShareableSessionUrl } from "../contexts/ShareableSessionUrlContext";
import { HelpModal } from "./HelpModal";
import { SaveSessionModal } from "./modals/SaveSessionModal";
import { LoadSessionModal } from "./modals/LoadSessionModal";
import "./TopBar.css";

export function TopBar({
  isDemoPlaying,
  stopDemo,
  playDemo,
}: {
  isDemoPlaying: boolean;
  stopDemo: () => void;
  playDemo: () => void;
}) {
  const { exitToHomepage } = useShareableSessionUrl();
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const { isPlaying, play, pause, clear, spawnParticles, getCount, isWebGPU, setZoom, setCamera } = useEngine();
  const { initState, gridJoints, setGridJoints } = useInit();
  const { removeAllJoints } = useJoints();
  const { removeAllLines } = useLines();
  const { resetHistory, undo, redo, canUndo, canRedo } = useHistory();
  const { toggleFullscreenMode } = useUI();
  const { setEnabled: setTrailsEnabled, setDecay: setTrailsDecay } = useTrails();

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

  const handleDemoToggle = () => {
    if (isDemoPlaying) {
      stopDemo();
    } else {
      // Only start demo if WebGPU is available
      if (isWebGPU) {
        // Spawn 35k particles with random shape
        spawnParticles({
          numParticles: 35000,
          shape: "random",
          spacing: 20,
          particleSize: 3,
          radius: 100,
          colors: ["#ffffff"],
          velocityConfig: { speed: 100, direction: "random", angle: 0 },
          innerRadius: 50,
          squareSize: 200,
        });
        
        // Set zoom and camera (reset zoom to 0.2 for mobile, 0.3 for desktop)
        setZoom(isMobileDevice() ? 0.2 : 0.3);
        setCamera({ x: 0, y: 0 });
        
        // Enable trails module
        setTrailsEnabled(true);
        setTrailsDecay(10);
        
        // Start the demo without interaction force (playground mode)
        playDemo();
      }
    }
  };


  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <div className="title">
          <h1
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={exitToHomepage}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                exitToHomepage();
              }
            }}
            title="Back to homepage"
          >
            Party 🎉
          </h1>
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
            className={`demo-button ${isDemoPlaying ? "demo-active" : ""}`}
            onClick={handleDemoToggle}
            title={isDemoPlaying ? "Stop Demo" : "Start Demo"}
          >
            <span>Demo</span>
          </button>
          <button
            className="fullscreen-button"
            aria-label="Fullscreen"
            title="Enter Fullscreen"
            onClick={toggleFullscreenMode}
          >
            <Maximize width="18" height="18" />
          </button>
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
