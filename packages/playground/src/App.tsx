import { useParty } from "./hooks/useParty";
import { useWindowSize } from "./hooks/useWindowSize";
import { useEffect } from "react";
import { Controls } from "./components/Controls";
import { TopBar } from "./components/TopBar";
import "./styles/index.css";
import "./components/Controls.css";
import "./components/TopBar.css";
import "./App.css";

const SIDEBAR_WIDTH = 320;
const TOPBAR_HEIGHT = 60;

function App() {
  const {
    system,
    gravity,
    bounds,
    flock,
    collisions,
    renderer,
    spatialGrid,
    play,
    pause,
    clear,
    resetParticles,
    spawnParticles,
  } = useParty();
  const size = useWindowSize();

  useEffect(() => {
    if (!system || !gravity || !bounds || !flock || !collisions || !renderer)
      return;
    system.setSize(size.width - SIDEBAR_WIDTH, size.height - TOPBAR_HEIGHT);
  }, [system, gravity, bounds, flock, collisions, renderer, size]);

  useEffect(() => {
    if (system) {
      resetParticles();
    }
  }, [system, resetParticles]);

  return (
    <div className="app">
      <TopBar
        system={system}
        onPlay={play}
        onPause={pause}
        onClear={clear}
        onReset={resetParticles}
      />
      <div className="app-content">
        <div className="canvas-container">
          <canvas
            id="canvas"
            width={size.width - SIDEBAR_WIDTH}
            height={size.height - TOPBAR_HEIGHT}
          />
        </div>
        <div className="sidebar">
          <Controls
            gravity={gravity}
            flock={flock}
            bounds={bounds}
            collisions={collisions}
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
      </div>
    </div>
  );
}

export default App;
