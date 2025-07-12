import { usePlayground } from "./hooks/usePlayground";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect, useRef, useState } from "react";
import { SystemControls } from "./components/SystemControls";
import { ForcesControls } from "./components/ForcesControls";
import { TopBar } from "./components/TopBar";
import { HotkeysModal } from "./components/HotkeysModal";
import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const LEFT_SIDEBAR_WIDTH = 280;
const RIGHT_SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHotkeysModalOpen, setIsHotkeysModalOpen] = useState(false);
  
  const {
    system,
    gravity,
    bounds,
    flock,
    collisions,
    fluid,
    renderer,
    spatialGrid,
    play,
    pause,
    clear,
    resetParticles,
    spawnParticles,
  } = usePlayground(canvasRef);
  const size = useWindowSize();

  useEffect(() => {
    if (!system || !gravity || !bounds || !flock || !collisions || !fluid || !renderer)
      return;
    system.setSize(size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH, size.height - TOPBAR_HEIGHT);
  }, [system, gravity, bounds, flock, collisions, fluid, renderer, size]);

  useEffect(() => {
    if (system) {
      resetParticles();
    }
  }, [system, resetParticles]);

  // Global keyboard shortcut to open hotkeys modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open hotkeys modal with '?' key
      if (e.key === '?' && !isHotkeysModalOpen) {
        e.preventDefault();
        setIsHotkeysModalOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHotkeysModalOpen]);

  return (
    <div className="app">
      <TopBar
        system={system}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={resetParticles}
        onShowHotkeys={() => setIsHotkeysModalOpen(true)}
      />
      <div className="app-content">
        <div className="left-sidebar">
          <SystemControls
            renderer={renderer}
            spatialGrid={spatialGrid}
            onSpawnParticles={spawnParticles}
            onGetSpawnConfig={() => ({
              numParticles: 100,
              shape: "grid" as const,
              spacing: 50,
              particleSize: 10,
              dragThreshold: 5,
            })}
          />
        </div>
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            id="canvas"
            width={size.width - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH}
            height={size.height - TOPBAR_HEIGHT}
          />
        </div>
        <div className="right-sidebar">
          <ForcesControls
            system={system}
            gravity={gravity}
            flock={flock}
            bounds={bounds}
            collisions={collisions}
            fluid={fluid}
          />
        </div>
      </div>
      
      <HotkeysModal 
        isOpen={isHotkeysModalOpen} 
        onClose={() => setIsHotkeysModalOpen(false)} 
      />
    </div>
  );
}

export default App;
