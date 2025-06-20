
interface TopBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  particleCount: number;
}

export default function TopBar({ 
  isPlaying, 
  onTogglePlay, 
  particleCount 
}: TopBarProps) {
  return (
    <div className="topbar">
      <h1>Particle System Playground</h1>
      <button 
        className={`play-button ${isPlaying ? 'playing' : ''}`}
        onClick={onTogglePlay}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#ccc' }}>
        Particles: {particleCount}
      </div>
    </div>
  );
}