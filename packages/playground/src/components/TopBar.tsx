import { useState, useEffect } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { System } from "@cazala/party/legacy";

interface TopBarProps {
  system: System | null;
  onPlay: () => void;
  onPause: () => void;
  onClear: () => void;
  onReset: () => void;
}

export function TopBar({
  system,
  onPlay,
  onPause,
  onClear,
  onReset,
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
