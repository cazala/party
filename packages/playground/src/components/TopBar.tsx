import { useCallback } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useEngine } from "../contexts/EngineContext";
import { useInit } from "../hooks/useInit";
import "./TopBar.css";

export function TopBar() {
  const { isPlaying, play, pause, clear, spawnParticles } = useEngine();
  const { initState } = useInit();

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleClear = () => {
    clear();
  };

  const handleReset = useCallback(() => {
    // Re-spawn particles using current INIT panel config from Redux
    spawnParticles(initState);
    play();
  }, [spawnParticles, play, initState]);

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
        <div className="topbar-right"></div>
      </div>
    </div>
  );
}
