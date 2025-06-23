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
        <div className="system-controls">
          <button 
            onClick={handlePlayPause} 
            className={`play-pause-button ${isPlaying ? 'playing' : 'paused'}`}
          >
            {isPlaying ? '⏸️' : '▶️'}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button onClick={handleClear} className="clear-button">
            🗑️ <span>Clear</span>
          </button>
        </div>
        <div className="title">
          <h1>Particle System</h1>
        </div>
        <div className="status">
          <span className={`status-indicator ${isPlaying ? 'active' : 'inactive'}`}>
            {isPlaying ? 'Running' : 'Paused'}
          </span>
        </div>
      </div>
    </div>
  );
}