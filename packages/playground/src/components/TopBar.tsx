import { useState, useEffect } from 'react';
import { ParticleSystem } from '../../../core/src';

interface TopBarProps {
  system: ParticleSystem | null;
  onPlay: () => void;
  onPause: () => void;
  onClear: () => void;
}

export function TopBar({ system, onPlay, onPause, onClear }: TopBarProps) {
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

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <div className="title">
          <h1>Particle System</h1>
        </div>
        <div className="system-controls">
          <button 
            onClick={handlePlayPause} 
            className={`play-pause-button ${isPlaying ? 'playing' : 'paused'}`}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1" width="3" height="10" />
                <rect x="7" y="1" width="3" height="10" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <polygon points="2,1 2,11 10,6" />
              </svg>
            )}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button onClick={handleClear} className="clear-button">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1v1H1v1h1v8a1 1 0 001 1h6a1 1 0 001-1V3h1V2H9V1a1 1 0 00-1-1H4a1 1 0 00-1 1zm1 0h4v1H4V1z"/>
              <path d="M4 4h1v5H4V4zm3 0h1v5H7V4z"/>
            </svg>
            <span>Clear</span>
          </button>
        </div>
        <div className="topbar-right"></div>
      </div>
    </div>
  );
}